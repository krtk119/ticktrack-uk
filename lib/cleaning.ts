import { z } from "zod";
import { normaliseCity, type UKCity } from "./cities";
import { SPECIES_MAP, normaliseSpecies, type UKSpecies } from "./species";

/**
 * Zod schema for a raw sighting record from the upstream API.
 * The Elanco API only provides `location`, not `city`.
 */
export const rawRecordSchema = z.object({
  id: z.string().trim().min(1, "id is required"),
  date: z.string().trim().min(1, "date is required"),
  location: z.string().trim().min(1, "location is required"),
  species: z.string().trim().min(1, "species is required"),
  latinName: z.string().trim().optional(),
});

export type RawRecord = z.infer<typeof rawRecordSchema>;

export interface CleanSighting {
  id: string;
  date: string;
  city: UKCity;
  species: UKSpecies;
  latinName: string;
}

export interface CleaningReport {
  total: number;
  kept: number;
  duplicatesRemoved: number;
  missingFields: number;
  invalidDate: number;
  futureDate: number;
  unknownCity: number;
  unknownSpecies: number;
  latinNameMismatch: number;
}

export interface CleanSightingsResult {
  clean: CleanSighting[];
  report: CleaningReport;
}

export interface CleanSightingsOptions {
  /** Optional override for current timestamp to facilitate deterministic testing */
  now?: Date;
}

/**
 * Cleans an array of raw sightings:
 * - Validates schema with Zod rawRecordSchema (failures count as missingFields)
 * - Trims strings and normalises canonical city and species names
 * - Parses dates explicitly as UTC (including date-only strings as midnight UTC)
 * - Rejects invalid, malformed, or future dates
 * - Tracks invalid records with a detailed breakdown
 * - Keeps records with mismatched latinName and sets canonical mapped Latin name, counting latinNameMismatch
 * - Deduplicates by id and by identical date + city + species
 */
export function cleanSightings(
  raw: unknown,
  options?: CleanSightingsOptions
): CleanSightingsResult {
  if (!Array.isArray(raw)) {
    return {
      clean: [],
      report: {
        total: 0,
        kept: 0,
        duplicatesRemoved: 0,
        missingFields: 0,
        invalidDate: 0,
        futureDate: 0,
        unknownCity: 0,
        unknownSpecies: 0,
        latinNameMismatch: 0,
      },
    };
  }

  const nowTimestamp = options?.now ? options.now.getTime() : Date.now();
  const clean: CleanSighting[] = [];
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();

  let duplicatesRemoved = 0;
  let missingFields = 0;
  let invalidDate = 0;
  let futureDate = 0;
  let unknownCity = 0;
  let unknownSpecies = 0;
  let latinNameMismatch = 0;

  for (const item of raw) {
    // 1. Validate required fields using rawRecordSchema
    const parseResult = rawRecordSchema.safeParse(item);
    if (!parseResult.success) {
      missingFields++;
      continue;
    }

    const rec = parseResult.data;

    // 2. City validation & normalisation (API provides location)
    const cleanCity = normaliseCity(rec.location);
    if (!cleanCity) {
      unknownCity++;
      continue;
    }

    // 3. Species validation & normalisation
    const cleanSpecies = normaliseSpecies(rec.species);
    if (!cleanSpecies) {
      unknownSpecies++;
      continue;
    }

    // 4. Date validation & UTC parsing
    // Accept date-only strings like "2024-05-01" as midnight UTC ("2024-05-01T00:00:00.000Z")
    let dateToParse: string;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rec.date)) {
      dateToParse = `${rec.date}T00:00:00.000Z`;
    } else {
      const hasTz = rec.date.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(rec.date);
      dateToParse = hasTz ? rec.date : `${rec.date}Z`;
    }

    const parsedDate = new Date(dateToParse);

    if (isNaN(parsedDate.getTime())) {
      invalidDate++;
      continue;
    }

    // Calendar rollover check (e.g. 2022-02-31 rolls into March in JS Date)
    const dateParts = rec.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateParts) {
      const year = parseInt(dateParts[1], 10);
      const month = parseInt(dateParts[2], 10);
      const day = parseInt(dateParts[3], 10);
      if (
        parsedDate.getUTCFullYear() !== year ||
        parsedDate.getUTCMonth() + 1 !== month ||
        parsedDate.getUTCDate() !== day
      ) {
        invalidDate++;
        continue;
      }
    }

    // Future date check
    if (parsedDate.getTime() > nowTimestamp) {
      futureDate++;
      continue;
    }

    const isoDate = parsedDate.toISOString();

    // 5. Deduplication
    if (seenIds.has(rec.id)) {
      duplicatesRemoved++;
      continue;
    }

    const signature = `${isoDate}|${cleanCity}|${cleanSpecies}`;
    if (seenSignatures.has(signature)) {
      duplicatesRemoved++;
      continue;
    }

    // 6. Latin name check
    // If latinName doesn't match our species map, keep the record with our mapped Latin name
    // and count it as latinNameMismatch.
    const mappedLatin = SPECIES_MAP[cleanSpecies];
    const rawLatin = rec.latinName || "";
    if (rawLatin !== mappedLatin) {
      latinNameMismatch++;
    }

    // Record is valid and unique
    seenIds.add(rec.id);
    seenSignatures.add(signature);

    clean.push({
      id: rec.id,
      date: isoDate,
      city: cleanCity,
      species: cleanSpecies,
      latinName: mappedLatin,
    });
  }

  // Log warnings when unknown city or unknown species records are found
  if (unknownCity > 0) {
    console.warn(`[cleanSightings] Warning: ${unknownCity} record(s) rejected due to unknown city`);
  }
  if (unknownSpecies > 0) {
    console.warn(`[cleanSightings] Warning: ${unknownSpecies} record(s) rejected due to unknown species`);
  }

  return {
    clean,
    report: {
      total: raw.length,
      kept: clean.length,
      duplicatesRemoved,
      missingFields,
      invalidDate,
      futureDate,
      unknownCity,
      unknownSpecies,
      latinNameMismatch,
    },
  };
}
