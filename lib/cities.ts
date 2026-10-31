/**
 * UK Cities supported by TickTrack UK.
 * Contains canonical city names and geographic coordinates for spatial queries and mapping.
 */

export interface CityCoordinates {
  name: string;
  latitude: number;
  longitude: number;
}

export const UK_CITIES: readonly string[] = [
  "London",
  "Manchester",
  "Glasgow",
  "Bristol",
  "Birmingham",
  "Liverpool",
  "Edinburgh",
  "Cardiff",
  "Sheffield",
  "Leicester",
  "Leeds",
  "Southampton",
  "Newcastle",
  "Nottingham",
] as const;

export type UKCity = (typeof UK_CITIES)[number];

export const CITY_COORDINATES: Record<UKCity, { latitude: number; longitude: number }> = {
  London: { latitude: 51.5074, longitude: -0.1278 },
  Manchester: { latitude: 53.4808, longitude: -2.2426 },
  Glasgow: { latitude: 55.8642, longitude: -4.2518 },
  Bristol: { latitude: 51.4545, longitude: -2.5879 },
  Birmingham: { latitude: 52.4862, longitude: -1.8904 },
  Liverpool: { latitude: 53.4084, longitude: -2.9916 },
  Edinburgh: { latitude: 55.9533, longitude: -3.1883 },
  Cardiff: { latitude: 51.4816, longitude: -3.1791 },
  Sheffield: { latitude: 53.3811, longitude: -1.4701 },
  Leicester: { latitude: 52.6369, longitude: -1.1398 },
  Leeds: { latitude: 53.8008, longitude: -1.5491 },
  Southampton: { latitude: 50.9097, longitude: -1.4044 },
  Newcastle: { latitude: 54.9783, longitude: -1.6178 },
  Nottingham: { latitude: 52.9548, longitude: -1.1581 },
};

/**
 * Normalises an arbitrary city string to the canonical UK city name.
 * Returns null if not recognized among the 14 supported cities.
 */
export function normaliseCity(rawCity: string | null | undefined): UKCity | null {
  if (!rawCity || typeof rawCity !== "string") {
    return null;
  }
  const trimmed = rawCity.trim().toLowerCase();
  const match = UK_CITIES.find((c) => c.toLowerCase() === trimmed);
  return (match as UKCity) || null;
}
