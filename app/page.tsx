"use client";

import { useEffect, useState, useCallback, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UKMap, type RegionData } from "@/components/Map";
import { FilterBar, type FilterState } from "@/components/Filters/FilterBar";
import { SpeciesLegend } from "@/components/Legend/SpeciesLegend";
import { StaleBanner } from "@/components/StaleBanner";
import { AlertCircle, RefreshCw, Compass } from "lucide-react";

function buildRegionsUrl(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.species) params.set("species", filters.species);
  if (filters.source && filters.source !== "all") {
    params.set("source", filters.source);
  }
  return `/api/stats/regions?${params.toString()}`;
}

function MapViewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Read initial filter values from URL query string
  const [filters, setFilters] = useState<FilterState>({
    from: searchParams.get("from") || "",
    to: searchParams.get("to") || "",
    species: searchParams.get("species") || "",
    source: searchParams.get("source") || "all",
  });

  const [regions, setRegions] = useState<RegionData[]>([]);
  const [totalSightings, setTotalSightings] = useState<number>(0);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Sync state with URL search parameters
  const updateUrlFilters = useCallback(
    (newFilters: FilterState) => {
      const queryString = buildRegionsUrl(newFilters).split("?")[1] || "";
      const targetUrl = queryString ? `/?${queryString}` : "/";
      startTransition(() => {
        router.replace(targetUrl, { scroll: false });
      });
    },
    [router]
  );

  // Callable from both the effect (on filter change) and the Retry button
  const fetchRegions = useCallback(
    (currentFilters: FilterState) => {
      setIsLoading(true);
      setError(null);
      const url = buildRegionsUrl(currentFilters);
      fetch(url)
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
            throw new Error(body?.error?.message ?? `HTTP error ${res.status}`);
          }
          return res.json() as Promise<{ regions: RegionData[]; total: number; stale: boolean }>;
        })
        .then(({ regions: r, total, stale }) => {
          setRegions(r);
          setTotalSightings(total);
          setIsStale(stale);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Failed to load regional sightings data.";
          setError(msg);
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    []
  );

  // Re-fetch whenever filters change (fetchRegions is stable — no deps)
  useEffect(() => {
    // Data-fetch with async callbacks: setState calls are async (false positive)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRegions(filters);
    // fetchRegions is memoised with no deps and never changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleFilterChange = (updated: Partial<FilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...updated };
      updateUrlFilters(next);
      return next;
    });
  };

  const handleResetFilters = () => {
    const emptyFilters: FilterState = { from: "", to: "", species: "", source: "all" };
    setFilters(emptyFilters);
    updateUrlFilters(emptyFilters);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      <StaleBanner isStale={isStale} />

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page Heading & Context */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              UK Tick Sightings Map
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Explore regional tick distributions across 14 monitored UK cities. Markers are sized by report volume and coloured by dominant species.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-emerald-50 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-200 shadow-2xs">
            <Compass className="w-3.5 h-3.5" />
            <span>14 UK Cities Monitored</span>
          </div>
        </div>

        {/* Filter Controls */}
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          totalSightings={totalSightings}
        />

        {/* Map & Legend Section */}
        <div className="grid grid-cols-1 gap-6">
          {/* Error State */}
          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-red-900">Failed to load map data</h3>
              <p className="text-sm text-red-700 max-w-md mx-auto">{error}</p>
              <button
                type="button"
                onClick={() => fetchRegions(filters)}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          )}

          {/* Interactive Map Display */}
          {!error && (
            <div className="space-y-4">
              <div className="relative">
                <UKMap
                  regions={regions}
                  selectedCity={selectedCity}
                  onSelectCity={(city) => setSelectedCity(city === selectedCity ? null : city)}
                />

                {/* Empty State Banner overlay when 0 sightings match filters */}
                {!isLoading && totalSightings === 0 && (
                  <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-2xs rounded-2xl flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm text-center shadow-xl border border-slate-200 space-y-3 animate-in fade-in">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                        <Compass className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">No Sightings Found</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        No recorded tick sightings match your current filter parameters. Try expanding your date range or selecting all species.
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

              {/* Accessible Legend */}
              <SpeciesLegend
                selectedSpecies={filters.species}
                onSelectSpecies={(species) => handleFilterChange({ species })}
              />
            </div>
          )}
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
          <p className="text-sm font-semibold">Loading TickTrack UK...</p>
        </div>
      }
    >
      <MapViewContent />
    </Suspense>
  );
}
