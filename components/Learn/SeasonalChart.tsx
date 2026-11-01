"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useJson } from "@/lib/useJson";
import { UK_CITIES } from "@/lib/cities";
import { pluralise } from "@/lib/format";
import type { SeasonalResponse } from "@/lib/types";

/** Sightings by month of the year, for all cities or one city. */
export function SeasonalChart() {
  const [city, setCity] = useState("");
  const { data, error, isLoading, retry } = useJson<SeasonalResponse>(
    `/api/stats/seasonal${city ? `?city=${encodeURIComponent(city)}` : ""}`
  );
  const place = city || "all 14 cities";
  const busiest = data?.months.reduce((a, b) => (b.count > a.count ? b : a), data.months[0]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor="seasonal-city" className="block text-xs font-semibold text-slate-700 mb-1">
            Location
          </label>
          <select
            id="seasonal-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="">All cities</option>
            {UK_CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {data && (
          <p className="text-sm text-slate-600" aria-live="polite">
            {pluralise(data.total, "sighting")} in {place}
            {busiest && data.total > 0 ? `, most in ${busiest.month}` : ""}
          </p>
        )}
      </div>

      {error ? (
        <div role="alert" className="text-sm text-red-700 space-y-1">
          <p>Couldn&apos;t load seasonal data: {error}</p>
          <button type="button" onClick={retry} className="underline font-semibold cursor-pointer">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="h-64 rounded-xl bg-slate-100 animate-pulse" role="status" aria-label="Loading chart" />
      ) : (
        <div className="h-64" role="img" aria-label={`Bar chart of sightings by month of the year in ${place}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.months ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [v, "Sightings"]} />
              <Bar dataKey="count" fill="#047857" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3">
        <strong>Reading this chart:</strong> sightings in this dataset are spread fairly evenly across the year, so it
        doesn&apos;t show a strong seasonal pattern. In the real world, UKHSA reports that ticks can be active all year,
        with nymphs (the stage most linked to Lyme disease) peaking from April to June and activity rising again in
        early autumn.
      </p>
    </div>
  );
}
