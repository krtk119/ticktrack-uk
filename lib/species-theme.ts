import { UKSpecies, SPECIES_MAP } from "./species";

export interface SpeciesTheme {
  name: UKSpecies;
  latinName: string;
  color: string;
  textColor: string;
  bgLight: string;
  border: string;
  shape: "circle" | "square" | "triangle" | "diamond" | "hexagon";
  symbol: string;
}

/**
 * Colour-blind-safe Okabe-Ito palette paired with distinct geometric shapes
 * so that species are never distinguished by color alone.
 */
export const SPECIES_THEMES: Record<UKSpecies, SpeciesTheme> = {
  "Marsh tick": {
    name: "Marsh tick",
    latinName: SPECIES_MAP["Marsh tick"],
    color: "#0072B2", // Deep Blue
    textColor: "#004B75",
    bgLight: "#EFF6FF",
    border: "#93C5FD",
    shape: "circle",
    symbol: "●",
  },
  "Southern rodent tick": {
    name: "Southern rodent tick",
    latinName: SPECIES_MAP["Southern rodent tick"],
    color: "#E69F00", // Warm Orange
    textColor: "#8A5A00",
    bgLight: "#FFFBEB",
    border: "#FCD34D",
    shape: "square",
    symbol: "■",
  },
  "Passerine tick": {
    name: "Passerine tick",
    latinName: SPECIES_MAP["Passerine tick"],
    color: "#009E73", // Bluish Green
    textColor: "#005E44",
    bgLight: "#ECFDF5",
    border: "#6EE7B7",
    shape: "triangle",
    symbol: "▲",
  },
  "Tree-hole tick": {
    name: "Tree-hole tick",
    latinName: SPECIES_MAP["Tree-hole tick"],
    color: "#D55E00", // Vermillion
    textColor: "#803500",
    bgLight: "#FEF2F2",
    border: "#FCA5A5",
    shape: "diamond",
    symbol: "◆",
  },
  "Fox/badger tick": {
    name: "Fox/badger tick",
    latinName: SPECIES_MAP["Fox/badger tick"],
    color: "#CC79A7", // Reddish Purple
    textColor: "#783E5E",
    bgLight: "#FAF5FF",
    border: "#D8B4FE",
    shape: "hexagon",
    symbol: "⬢",
  },
};

export function getSpeciesTheme(species: string | null | undefined): SpeciesTheme {
  if (species && species in SPECIES_THEMES) {
    return SPECIES_THEMES[species as UKSpecies];
  }
  // Neutral fallback
  return {
    name: "Marsh tick",
    latinName: "Unknown",
    color: "#4B5563",
    textColor: "#1F2937",
    bgLight: "#F3F4F6",
    border: "#D1D5DB",
    shape: "circle",
    symbol: "●",
  };
}
