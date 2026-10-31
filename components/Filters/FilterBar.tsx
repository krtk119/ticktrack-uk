"use client";

import { UK_SPECIES } from "@/lib/species";
import { SPECIES_THEMES } from "@/lib/species-theme";
import { Filter, RotateCcw } from "lucide-react";

import type { MapFilters } from "@/lib/types";

export type FilterState = MapFilters;

interface FilterBarProps {
  filters: FilterState;
  onChange: (updated: Partial<FilterState>) => void;
  onReset: () => void;
  totalSightings?: number;
}

export function FilterBar({ filters, onChange, onReset, totalSightings }: FilterBarProps) {
  const hasActiveFilters = Boolean(
    filters.from || filters.to || filters.species || (filters.source && filters.source !== "all")
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 text-slate-800">
          <Filter className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Filter Sightings</h2>
        </div>

        <div className="flex items-center gap-3">
          {totalSightings !== undefined && (
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              {totalSightings.toLocaleString()} {totalSightings === 1 ? "sighting" : "sightings"}
            </span>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset filters
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* From Date */}
        <div>
          <label htmlFor="filter-from" className="block text-xs font-semibold text-slate-700 mb-1">
            From Date
          </label>
          <div className="relative">
            <input
              id="filter-from"
              type="date"
              value={filters.from}
              onChange={(e) => onChange({ from: e.target.value })}
              max={filters.to || undefined}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* To Date */}
        <div>
          <label htmlFor="filter-to" className="block text-xs font-semibold text-slate-700 mb-1">
            To Date
          </label>
          <div className="relative">
            <input
              id="filter-to"
              type="date"
              value={filters.to}
              onChange={(e) => onChange({ to: e.target.value })}
              min={filters.from || undefined}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Species Filter */}
        <div>
          <label htmlFor="filter-species" className="block text-xs font-semibold text-slate-700 mb-1">
            Species
          </label>
          <select
            id="filter-species"
            value={filters.species}
            onChange={(e) => onChange({ species: e.target.value })}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all cursor-pointer"
          >
            <option value="">All Species (5 types)</option>
            {UK_SPECIES.map((species) => {
              const theme = SPECIES_THEMES[species];
              return (
                <option key={species} value={species}>
                  {theme.symbol} {species} ({theme.latinName})
                </option>
              );
            })}
          </select>
        </div>

        {/* Source Filter */}
        <div>
          <label htmlFor="filter-source" className="block text-xs font-semibold text-slate-700 mb-1">
            Data Source
          </label>
          <select
            id="filter-source"
            value={filters.source}
            onChange={(e) => onChange({ source: e.target.value })}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all cursor-pointer"
          >
            <option value="all">All sources</option>
            <option value="elanco">Elanco dataset</option>
            <option value="community">Community reports (unverified)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
