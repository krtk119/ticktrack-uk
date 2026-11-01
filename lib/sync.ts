import { getDb, transaction, type Db } from "./db";
import { cleanSightings, type CleanSightingsResult } from "./cleaning";

export const ELANCO_API_BASE_URL =
  process.env.ELANCO_API_BASE_URL || "https://dev-task.elancoapps.com/data";

const SYNC_TIMEOUT_MS = 10000; // 10 seconds timeout
const MAX_RETRIES = 2; // 2 retries (3 attempts total)
const ONE_HOUR_MS = 60 * 60 * 1000;

export class SyncServiceUnavailableError extends Error {
  readonly code = "SERVICE_UNAVAILABLE";
  readonly statusCode = 503;

  constructor(
    message = "Upstream Elanco API is unavailable and no cached sighting data exists."
  ) {
    super(message);
    this.name = "SyncServiceUnavailableError";
  }
}

export interface UpstreamStats {
  api_version: string;
  total_sightings: number;
}

export interface SyncResult {
  synced: boolean;
  stale: boolean;
  report?: CleanSightingsResult["report"];
  totalUpserted?: number;
  error?: string;
}

/**
 * Executes an HTTP fetch with timeout and retries.
 */
export async function fetchWithRetry<T>(
  url: string,
  timeoutMs = SYNC_TIMEOUT_MS,
  retries = MAX_RETRIES
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Upstream returned HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      lastError = err;
      attempt++;
      if (attempt <= retries) {
        // Linear backoff before retry (300ms, 600ms)
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

/**
 * Synchronizes sightings from the upstream Elanco API into the database.
 */
export async function syncFromUpstream(
  db?: Db,
  baseUrl = ELANCO_API_BASE_URL
): Promise<{ report: CleanSightingsResult["report"]; totalUpserted: number }> {
  const targetDb = db || getDb();

  // 1. Fetch sightings and upstream stats in parallel
  const sightingsUrl = `${baseUrl}/tick-sightings`;
  const statsUrl = `${baseUrl}/stats`;

  const [rawSightings, stats] = await Promise.all([
    fetchWithRetry<unknown[]>(sightingsUrl),
    fetchWithRetry<UpstreamStats>(statsUrl).catch((err) => {
      console.warn("[sync] Could not retrieve upstream /stats:", err);
      return null;
    }),
  ]);

  if (!Array.isArray(rawSightings)) {
    throw new Error("Invalid response from upstream: tick-sightings must be a JSON array");
  }

  // 2. Validate stats count and warn if mismatch
  if (stats && typeof stats.total_sightings === "number") {
    if (stats.total_sightings !== rawSightings.length) {
      console.warn(
        `[sync] Warning: upstream total_sightings (${stats.total_sightings}) does not match records received (${rawSightings.length})`
      );
    }
  }

  // 3. Clean and validate records
  const { clean, report } = cleanSightings(rawSightings);

  // 4. Upsert into SQLite inside a single transaction
  const deleteElancoStmt = targetDb.prepare("DELETE FROM sightings WHERE source = 'elanco'");

  const insertStmt = targetDb.prepare(`
    INSERT INTO sightings (id, date, city, species, latinName, source, verified, notes, imageUrl)
    VALUES (@id, @date, @city, @species, @latinName, 'elanco', 1, NULL, NULL)
  `);

  const setMetaStmt = targetDb.prepare(`
    INSERT INTO sync_meta (key, value, updated_at)
    VALUES (@key, @value, @updated_at)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);

  const nowIso = new Date().toISOString();

  transaction(targetDb, () => {
    // Delete existing upstream records so removed upstream records disappear
    // Community rows are strictly preserved and never touched by sync
    deleteElancoStmt.run();

    for (const record of clean) {
      insertStmt.run({
        id: record.id,
        date: record.date,
        city: record.city,
        species: record.species,
        latinName: record.latinName,
      });
    }

    setMetaStmt.run({ key: "last_synced_at", value: nowIso, updated_at: nowIso });
    setMetaStmt.run({ key: "last_sync_status", value: "success", updated_at: nowIso });
    if (stats) {
      setMetaStmt.run({ key: "upstream_stats", value: JSON.stringify(stats), updated_at: nowIso });
    }
  });

  return { report, totalUpserted: clean.length };
}

let inFlightSync: Promise<SyncResult> | null = null;

/**
 * Ensures data is synchronized according to cache rules:
 * - Syncs if the database has 0 sightings
 * - Syncs if the last successful sync is older than 1 hour
 * - If upstream API fails: serves stale data if available; throws 503 if no data exists.
 */
export async function ensureSynced(
  db?: Db,
  baseUrl = ELANCO_API_BASE_URL
): Promise<SyncResult> {
  const targetDb = db || getDb();

  // Deduplicate concurrent sync calls
  if (inFlightSync) {
    return inFlightSync;
  }

  const checkAndSync = async (): Promise<SyncResult> => {
    const countRow = targetDb
      .prepare("SELECT COUNT(*) as count FROM sightings")
      .get() as { count: number };

    const metaRow = targetDb
      .prepare("SELECT value FROM sync_meta WHERE key = 'last_synced_at'")
      .get() as { value: string } | undefined;

    const isDbEmpty = countRow.count === 0;
    const lastSyncedAt = metaRow?.value ? new Date(metaRow.value).getTime() : 0;
    const isOlderThanOneHour = Date.now() - lastSyncedAt > ONE_HOUR_MS;

    if (!isDbEmpty && !isOlderThanOneHour) {
      return { synced: false, stale: false };
    }

    // Attempt synchronization
    try {
      const { report, totalUpserted } = await syncFromUpstream(targetDb, baseUrl);
      return { synced: true, stale: false, report, totalUpserted };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[sync] Sync from upstream failed:", errorMessage);

      // Re-check count in case of concurrent writes
      const currentCount = targetDb
        .prepare("SELECT COUNT(*) as count FROM sightings")
        .get() as { count: number };

      if (currentCount.count > 0) {
        // Record failed sync state but continue serving cached data marked as stale
        const nowIso = new Date().toISOString();
        targetDb
          .prepare(
            `INSERT INTO sync_meta (key, value, updated_at)
             VALUES ('last_sync_status', 'failed', @updated_at)
             ON CONFLICT(key) DO UPDATE SET value = 'failed', updated_at = excluded.updated_at`
          )
          .run({ updated_at: nowIso });

        return {
          synced: false,
          stale: true,
          error: errorMessage,
        };
      }

      // No data in DB: cannot serve requests, return 503
      throw new SyncServiceUnavailableError(
        "Upstream Elanco API is unavailable and no cached sighting data exists."
      );
    }
  };

  inFlightSync = checkAndSync().finally(() => {
    inFlightSync = null;
  });

  return inFlightSync;
}
