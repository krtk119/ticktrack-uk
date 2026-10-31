"use client";

import { useCallback, useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, RefreshCw, Compass, Map as MapIcon, List } from "lucide-react";
import { UKMap, type RegionData } from "@/components/Map";
import { FilterBar } from "@/components/Filters/FilterBar";
import { SpeciesLegend } from "@/components/Legend/SpeciesLegend";
import { StaleBanner } from "@/components/StaleBanner";
import { CityPanel } from "@/components/CityPanel/CityPanel";
import { SightingsTable } from "@/components/ListView/SightingsTable";
import { useJson } from "@/lib/useJson";
import { buildQuery } from "@/lib/format";
import { normaliseCity } from "@/lib/cities";
import type { MapFilters } from "@/lib/types";

type View = "map" | "list";

interface RegionsResponse {
  regions: RegionData[];
  total: number;
  stale: boolean;
}

const EMPTY_FILTERS: MapFilters = { from: "", to: "", species: "", source: "all" };

function MapViewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Filters, the open city and the view all live in the URL, so any view can be shared or bookmarked.
  const [filters, setFilters] = useState<MapFilters>({
    from: searchParams.get("from") || "",
    to: searchParams.get("to") || "",
    species: searchParams.get("species") || "",
    source: searchParams.get("source") || "all",
  });
  const [selectedCity, setSelectedCity] = useState<string | null>(normaliseCity(searchParams.get("city")));
  const [view, setView] = useState<View>(searchParams.get("view") === "list" ? "list" : "map");

  const syncUrl = useCallback(
    (nextFilters: MapFilters, nextCity: string | null, nextView: View) => {
      const qs = buildQuery({ ...nextFilters, city: nextCity, view: nextView === "list" ? "list" : null });
      startTransition(() => {
        router.replace(qs ? `/?${qs}` : "/", { scroll: false });
      });
    },
    [router]
  );

  const regionsQuery = buildQuery({ ...filters });
  const regions = useJson<RegionsResponse>(`/api/stats/regions?${regionsQuery}`);
  const totalSightings = regions.data?.total ?? 0;

  const handleFilterChange = (updated: Partial<MapFilters>) => {
    const next = { ...filters, ...updated };
    setFilters(next);
    syncUrl(next, selectedCity, view);
  };

  const handleResetFilters = () => {
    setFilters(EMPTY_FILTERS);
    syncUrl(EMPTY_FILTERS, selectedCity, view);
  };

  const handleSelectCity = (city: string | null) => {
    setSelectedCity(city);
    syncUrl(filters, city, view);
  };

  const handleViewChange = (next: View) => {
    setView(next);
    syncUrl(filters, selectedCity, next);
  };

  const closePanel = useCallback(() => {
    setSelectedCity(null);
    syncUrl(filters, null, view);
  }, [filters, view, syncUrl]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      <StaleBanner isStale={Boolean(regions.data?.stale)} />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              UK Tick Sightings
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Reported tick sightings across 14 UK cities. Markers are sized by number of reports and coloured by the most
              commonly reported species. Select a city for details.
            </p>
          </div>

          <div role="group" aria-label="Choose view" className="flex self-start md:self-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {([
              { value: "map", label: "Map", Icon: MapIcon },
              { value: "list", label: "List", Icon: List },
            ] as const).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleViewChange(value)}
                aria-pressed={view === value}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  view === value ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {label} view
              </button>
            ))}
          </div>
        </div>

        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          totalSightings={regions.data ? totalSightings : undefined}
        />

        <div className={`grid grid-cols-1 gap-6 ${selectedCity ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
          <div className="space-y-4 min-w-0">
            {view === "list" ? (
              <SightingsTable filters={filters} onSelectCity={(city) => handleSelectCity(city)} />
            ) : regions.error ? (
              <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" aria-hidden="true" />
                </div>
                <h2 className="text-base font-bold text-red-900">Failed to load map data</h2>
                <p className="text-sm text-red-700 max-w-md mx-auto">{regions.error}</p>
                <button
                  type="button"
                  onClick={regions.retry}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <UKMap
                    regions={regions.data?.regions ?? []}
                    selectedCity={selectedCity}
                    onSelectCity={(city) => handleSelectCity(city === selectedCity ? null : city)}
                  />

                  {regions.data && totalSightings === 0 && (
                    <div className="absolute inset-0 z-20 bg-slate-900/40 rounded-2xl flex items-center justify-center p-4">
                      <div className="bg-white rounded-2xl p-6 max-w-sm text-center shadow-xl border border-slate-200 space-y-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                          <Compass className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <h2 className="font-bold text-slate-800 text-sm">No sightings found</h2>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          No sightings match your current filters. Try widening the date range or selecting all species.
                        </p>
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        >
                          Reset filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <SpeciesLegend
                  selectedSpecies={filters.species}
                  onSelectSpecies={(species) => handleFilterChange({ species })}
                />
              </>
            )}
          </div>

          {selectedCity && <CityPanel city={selectedCity} filters={filters} onClose={closePanel} />}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">
          <div className="w-10 h-10 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold">Loading TickTrack UK…</p>
        </div>
      }
    >
      <MapViewContent />
    </Suspense>
  );
}
