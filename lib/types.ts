/**
 * Shapes of our own API responses, shared by the frontend.
 * Type-only, so importing this never pulls server code (SQLite, sharp) into the browser bundle.
 */
export type { Sighting } from "./db";
import type { Sighting } from "./db";

export interface SightingsResponse {
  sightings: Sighting[];
  total: number;
  stale: boolean;
}

export interface TrendPoint {
  period: string;
  count: number;
}

export interface TrendsResponse {
  interval: "week" | "month";
  trends: TrendPoint[];
  total: number;
  stale: boolean;
}

export interface SeasonalResponse {
  city: string | null;
  months: { month: string; monthNumber: number; count: number }[];
  total: number;
  stale: boolean;
}

export interface MapFilters {
  from: string;
  to: string;
  species: string;
  source: string;
}
