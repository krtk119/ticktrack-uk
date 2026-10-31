import { z } from "zod";
import { UK_CITIES, normaliseCity, type UKCity } from "./cities";
import { SPECIES_MAP, normaliseSpecies, type UKSpecies } from "./species";

/**
 * Zod schema for a raw sighting record from the upstream API or raw input.
 */
export const rawRecordSchema = z
  .object({
    id: z.unknown(),
    date: z.unknown(),
    location: z.unknown().optional(),
    city: z.unknown().optional(),
    species: z.unknown(),
    latinName: z.unknown().optional(),
  })
  .refine(
    (data) => {
      // Must contain non-empty id, date, species, and either location or city
      const hasId = typeof data.id === "string" && data.id.trim().length > 0;
      const hasDate = typeof data.date === "string" && data.date.trim().length > 0;
      const hasSpecies = typeof data.species === "string" && data.species.trim().length > 0;
      const loc = typeof data.location === "string" ? data.location.trim() : "";
      const ct = typeof data.city === "string" ? data.city.trim() : "";
      const hasLoc = loc.length > 0 || ct.length > 0;
      return hasId && hasDate && hasSpecies && hasLoc;
    },
    { message: "Missing required sighting fields" }
  );

export type RawRecord = z.infer<typeof rawRecordSchema>;

export interface CleanSighting {
  id: string;
  date: string;
  city: UKCity;
  location: UKCity;
  species: UKSpecies;
  latinName: string;
}

export interface CleaningReport {
  total: number;
  kept: number;
  duplicatesRemoved: number;
  invalidRemoved: number;
  // Snake_case aliases for compatibility
  duplicates_removed: number;
  invalid_removed: number;
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
 * - Normalises city names against the 14 UK cities
 * - Normalises species against the 5 UK species
 * - Validates and parses dates (rejecting unparseable, malformed, or future dates)
 * - Rejects records missing required fields
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
        invalidRemoved: 0,
        duplicates_removed: 0,
        invalid_removed: 0,
      },
    };
  }

  const nowTimestamp = options?.now ? options.now.getTime() : Date.now();
  const clean: CleanSighting[] = [];
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();

  let duplicatesRemoved = 0;
  let invalidRemoved = 0;

  for (const item of raw) {
    if (!item || typeof item !== "object") {
      invalidRemoved++;
      continue;
    }

    const rec = item as Record<string, unknown>;

    // 1. Validate & trim ID
    if (typeof rec.id !== "string" || rec.id.trim().length === 0) {
      invalidRemoved++;
      continue;
    }
    const cleanId = rec.id.trim();

    // 2. Validate & normalise City
    const rawLoc =
      typeof rec.location === "string"
        ? rec.location
        : typeof rec.city === "string"
        ? rec.city
        : null;

    if (!rawLoc || rawLoc.trim().length === 0) {
      invalidRemoved++;
      continue;
    }
    const cleanCity = normaliseCity(rawLoc);
    if (!cleanCity) {
      invalidRemoved++;
      continue;
    }

    // 3. Validate & normalise Species
    if (typeof rec.species !== "string" || rec.species.trim().length === 0) {
      invalidRemoved++;
      continue;
    }
    const cleanSpecies = normaliseSpecies(rec.species);
    if (!cleanSpecies) {
      invalidRemoved++;
      continue;
    }

    // Determine Latin name: use canonical mapping if missing or custom
    const cleanLatinName =
      typeof rec.latinName === "string" && rec.latinName.trim().length > 0
        ? rec.latinName.trim()
        : SPECIES_MAP[cleanSpecies];

    // 4. Validate & parse Date
    if (typeof rec.date !== "string" || rec.date.trim().length === 0) {
      invalidRemoved++;
      continue;
    }
    const trimmedDate = rec.date.trim();

    // Attach UTC 'Z' if missing timezone indicator to ensure timezone-invariant parsing
    const hasTz = trimmedDate.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(trimmedDate);
    const dateToParse = hasTz ? trimmedDate : `${trimmedDate}Z`;
    const parsedDate = new Date(dateToParse);

    if (isNaN(parsedDate.getTime())) {
      invalidRemoved++;
      continue;
    }

    // Check future date
    if (parsedDate.getTime() > nowTimestamp) {
      invalidRemoved++;
      continue;
    }

    // Format consistent ISO string
    const isoDate = parsedDate.toISOString();

    // 5. Deduplication
    // Check duplicate by ID
    if (seenIds.has(cleanId)) {
      duplicatesRemoved++;
      continue;
    }

    // Check duplicate by identical date + city + species
    const signature = `${isoDate}|${cleanCity}|${cleanSpecies}`;
    if (seenSignatures.has(signature)) {
      duplicatesRemoved++;
      continue;
    }

    // Record is clean and unique
    seenIds.add(cleanId);
    seenSignatures.add(signature);

    clean.push({
      id: cleanId,
      date: isoDate,
      city: cleanCity,
      location: cleanCity,
      species: cleanSpecies,
      latinName: cleanLatinName,
    });
  }

  return {
    clean,
    report: {
      total: raw.length,
      kept: clean.length,
      duplicatesRemoved,
      invalidRemoved,
      duplicates_removed: duplicatesRemoved,
      invalid_removed: invalidRemoved,
    },
  };
}
