import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { UK_CITIES, CITY_COORDINATES, type UKCity } from "@/lib/cities";
import { UK_SPECIES, normaliseSpecies } from "@/lib/species";
import { ensureSynced } from "@/lib/sync";
import { jsonError, handleRouteError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const syncStatus = await ensureSynced(db);

    const searchParams = request.nextUrl.searchParams;
    const fromParam = searchParams.get("from")?.trim() || null;
    const toParam = searchParams.get("to")?.trim() || null;
    const rawSpecies = searchParams.get("species")?.trim() || null;
    const rawSource = searchParams.get("source")?.trim()?.toLowerCase() || null;

    const filterSpecies = rawSpecies ? normaliseSpecies(rawSpecies) : null;
    if (rawSpecies && !filterSpecies) {
      return jsonError(
        "INVALID_PARAMETER",
        `Unknown species '${rawSpecies}'. Valid species are: ${UK_SPECIES.join(", ")}`,
        400
      );
    }

    let filterSource: "elanco" | "community" | null = null;
    if (rawSource === "elanco" || rawSource === "community") {
      filterSource = rawSource;
    } else if (rawSource) {
      return jsonError("INVALID_PARAMETER", "source must be 'elanco' or 'community'");
    }

    let sql = `
      SELECT city, COUNT(*) as count
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

    if (filterSpecies) {
      sql += " AND species = @filterSpecies";
      params.filterSpecies = filterSpecies;
    }

    if (filterSource) {
      sql += " AND source = @filterSource";
      params.filterSource = filterSource;
    }

    sql += " GROUP BY city";

    const rows = db.prepare(sql).all(params) as Array<{ city: string; count: number }>;
    const countsMap = new Map<string, number>();
    let total = 0;

    for (const r of rows) {
      countsMap.set(r.city, r.count);
      total += r.count;
    }

    // Determine the most common species for each city under the current filters
    const topSpeciesSql = `
      WITH RankedSpecies AS (
        SELECT
          city,
          species,
          COUNT(*) as cnt,
          ROW_NUMBER() OVER(PARTITION BY city ORDER BY COUNT(*) DESC) as rn
        FROM sightings
        WHERE 1=1
          ${fromParam ? "AND date >= @fromDate" : ""}
          ${toParam ? "AND date <= @toDate" : ""}
          ${filterSpecies ? "AND species = @filterSpecies" : ""}
          ${filterSource ? "AND source = @filterSource" : ""}
        GROUP BY city, species
      )
      SELECT city, species as topSpecies FROM RankedSpecies WHERE rn = 1
    `;

    const topRows = db.prepare(topSpeciesSql).all(params) as Array<{
      city: string;
      topSpecies: string;
    }>;
    const topSpeciesMap = new Map<string, string>();
    for (const tr of topRows) {
      topSpeciesMap.set(tr.city, tr.topSpecies);
    }

    // Include all 14 UK cities with their geographic coordinates and dominant species
    const regions = UK_CITIES.map((cityName) => {
      const coords = CITY_COORDINATES[cityName as UKCity];
      const count = countsMap.get(cityName) ?? 0;
      return {
        city: cityName,
        latitude: coords.latitude,
        longitude: coords.longitude,
        count,
        mostCommonSpecies: topSpeciesMap.get(cityName) || null,
      };
    });

    const headers = new Headers();
    if (syncStatus.stale) {
      headers.set("X-Data-Stale", "true");
    }

    return NextResponse.json(
      {
        regions,
        total,
        stale: syncStatus.stale,
      },
      { headers }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
