import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ELANCO_API_BASE_URL } from "@/lib/sync";
import { handleRouteError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();

    // 1. Check local database status
    let dbStatus = "connected";
    let sightingsCount = 0;
    let lastSyncedAt: string | null = null;

    try {
      const countRow = db
        .prepare("SELECT COUNT(*) as count FROM sightings")
        .get() as { count: number };
      sightingsCount = countRow?.count ?? 0;

      const metaRow = db
        .prepare("SELECT value FROM sync_meta WHERE key = 'last_synced_at'")
        .get() as { value: string } | undefined;
      lastSyncedAt = metaRow?.value ?? null;
    } catch {
      dbStatus = "error";
    }

    // 2. Check upstream API health with a 3s timeout
    let upstreamStatus = "unavailable";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${ELANCO_API_BASE_URL}/health`, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        upstreamStatus = "available";
      }
    } catch {
      upstreamStatus = "unavailable";
    }

    const overallStatus =
      dbStatus === "connected" && upstreamStatus === "available"
        ? "healthy"
        : dbStatus === "connected"
        ? "degraded"
        : "unhealthy";

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        sightingsCount,
        lastSyncedAt,
      },
      upstream: {
        status: upstreamStatus,
        url: `${ELANCO_API_BASE_URL}/health`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
