import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { normaliseCity } from "@/lib/cities";
import { normaliseSpecies } from "@/lib/species";
import { ensureSynced } from "@/lib/sync";
import { jsonError, handleRouteError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const syncStatus = await ensureSynced(db);

    const searchParams = request.nextUrl.searchParams;
    const rawInterval = searchParams.get("interval")?.trim()?.toLowerCase() || "month";
    const fromParam = searchParams.get("from")?.trim() || null;
    const toParam = searchParams.get("to")?.trim() || null;
    const rawCity = searchParams.get("city")?.trim() || null;
    const rawSpecies = searchParams.get("species")?.trim() || null;

    if (rawInterval !== "week" && rawInterval !== "month") {
      return jsonError("INVALID_PARAMETER", "interval must be 'week' or 'month'");
    }

    const filterCity = rawCity ? normaliseCity(rawCity) : null;
    if (rawCity && !filterCity) {
      return NextResponse.json({
        interval: rawInterval,
        trends: [],
        data: [],
        total: 0,
        stale: syncStatus.stale,
      });
    }

    const filterSpecies = rawSpecies ? normaliseSpecies(rawSpecies) : null;
    if (rawSpecies && !filterSpecies) {
      return NextResponse.json({
        interval: rawInterval,
        trends: [],
        data: [],
        total: 0,
        stale: syncStatus.stale,
      });
    }

    // Format time period by month (%Y-%m) or week (%Y-W%W)
    const periodExpr =
      rawInterval === "week"
        ? "strftime('%Y-W%W', date)"
        : "strftime('%Y-%m', date)";

    let sql = `
      SELECT ${periodExpr} as period, COUNT(*) as count
      FROM sightings
      WHERE 1=1
    `;
    const params: Record<string, unknown> = {};

    if (fromParam) {
      const fromDate = fromParam.length === 10 ? `${fromParam}T00:00:00.000Z` : fromParam;
      sql += " AND date >= @fromDate";
      params.fromDate = fromDate;
    }

    if (toParam) {
      const toDate = toParam.length === 10 ? `${toParam}T23:59:59.999Z` : toParam;
      sql += " AND date <= @toDate";
      params.toDate = toDate;
    }

    if (filterCity) {
      sql += " AND city = @filterCity";
      params.filterCity = filterCity;
    }

    if (filterSpecies) {
      sql += " AND species = @filterSpecies";
      params.filterSpecies = filterSpecies;
    }

    sql += " GROUP BY period ORDER BY period ASC";

    const rows = db.prepare(sql).all(params) as Array<{ period: string; count: number }>;
    const total = rows.reduce((acc, curr) => acc + curr.count, 0);

    const headers = new Headers();
    if (syncStatus.stale) {
      headers.set("X-Data-Stale", "true");
    }

    return NextResponse.json(
      {
        interval: rawInterval,
        trends: rows,
        data: rows,
        total,
        stale: syncStatus.stale,
      },
      { headers }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
