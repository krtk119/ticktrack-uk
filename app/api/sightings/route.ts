import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb, rowToSighting, type SightingRow, type SqlParams } from "@/lib/db";
import { UK_CITIES, normaliseCity } from "@/lib/cities";
import { UK_SPECIES, normaliseSpecies, SPECIES_MAP, type UKSpecies } from "@/lib/species";
import { ensureSynced } from "@/lib/sync";
import { jsonError, handleRouteError } from "@/lib/errors";
import { saveUploadedImage, uploadUrl } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/** Parses an optional whole-number query param. Returns null if present but not a whole number. */
function parseIntParam(raw: string | null, fallback: number): number | null {
  if (raw === null || raw.trim() === "") return fallback;
  return /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null;
}

/**
 * GET /api/sightings
 * Query filters: from, to, city, species, source. Paging: limit (default 100, max 500), offset.
 * Returns one page of Elanco and community sightings, newest first, labelled with source and
 * verified, plus `total`: how many sightings match the filters across all pages.
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();

    // Ensure synchronized data according to caching rules
    const syncStatus = await ensureSynced(db);

    const searchParams = request.nextUrl.searchParams;
    const fromParam = searchParams.get("from")?.trim() || null;
    const toParam = searchParams.get("to")?.trim() || null;
    const rawCity = searchParams.get("city")?.trim() || null;
    const rawSpecies = searchParams.get("species")?.trim() || null;
    const rawSource = searchParams.get("source")?.trim()?.toLowerCase() || null;

    // Normalise query filters where provided
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

    let filterSource: "elanco" | "community" | null = null;
    if (rawSource === "elanco" || rawSource === "community") {
      filterSource = rawSource;
    } else if (rawSource) {
      return jsonError("INVALID_PARAMETER", "source must be 'elanco' or 'community'");
    }

    // Paging, so responses stay small however large the dataset grows.
    const limit = parseIntParam(searchParams.get("limit"), DEFAULT_LIMIT);
    const offset = parseIntParam(searchParams.get("offset"), 0);
    if (limit === null || limit < 1 || limit > MAX_LIMIT) {
      return jsonError("INVALID_PARAMETER", `limit must be a whole number from 1 to ${MAX_LIMIT}`);
    }
    if (offset === null || offset < 0) {
      return jsonError("INVALID_PARAMETER", "offset must be a whole number of 0 or more");
    }

    // Build the parameterised WHERE clause once, and use it for both the count and the page.
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
      where += " AND city = @filterCity";
      params.filterCity = filterCity;
    }

    if (filterSpecies) {
      where += " AND species = @filterSpecies";
      params.filterSpecies = filterSpecies;
    }

    if (filterSource) {
      where += " AND source = @filterSource";
      params.filterSource = filterSource;
    }

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM sightings ${where}`).get(params) as { total: number };

    // id as a tie-breaker keeps the order stable, so a record never appears on two pages.
    const rows = db
      .prepare(
        `SELECT id, date, city, species, latinName, source, verified, notes, imageUrl
         FROM sightings ${where}
         ORDER BY date DESC, id ASC
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit, offset }) as unknown as SightingRow[];
    const sightings = rows.map(rowToSighting);

    const headers = new Headers();
    if (syncStatus.stale) {
      headers.set("X-Data-Stale", "true");
    }

    return NextResponse.json(
      {
        sightings,
        total,
        limit,
        offset,
        stale: syncStatus.stale,
      },
      { headers }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * POST /api/sightings
 * Accepts multipart/form-data: date, city, species, optional notes, optional image.
 * Strips EXIF metadata (including GPS) from images with sharp; see lib/uploads.ts.
 * Includes a rule-based possibleDuplicate check (same city + species within 1 day).
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const contentType = request.headers.get("content-type") || "";

    const fieldErrors: Record<string, string[]> = {};

    let dateInput: string | null = null;
    let cityInput: string | null = null;
    let speciesInput: string | null = null;
    let notesInput: string | null = null;
    let imageFile: File | null = null;

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      dateInput = formData.get("date")?.toString()?.trim() || null;
      cityInput = formData.get("city")?.toString()?.trim() || null;
      speciesInput = formData.get("species")?.toString()?.trim() || null;
      notesInput = formData.get("notes")?.toString()?.trim() || null;
      const file = formData.get("image");
      if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
        imageFile = file as File;
      }
    } else if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      dateInput = typeof body.date === "string" ? body.date.trim() : null;
      cityInput = typeof body.city === "string" ? body.city.trim() : null;
      speciesInput = typeof body.species === "string" ? body.species.trim() : null;
      notesInput = typeof body.notes === "string" ? body.notes.trim() : null;
    } else {
      return jsonError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be multipart/form-data or application/json", 415);
    }

    // 1. Validate date
    let isoDate = "";
    if (!dateInput) {
      fieldErrors.date = ["Date is required"];
    } else {
      const hasTz = dateInput.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(dateInput);
      const toParse = hasTz ? dateInput : `${dateInput}Z`;
      const parsedDate = new Date(toParse);

      if (isNaN(parsedDate.getTime())) {
        fieldErrors.date = ["Invalid date format"];
      } else if (parsedDate.getTime() > Date.now()) {
        fieldErrors.date = ["Date cannot be in the future"];
      } else {
        isoDate = parsedDate.toISOString();
      }
    }

    // 2. Validate city
    let validCity: string | null = null;
    if (!cityInput) {
      fieldErrors.city = ["City is required"];
    } else {
      validCity = normaliseCity(cityInput);
      if (!validCity) {
        fieldErrors.city = ["City must be one of the 14 supported UK cities"];
      }
    }

    // 3. Validate species
    let validSpecies: UKSpecies | null = null;
    let mappedLatinName = "";
    if (!speciesInput) {
      fieldErrors.species = ["Species is required"];
    } else {
      validSpecies = normaliseSpecies(speciesInput);
      if (!validSpecies) {
        fieldErrors.species = ["Species must be one of the 5 supported UK species"];
      } else {
        mappedLatinName = SPECIES_MAP[validSpecies];
      }
    }

    // 4. Validate notes
    if (notesInput && notesInput.length > 500) {
      fieldErrors.notes = ["Notes must not exceed 500 characters"];
    }

    // 5. Validate image if present
    let savedImageUrl: string | null = null;
    if (imageFile) {
      if (imageFile.size > MAX_IMAGE_BYTES) {
        fieldErrors.image = ["Image size must not exceed 5 MB"];
      } else if (!ALLOWED_MIME_TYPES.has(imageFile.type)) {
        fieldErrors.image = ["Image must be a JPEG, PNG, or WebP format"];
      }
    }

    // Return field-level errors if validation failed
    if (Object.keys(fieldErrors).length > 0) {
      return jsonError("VALIDATION_ERROR", "One or more fields failed validation", 400, fieldErrors);
    }

    // Only save the photo once every other field is valid, so rejected reports leave no orphan files.
    if (imageFile) {
      try {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        savedImageUrl = uploadUrl(await saveUploadedImage(buffer, imageFile.type));
      } catch (imgErr) {
        console.error("[sightings] Error processing image:", imgErr);
        return jsonError("VALIDATION_ERROR", "One or more fields failed validation", 400, {
          image: ["The photo couldn't be processed. Try a different image."],
        });
      }
    }

    // 6. Rule-based duplicate check (same city + species within 1 day)
    // Query existing sightings within a +/- 1 day window
    const targetEpoch = new Date(isoDate).getTime();
    const candidateRows = db
      .prepare(
        `SELECT id, date FROM sightings WHERE city = @city AND species = @species`
      )
      .all({ city: validCity, species: validSpecies }) as Array<{ id: string; date: string }>;

    let possibleDuplicate = false;
    let duplicateWarning: string | null = null;

    for (const cand of candidateRows) {
      const candTime = new Date(cand.date).getTime();
      if (Math.abs(candTime - targetEpoch) <= ONE_DAY_MS) {
        possibleDuplicate = true;
        duplicateWarning = `A sighting of ${validSpecies} in ${validCity} was already recorded within 1 day (id: ${cand.id}).`;
        break;
      }
    }

    // 7. Insert the community sighting into the database
    const newId = `comm_${crypto.randomUUID()}`;
    const insertStmt = db.prepare(`
      INSERT INTO sightings (id, date, city, species, latinName, source, verified, notes, imageUrl)
      VALUES (@id, @date, @city, @species, @latinName, 'community', 0, @notes, @imageUrl)
    `);

    insertStmt.run({
      id: newId,
      date: isoDate,
      city: validCity,
      species: validSpecies,
      latinName: mappedLatinName,
      notes: notesInput || null,
      imageUrl: savedImageUrl || null,
    });

    const newRecord = {
      id: newId,
      date: isoDate,
      city: validCity,
      species: validSpecies,
      latinName: mappedLatinName,
      source: "community" as const,
      verified: false,
      notes: notesInput || null,
      imageUrl: savedImageUrl || null,
      possibleDuplicate,
      ...(duplicateWarning ? { warning: duplicateWarning } : {}),
    };

    return NextResponse.json(newRecord, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
