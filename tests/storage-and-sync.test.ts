import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { UK_CITIES, CITY_COORDINATES, normaliseCity } from "@/lib/cities";
import { initSchema, rowToSighting, type SightingRow } from "@/lib/db";
import {
  syncFromUpstream,
  ensureSynced,
  fetchWithRetry,
  SyncServiceUnavailableError,
} from "@/lib/sync";

describe("Phase 2: Cities & Coordinates", () => {
  it("contains exactly 14 UK cities with valid coordinates", () => {
    expect(UK_CITIES.length).toBe(14);

    for (const city of UK_CITIES) {
      const coords = CITY_COORDINATES[city as keyof typeof CITY_COORDINATES];
      expect(coords).toBeDefined();
      expect(coords.latitude).toBeGreaterThan(49);
      expect(coords.latitude).toBeLessThan(61);
      expect(coords.longitude).toBeGreaterThan(-8);
      expect(coords.longitude).toBeLessThan(2);
    }
  });

  it("normalises cities case-insensitively with whitespace trimmed", () => {
    expect(normaliseCity("  london ")).toBe("London");
    expect(normaliseCity("MANCHESTER")).toBe("Manchester");
    expect(normaliseCity("glasgow")).toBe("Glasgow");
    expect(normaliseCity("Unknown City")).toBeNull();
  });
});

describe("Phase 2: SQLite Schema & Storage", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it("stores and maps sightings with source, verified, notes, and imageUrl", () => {
    const insert = db.prepare(`
      INSERT INTO sightings (id, date, city, species, latinName, source, verified, notes, imageUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run("elanco_1", "2023-01-01T00:00:00.000Z", "London", "Marsh tick", "Ixodes apronophorus", "elanco", 1, null, null);
    insert.run("comm_1", "2023-02-01T12:00:00.000Z", "Bristol", "Tree-hole tick", "Ixodes arboricola", "community", 0, "Found near park", "/uploads/pic.jpg");

    const rows = db.prepare("SELECT * FROM sightings ORDER BY date ASC").all() as SightingRow[];
    expect(rows.length).toBe(2);

    const s1 = rowToSighting(rows[0]);
    expect(s1).toEqual({
      id: "elanco_1",
      date: "2023-01-01T00:00:00.000Z",
      city: "London",
      location: "London",
      species: "Marsh tick",
      latinName: "Ixodes apronophorus",
      source: "elanco",
      verified: true,
      notes: null,
      imageUrl: null,
    });

    const s2 = rowToSighting(rows[1]);
    expect(s2).toEqual({
      id: "comm_1",
      date: "2023-02-01T12:00:00.000Z",
      city: "Bristol",
      location: "Bristol",
      species: "Tree-hole tick",
      latinName: "Ixodes arboricola",
      source: "community",
      verified: false,
      notes: "Found near park",
      imageUrl: "/uploads/pic.jpg",
    });
  });

  it("upserts elanco records on conflict of id", () => {
    const upsert = db.prepare(`
      INSERT INTO sightings (id, date, city, species, latinName, source, verified, notes, imageUrl)
      VALUES (@id, @date, @city, @species, @latinName, 'elanco', 1, NULL, NULL)
      ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        city = excluded.city,
        species = excluded.species,
        latinName = excluded.latinName
    `);

    upsert.run({
      id: "rec_sync_1",
      date: "2022-01-01T00:00:00.000Z",
      city: "London",
      species: "Marsh tick",
      latinName: "Ixodes apronophorus",
    });

    upsert.run({
      id: "rec_sync_1",
      date: "2022-01-02T00:00:00.000Z",
      city: "Manchester",
      species: "Marsh tick",
      latinName: "Ixodes apronophorus",
    });

    const rows = db.prepare("SELECT * FROM sightings WHERE id = 'rec_sync_1'").all() as SightingRow[];
    expect(rows.length).toBe(1);
    expect(rows[0].city).toBe("Manchester");
    expect(rows[0].date).toBe("2022-01-02T00:00:00.000Z");
  });
});

describe("Phase 2: fetchWithRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries up to 2 times on network failures and succeeds", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error("Temporary network error");
      }
      return {
        ok: true,
        json: async () => ({ status: "ok" }),
      };
    });

    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchWithRetry<{ status: string }>("https://test-api.local", 1000, 2);
    expect(result).toEqual({ status: "ok" });
    expect(callCount).toBe(3); // 1 initial + 2 retries
  });

  it("throws last error when all retries are exhausted", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchWithRetry("https://test-api.local", 500, 2)).rejects.toThrow(
      "Connection refused"
    );
  });
});

describe("Phase 2: Sync and Cache Lifecycle", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initSchema(db);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  it("fetches, cleans, warns on stats mismatch, and upserts upstream data", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mockSightings = [
      {
        id: "api_1",
        date: "2023-05-01T10:00:00",
        location: "London",
        species: "Marsh tick",
      },
      {
        id: "api_2",
        date: "2023-05-02T10:00:00",
        location: "Manchester",
        species: "Passerine tick",
      },
    ];

    const mockStats = {
      api_version: "1.0.0",
      total_sightings: 5, // Intentionally mismatches records received (2)
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/tick-sightings")) {
          return { ok: true, json: async () => mockSightings };
        }
        if (url.includes("/stats")) {
          return { ok: true, json: async () => mockStats };
        }
        return { ok: false, status: 404 };
      })
    );

    const { report, totalUpserted } = await syncFromUpstream(db, "https://mock-api.local");

    expect(totalUpserted).toBe(2);
    expect(report.kept).toBe(2);

    const count = db.prepare("SELECT COUNT(*) as count FROM sightings").get() as { count: number };
    expect(count.count).toBe(2);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("total_sightings (5) does not match records received (2)")
    );
  });

  it("syncs on first request when DB is empty", async () => {
    const mockSightings = [
      { id: "s1", date: "2023-01-01T00:00:00", location: "Cardiff", species: "Passerine tick" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSightings,
      })
    );

    const result = await ensureSynced(db, "https://mock-api.local");
    expect(result.synced).toBe(true);
    expect(result.stale).toBe(false);

    const count = db.prepare("SELECT COUNT(*) as count FROM sightings").get() as { count: number };
    expect(count.count).toBe(1);
  });

  it("skips sync if data was synced within 1 hour", async () => {
    // Populate DB and recent sync meta
    db.prepare(`
      INSERT INTO sightings (id, date, city, species, latinName, source, verified)
      VALUES ('init_1', '2023-01-01T00:00:00.000Z', 'London', 'Marsh tick', 'Ixodes apronophorus', 'elanco', 1)
    `).run();

    const recentSync = new Date().toISOString();
    db.prepare(`
      INSERT INTO sync_meta (key, value, updated_at) VALUES ('last_synced_at', ?, ?)
    `).run(recentSync, recentSync);

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await ensureSynced(db, "https://mock-api.local");
    expect(result.synced).toBe(false);
    expect(result.stale).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("serves stored data with stale: true if upstream API fails and DB has data", async () => {
    // Populate DB with older sync data (> 1 hour old)
    db.prepare(`
      INSERT INTO sightings (id, date, city, species, latinName, source, verified)
      VALUES ('cached_1', '2023-01-01T00:00:00.000Z', 'London', 'Marsh tick', 'Ixodes apronophorus', 'elanco', 1)
    `).run();

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO sync_meta (key, value, updated_at) VALUES ('last_synced_at', ?, ?)
    `).run(twoHoursAgo, twoHoursAgo);

    // Mock upstream API network failure
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("500 Internal Server Error")));

    const result = await ensureSynced(db, "https://mock-api.local");
    expect(result.synced).toBe(false);
    expect(result.stale).toBe(true);
    expect(result.error).toBeDefined();

    // Verify cached data remains accessible
    const count = db.prepare("SELECT COUNT(*) as count FROM sightings").get() as { count: number };
    expect(count.count).toBe(1);
  });

  it("throws 503 SyncServiceUnavailableError if upstream API fails and DB is empty", async () => {
    // DB is empty, upstream fails
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network connection dropped")));

    await expect(ensureSynced(db, "https://mock-api.local")).rejects.toThrow(
      SyncServiceUnavailableError
    );

    try {
      await ensureSynced(db, "https://mock-api.local");
    } catch (err) {
      expect(err).toBeInstanceOf(SyncServiceUnavailableError);
      expect((err as SyncServiceUnavailableError).statusCode).toBe(503);
      expect((err as SyncServiceUnavailableError).code).toBe("SERVICE_UNAVAILABLE");
    }
  });
});
