import { NextRequest, NextResponse } from "next/server";
import { getDb, rowToSighting, type SightingRow } from "@/lib/db";
import { jsonError, handleRouteError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return jsonError("NOT_FOUND", "Sighting not found", 404);
    }

    const db = getDb();
    const row = db
      .prepare("SELECT * FROM sightings WHERE id = ?")
      .get(id) as SightingRow | undefined;

    if (!row) {
      return jsonError("NOT_FOUND", `Sighting with ID '${id}' was not found`, 404);
    }

    return NextResponse.json(rowToSighting(row));
  } catch (err) {
    return handleRouteError(err);
  }
}
