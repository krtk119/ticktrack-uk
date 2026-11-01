import type { UKSpecies } from "./species";

/**
 * Identification facts for each species, taken from UKHSA's tick species profiles:
 * https://www.gov.uk/guidance/tick-species-profiles
 * Only what that page states is included; nothing is filled in by guesswork.
 */
export interface SpeciesProfile {
  /** Animals it is usually found on. */
  hosts: string;
  /** Where it lives, when UKHSA describes it. */
  habitat?: string;
  /** Where in the UK it has been recorded. */
  ukRange: string;
  /** Only set when UKHSA mentions people or pets. */
  peopleAndPets?: string;
  /** Answers in the "where did you find it?" helper that point to this species. */
  foundOn: FoundOn[];
}

export type FoundOn = "dog" | "fox-badger" | "bird" | "nest-box" | "rodent" | "wetland" | "person";

export const SPECIES_PROFILES: Record<UKSpecies, SpeciesProfile> = {
  "Marsh tick": {
    hosts: "Water voles (and, historically, coypu)",
    habitat: "Wetlands",
    ukRange: "Recorded in Kent, the Norfolk Broads and Wicken Fen",
    foundOn: ["wetland", "rodent"],
  },
  "Southern rodent tick": {
    hosts: "Small rodents",
    habitat: "Lives in the burrows of small rodents",
    ukRange: "Mainly southern England, including the Isles of Scilly, Cornwall and Devon",
    foundOn: ["rodent"],
  },
  "Passerine tick": {
    hosts: "Birds only, especially perching birds (passerines)",
    habitat: "Picked up by birds feeding on the ground under roosts",
    ukRange: "England, with newer records in Wales",
    peopleAndPets: "Sometimes found feeding on people",
    foundOn: ["bird", "person"],
  },
  "Tree-hole tick": {
    hosts: "Birds that nest in tree holes, such as great tits and blue tits",
    habitat: "Tree holes and similar nest sites",
    ukRange: "Mostly England, with a few records in Wales and one site in Scotland",
    foundOn: ["bird", "nest-box"],
  },
  "Fox/badger tick": {
    hosts: "Badgers, foxes and domestic dogs",
    ukRange: "Widespread throughout the UK",
    peopleAndPets: "Commonly found on dogs",
    foundOn: ["dog", "fox-badger"],
  },
};

export const FOUND_ON_OPTIONS: { value: FoundOn; label: string }[] = [
  { value: "dog", label: "On a dog" },
  { value: "person", label: "On a person" },
  { value: "fox-badger", label: "On a fox or badger" },
  { value: "bird", label: "On a bird" },
  { value: "nest-box", label: "In a nest box or tree hole" },
  { value: "rodent", label: "On a mouse, vole or other small rodent" },
  { value: "wetland", label: "In a wetland or marsh area" },
];
