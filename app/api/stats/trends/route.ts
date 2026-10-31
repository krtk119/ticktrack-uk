import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { UK_CITIES, normaliseCity } from "@/lib/cities";
import { UK_SPECIES, normaliseSpecies } from "@/lib/species";
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
    const rawSource = searchParams.get("source")?.trim()?.toLowerCase() || null;

    if (rawInterval !== "week" && rawInterval !== "month") {
      return jsonError("INVALID_PARAMETER", "interval must be 'week' or 'month'");
    }

    const filterCity = rawCity ? normaliseCity(rawCity) : null;
    if (rawCity && !filterCity) {
      return jsonError(
        "INVALID_PARAMETER",
        `Unknown city '${rawCity}'. Valid cities are: ${UK_CITIES.join(", ")}`,
        400
      );
    }

    const filterSpecies = rawSpecies ? normaliseSpecies(rawSpecies) : null;
    if (rawSpecies && !filterSpecies) {
      return jsonError(
        "INVALID_PARAMETER",
        `Unknown species '${rawSpecies}'. Valid species are: ${UK_SPECIES.join(", ")}`,
        400
      );
    }

    // Same source filter as /api/sightings and /api/stats/regions, so the map's
    // filters apply consistently to the city timeline.
    let filterSource: "elanco" | "community" | null = null;
    if (rawSource === "elanco" || rawSource === "community") {
      filterSource = rawSource;
    } else if (rawSource) {
      return jsonError("INVALID_PARAMETER", "source must be 'elanco' or 'community'");
    }

    // Determine period expression in SQLite: month (%Y-%m) or week (%Y-W%W)
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

    let fromIso: string | null = null;
    if (fromParam) {
      fromIso = fromParam.length === 10 ? `${fromParam}T00:00:00.000Z` : fromParam;
      sql += " AND date >= @fromDate";
      params.fromDate = fromIso;
    }

    let toIso: string | null = null;
    if (toParam) {
      toIso = toParam.length === 10 ? `${toParam}T23:59:59.999Z` : toParam;
      sql += " AND date <= @toDate";
      params.toDate = toIso;
    }

    if (filterCity) {
      sql += " AND city = @filterCity";
      params.filterCity = filterCity;
    }

    if (filterSpecies) {
      sql += " AND species = @filterSpecies";
      params.filterSpecies = filterSpecies;
    }

    if (filterSource) {
      sql += " AND source = @filterSource";
      params.filterSource = filterSource;
    }

    sql += " GROUP BY period ORDER BY period ASC";

    const rows = db.prepare(sql).all(params) as Array<{ period: string; count: number }>;
    const countsMap = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
      countsMap.set(r.period, r.count);
      total += r.count;
    }

    // Determine start and end boundaries for gap filling
    let minDateStr = fromIso;
    let maxDateStr = toIso;

    if (!minDateStr || !maxDateStr) {
      // Query boundary dates from sightings matching the filters
      let boundSql = `
        SELECT MIN(date) as minDate, MAX(date) as maxDate
        FROM sightings
        WHERE 1=1
      `;
      const boundParams: Record<string, unknown> = {};

      if (filterCity) {
        boundSql += " AND city = @city";
        boundParams.city = filterCity;
      }
      if (filterSpecies) {
        boundSql += " AND species = @species";
        boundParams.species = filterSpecies;
      }
      if (filterSource) {
        boundSql += " AND source = @source";
        boundParams.source = filterSource;
      }

      const boundRow = db.prepare(boundSql).get(boundParams) as
        | { minDate: string | null; maxDate: string | null }
        | undefined;

      if (!minDateStr) {
        minDateStr = boundRow?.minDate || null;
      }
      if (!maxDateStr) {
        maxDateStr = boundRow?.maxDate || null;
      }
    }

    let allPeriods: string[] = [];

    if (minDateStr && maxDateStr) {
      const startDate = new Date(minDateStr);
      const endDate = new Date(maxDateStr);

      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate <= endDate) {
        if (rawInterval === "month") {
          let curYear = startDate.getUTCFullYear();
          let curMonth = startDate.getUTCMonth() + 1;
          const endYear = endDate.getUTCFullYear();
          const endMonth = endDate.getUTCMonth() + 1;

          while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
            allPeriods.push(`${curYear}-${String(curMonth).padStart(2, "0")}`);
            curMonth++;
            if (curMonth > 12) {
              curMonth = 1;
              curYear++;
            }
          }
        } else {
          // Weekly interval: advance by 7 days from start week to end week
          const cur = new Date(
            Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate())
          );
          // Adjust to Monday of the starting week
          const day = cur.getUTCDay();
          const diffToMon = day === 0 ? -6 : 1 - day;
          cur.setUTCDate(cur.getUTCDate() + diffToMon);

          const endTimestamp = endDate.getTime();
          const seen = new Set<string>();
          const weekStmt = db.prepare("SELECT strftime('%Y-W%W', ?) as p");

          while (cur.getTime() <= endTimestamp + 6 * 24 * 60 * 60 * 1000) {
            const iso = cur.toISOString();
            const res = weekStmt.get(iso) as { p: string };
            if (res && res.p && !seen.has(res.p)) {
              seen.add(res.p);
              allPeriods.push(res.p);
            }
            cur.setUTCDate(cur.getUTCDate() + 7);
          }
        }
      }
    } else if (rows.length > 0) {
      allPeriods = rows.map((r) => r.period);
    }

    // Build trend items with zero counts filled for gaps
    const trends = allPeriods.map((period) => ({
      period,
      count: countsMap.get(period) ?? 0,
    }));

    const headers = new Headers();
    if (syncStatus.stale) {
      headers.set("X-Data-Stale", "true");
    }

    return NextResponse.json(
      {
        interval: rawInterval,
        trends,
        total,
        stale: syncStatus.stale,
      },
      { headers }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
