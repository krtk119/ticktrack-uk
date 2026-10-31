import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { UK_CITIES, normaliseCity } from "@/lib/cities";
import { ensureSynced } from "@/lib/sync";
import { jsonError, handleRouteError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const syncStatus = await ensureSynced(db);

    const searchParams = request.nextUrl.searchParams;
    const rawCity = searchParams.get("city")?.trim() || null;

    const filterCity = rawCity ? normaliseCity(rawCity) : null;
    if (rawCity && !filterCity) {
      return jsonError(
        "INVALID_PARAMETER",
        `Unknown city '${rawCity}'. Valid cities are: ${UK_CITIES.join(", ")}`,
        400
      );
    }

    let sql = `
      SELECT strftime('%m', date) as monthStr, COUNT(*) as count
      FROM sightings
      WHERE 1=1
    `;
    const params: Record<string, unknown> = {};

    if (filterCity) {
      sql += " AND city = @filterCity";
      params.filterCity = filterCity;
    }

    sql += " GROUP BY monthStr";

    const rows = db.prepare(sql).all(params) as Array<{ monthStr: string; count: number }>;
    const countsMap = new Map<number, number>();
    let total = 0;

    for (const r of rows) {
      const monthNum = parseInt(r.monthStr, 10);
      countsMap.set(monthNum, r.count);
      total += r.count;
    }

    // Build ordered list of all 12 calendar months (Jan - Dec)
    const seasonal = MONTH_NAMES.map((name, idx) => {
      const monthNumber = idx + 1;
      const count = countsMap.get(monthNumber) ?? 0;
      return {
        month: name,
        monthNumber,
        count,
      };
    });

    const headers = new Headers();
    if (syncStatus.stale) {
      headers.set("X-Data-Stale", "true");
    }

    return NextResponse.json(
      {
        city: filterCity,
        months: seasonal,
        total,
        stale: syncStatus.stale,
      },
      { headers }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
