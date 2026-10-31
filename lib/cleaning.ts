import { z } from "zod";
import { UK_CITIES, normaliseCity, type UKCity } from "./cities";
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
  location: UKCity;
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
 * - Trims strings
 * - Normalises city names against the 14 UK cities (API provides `location`)
 * - Normalises species against the 5 UK species
 * - Parses dates explicitly as UTC, rejecting invalid, malformed, or future dates
 * - Tracks invalid records with a detailed breakdown (missingFields, invalidDate, futureDate, unknownCity, unknownSpecies)
 * - Keeps records with mismatched latinName and sets canonical mapped Latin name, counting latinNameMismatch
 * - Deduplicates by id and by identical date + location + species
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
    if (!item || typeof item !== "object") {
      missingFields++;
      continue;
    }

    const rec = item as Record<string, unknown>;

    // 1. Required field existence check
    const rawId = typeof rec.id === "string" ? rec.id.trim() : "";
    const rawLocation = typeof rec.location === "string" ? rec.location.trim() : "";
    const rawSpecies = typeof rec.species === "string" ? rec.species.trim() : "";
    const rawDate = typeof rec.date === "string" ? rec.date.trim() : "";

    if (!rawId || !rawLocation || !rawSpecies || !rawDate) {
      missingFields++;
      continue;
    }

    // 2. City validation & normalisation (API provides location)
    const cleanCity = normaliseCity(rawLocation);
    if (!cleanCity) {
      unknownCity++;
      continue;
    }

    // 3. Species validation & normalisation
    const cleanSpecies = normaliseSpecies(rawSpecies);
    if (!cleanSpecies) {
      unknownSpecies++;
      continue;
    }

    // 4. Date validation & UTC parsing
    // Attach 'Z' if missing timezone indicator to ensure timezone-invariant UTC parsing
    const hasTz = rawDate.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(rawDate);
    const dateToParse = hasTz ? rawDate : `${rawDate}Z`;
    const parsedDate = new Date(dateToParse);

    if (isNaN(parsedDate.getTime())) {
      invalidDate++;
      continue;
    }

    // Calendar rollover check (e.g. 2022-02-31 rolls into March in JS Date)
    const dateParts = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
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
    if (seenIds.has(rawId)) {
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
    const rawLatin = typeof rec.latinName === "string" ? rec.latinName.trim() : "";
    if (rawLatin !== mappedLatin) {
      latinNameMismatch++;
    }

    // Record is valid and unique
    seenIds.add(rawId);
    seenSignatures.add(signature);

    clean.push({
      id: rawId,
      date: isoDate,
      location: cleanCity,
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
