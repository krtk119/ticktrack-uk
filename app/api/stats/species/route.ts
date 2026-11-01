import { NextRequest, NextResponse } from "next/server";
import { getDb, type SqlParams } from "@/lib/db";
import { UK_CITIES, normaliseCity } from "@/lib/cities";
import { UK_SPECIES, SPECIES_MAP } from "@/lib/species";
import { ensureSynced } from "@/lib/sync";
import { jsonError, handleRouteError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * GET /api/stats/species?city=&from=&to=&source=
 * Per-species summary: count, the city with most sightings and the busiest month of the year.
 * Computed in SQL so the frontend never needs to download every sighting to work these out.
 * All 5 species are always returned (count 0 if none match), in a fixed order.
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const syncStatus = await ensureSynced(db);

    const searchParams = request.nextUrl.searchParams;
    const fromParam = searchParams.get("from")?.trim() || null;
    const toParam = searchParams.get("to")?.trim() || null;
    const rawCity = searchParams.get("city")?.trim() || null;
    const rawSource = searchParams.get("source")?.trim()?.toLowerCase() || null;

    const filterCity = rawCity ? normaliseCity(rawCity) : null;
    if (rawCity && !filterCity) {
      return jsonError(
        "INVALID_PARAMETER",
        `Unknown city '${rawCity}'. Valid cities are: ${UK_CITIES.join(", ")}`,
        400
      );
    }

    if (rawSource && rawSource !== "elanco" && rawSource !== "community") {
      return jsonError("INVALID_PARAMETER", "source must be 'elanco' or 'community'");
    }

    let where = "WHERE 1=1";
    const params: SqlParams = {};
    if (fromParam) {
      where += " AND date >= @fromDate";
      params.fromDate = fromParam.length === 10 ? `${fromParam}T00:00:00.000Z` : fromParam;
    }
    if (toParam) {
      where += " AND date <= @toDate";
      params.toDate = toParam.length === 10 ? `${toParam}T23:59:59.999Z` : toParam;
    }
    if (filterCity) {
      where += " AND city = @city";
      params.city = filterCity;
    }
    if (rawSource) {
      where += " AND source = @source";
      params.source = rawSource;
    }

    const counts = db
      .prepare(`SELECT species, COUNT(*) AS count FROM sightings ${where} GROUP BY species`)
      .all(params) as { species: string; count: number }[];

    // Ties are broken alphabetically / by earliest month so the result is always the same.
    const topCities = db
      .prepare(
        `SELECT species, city FROM (
           SELECT species, city,
                  ROW_NUMBER() OVER (PARTITION BY species ORDER BY COUNT(*) DESC, city ASC) AS rn
           FROM sightings ${where}
           GROUP BY species, city
         ) WHERE rn = 1`
      )
      .all(params) as { species: string; city: string }[];

    const peakMonths = db
      .prepare(
        `SELECT species, month FROM (
           SELECT species, CAST(strftime('%m', date) AS INTEGER) AS month,
                  ROW_NUMBER() OVER (PARTITION BY species ORDER BY COUNT(*) DESC, strftime('%m', date) ASC) AS rn
           FROM sightings ${where}
           GROUP BY species, month
         ) WHERE rn = 1`
      )
      .all(params) as { species: string; month: number }[];

    const countMap = new Map(counts.map((r) => [r.species, r.count]));
    const cityMap = new Map(topCities.map((r) => [r.species, r.city]));
    const monthMap = new Map(peakMonths.map((r) => [r.species, r.month]));

    const species = UK_SPECIES.map((name) => {
      const month = monthMap.get(name);
      return {
        species: name,
        latinName: SPECIES_MAP[name],
        count: countMap.get(name) ?? 0,
        topCity: cityMap.get(name) ?? null,
        peakMonth: month ? MONTH_NAMES[month - 1] : null,
      };
    });

    return NextResponse.json({
      species,
      total: counts.reduce((sum, r) => sum + r.count, 0),
      stale: syncStatus.stale,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
