/**
 * Shapes of our own API responses, shared by the frontend.
 * Type-only, so importing this never pulls server code (SQLite, sharp) into the browser bundle.
 */
export type { Sighting } from "./db";
import type { Sighting } from "./db";

export interface SightingsResponse {
  /** One page of results, newest first. */
  sightings: Sighting[];
  /** Number of sightings matching the filters across all pages. */
  total: number;
  limit: number;
  offset: number;
  stale: boolean;
}

export interface SpeciesSummary {
  species: string;
  latinName: string;
  count: number;
  topCity: string | null;
  peakMonth: string | null;
}

export interface SpeciesSummaryResponse {
  species: SpeciesSummary[];
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
