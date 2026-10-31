"use client";

import { useState } from "react";
import { AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useJson } from "@/lib/useJson";
import { buildQuery, formatDate, pluralise } from "@/lib/format";
import { getSpeciesTheme } from "@/lib/species-theme";
import type { MapFilters, SightingsResponse } from "@/lib/types";
import { SourceBadge } from "@/components/SourceBadge";

interface SightingsTableProps {
  filters: MapFilters;
  onSelectCity: (city: string) => void;
}

const PAGE_SIZE = 50;

/**
 * The same filtered data as the map, as a plain table. Maps are hard to use with a
 * keyboard or screen reader, so this is the accessible way to explore the data.
 */
export function SightingsTable({ filters, onSelectCity }: SightingsTableProps) {
  const query = buildQuery({ ...filters });
  const { data, error, isLoading, retry } = useJson<SightingsResponse>(`/api/sightings?${query}`);
  const [page, setPage] = useState({ query, index: 0 });

  // Changing filters sends you back to page 1 (derived, not set in an effect).
  const pageIndex = page.query === query ? page.index : 0;
  const rows = data?.sightings ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);

  if (error) {
    return (
      <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3 text-red-800">
        <AlertCircle className="w-6 h-6 mx-auto" aria-hidden="true" />
        <p className="font-semibold">Couldn&apos;t load the sightings list</p>
        <p className="text-sm">{error}</p>
        <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 text-sm font-semibold underline cursor-pointer">
          <RefreshCw className="w-4 h-4" aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div role="status" className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-600">
        Loading sightings…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-600">
        No sightings match the current filters.
      </div>
    );
  }

  const goTo = (index: number) => setPage({ query, index });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <caption className="sr-only">
            Tick sightings matching the current filters, newest first. Showing {visible.length} of {rows.length}.
          </caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Date</th>
              <th scope="col" className="px-4 py-3 font-semibold">City</th>
              <th scope="col" className="px-4 py-3 font-semibold">Species</th>
              <th scope="col" className="px-4 py-3 font-semibold hidden md:table-cell">Latin name</th>
              <th scope="col" className="px-4 py-3 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((s) => {
              const theme = getSpeciesTheme(s.species);
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">
                    <time dateTime={s.date}>{formatDate(s.date)}</time>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectCity(s.city)}
                      className="font-semibold text-emerald-800 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded cursor-pointer"
                    >
                      {s.city}
                      <span className="sr-only"> (open city details)</span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-800">
                    <span style={{ color: theme.color }} aria-hidden="true">{theme.symbol}</span> {s.species}
                  </td>
                  <td className="px-4 py-2.5 italic text-slate-500 hidden md:table-cell">{s.latinName}</td>
                  <td className="px-4 py-2.5"><SourceBadge source={s.source} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav aria-label="Table pages" className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
        <span>
          {pluralise(rows.length, "sighting")} · page {pageIndex + 1} of {pageCount}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => goTo(pageIndex - 1)}
            disabled={pageIndex === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold disabled:opacity-40 enabled:hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 enabled:cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> Previous
          </button>
          <button
            type="button"
            onClick={() => goTo(pageIndex + 1)}
            disabled={pageIndex >= pageCount - 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold disabled:opacity-40 enabled:hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 enabled:cursor-pointer"
          >
            Next <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
  );
}
