/**
 * UK Tick species definitions and Latin name mappings.
 */

export const SPECIES_MAP = {
  "Marsh tick": "Ixodes apronophorus",
  "Southern rodent tick": "Ixodes acuminatus",
  "Passerine tick": "Dermacentor frontalis",
  "Tree-hole tick": "Ixodes arboricola",
  "Fox/badger tick": "Ixodes canisuga",
} as const;

export const UK_SPECIES = Object.keys(SPECIES_MAP) as (keyof typeof SPECIES_MAP)[];
export type UKSpecies = keyof typeof SPECIES_MAP;

/**
 * Normalises an arbitrary species or latin name to canonical common species name.
 */
export function normaliseSpecies(rawSpecies: string | null | undefined): UKSpecies | null {
  if (!rawSpecies || typeof rawSpecies !== "string") {
    return null;
  }
  const trimmed = rawSpecies.trim().toLowerCase();

  // Check common species name
  const commonMatch = UK_SPECIES.find((s) => s.toLowerCase() === trimmed);
  if (commonMatch) return commonMatch;

  // Check latin name mapping
  for (const [common, latin] of Object.entries(SPECIES_MAP)) {
    if (latin.toLowerCase() === trimmed) {
      return common as UKSpecies;
    }
  }

  return null;
}
