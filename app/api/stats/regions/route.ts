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

    const filterSpecies = rawSpecies ? normaliseSpecies(rawSpecies) : null;
    if (rawSpecies && !filterSpecies) {
      return jsonError(
        "INVALID_PARAMETER",
        `Unknown species '${rawSpecies}'. Valid species are: ${UK_SPECIES.join(", ")}`,
        400
      );
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

    sql += " GROUP BY city";

    const rows = db.prepare(sql).all(params) as Array<{ city: string; count: number }>;
    const countsMap = new Map<string, number>();
    let total = 0;

    for (const r of rows) {
      countsMap.set(r.city, r.count);
      total += r.count;
    }

    // Include all 14 UK cities with their geographic coordinates
    const regions = UK_CITIES.map((cityName) => {
      const coords = CITY_COORDINATES[cityName as UKCity];
      const count = countsMap.get(cityName) ?? 0;
      return {
        city: cityName,
        latitude: coords.latitude,
        longitude: coords.longitude,
        count,
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
