"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { X, Navigation, Share2, AlertCircle, RefreshCw } from "lucide-react";
import { useJson } from "@/lib/useJson";
import { buildQuery, formatDate, formatPeriod, pluralise } from "@/lib/format";
import { getSpeciesTheme } from "@/lib/species-theme";
import type { MapFilters, SightingsResponse, SpeciesSummaryResponse, TrendsResponse } from "@/lib/types";
import { SourceBadge } from "@/components/SourceBadge";

interface CityPanelProps {
  city: string;
  filters: MapFilters;
  onClose: () => void;
}

const RECENT_LIMIT = 20;

export function CityPanel({ city, filters, onClose }: CityPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [timelineView, setTimelineView] = useState<"year" | "month">("year");
  const [shareStatus, setShareStatus] = useState<string>("");

  // The panel uses exactly the same filters as the map, so its numbers always match the marker.
  const query = buildQuery({ ...filters, city });
  // Only the 20 most recent records are downloaded; counts come from aggregate endpoints.
  const sightings = useJson<SightingsResponse>(`/api/sightings?${query}&limit=${RECENT_LIMIT}`);
  const speciesStats = useJson<SpeciesSummaryResponse>(`/api/stats/species?${query}`);
  const trends = useJson<TrendsResponse>(`/api/stats/trends?interval=month&${query}`);

  // Move focus to the panel when a city is opened, so keyboard and screen-reader users land on it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [city]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const speciesBreakdown = useMemo(
    () =>
      (speciesStats.data?.species ?? [])
        // The summary covers every species, so apply the map's species filter here.
        .filter((s) => s.count > 0 && (!filters.species || s.species === filters.species))
        .map((s) => ({ name: s.species, count: s.count }))
        .sort((a, b) => b.count - a.count),
    [speciesStats.data, filters.species]
  );

  // ~0.5 sightings per city per month, so a yearly view is the readable default;
  // the monthly view is still available for detail.
  const timeline = useMemo(() => {
    const points = trends.data?.trends ?? [];
    if (timelineView === "month") {
      return points.map((p) => ({ label: formatPeriod(p.period), count: p.count }));
    }
    const byYear = new Map<string, number>();
    for (const p of points) {
      const year = p.period.slice(0, 4);
      byYear.set(year, (byYear.get(year) ?? 0) + p.count);
    }
    return Array.from(byYear, ([label, count]) => ({ label, count }));
  }, [trends.data, timelineView]);

  const total = sightings.data?.total ?? 0;
  const maxSpecies = speciesBreakdown[0]?.count ?? 1;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${city}, UK`)}`;

  async function handleShare() {
    const url = `${window.location.origin}/?${query}`;
    const shareData = { title: `Tick sightings in ${city} – TickTrack UK`, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus("");
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareStatus("Link copied to clipboard");
    } catch (err) {
      // The user closing the share sheet isn't an error worth showing.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setShareStatus("Couldn't share automatically. Copy the link from the address bar.");
    }
  }

  return (
    <aside
      aria-labelledby="city-panel-heading"
      className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col max-h-none lg:max-h-[620px] overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">City details</p>
          <h2
            id="city-panel-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-extrabold text-slate-900 focus:outline-none"
          >
            {city}
          </h2>
          <p className="text-sm text-slate-600" aria-live="polite">
            {sightings.isLoading ? "Loading sightings…" : pluralise(total, "sighting")}
            {" "}matching your filters
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${city} details`}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2 px-4 py-3 border-b border-slate-100">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
          Get directions
          <span className="sr-only">(opens Google Maps in a new tab)</span>
        </a>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
          Share this view
        </button>
      </div>
      <p className="px-4 text-xs text-emerald-800 min-h-0" role="status" aria-live="polite">
        {shareStatus}
      </p>

      <div className="overflow-y-auto p-4 space-y-6">
        {sightings.error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 space-y-2">
            <p className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              Couldn&apos;t load sightings for {city}
            </p>
            <p>{sightings.error}</p>
            <button
              type="button"
              onClick={sightings.retry}
              className="inline-flex items-center gap-1.5 text-xs font-semibold underline cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Try again
            </button>
          </div>
        ) : sightings.isLoading ? (
          <div className="space-y-3" aria-hidden="true">
            <div className="h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
            <div className="h-32 rounded bg-slate-100 animate-pulse" />
          </div>
        ) : total === 0 ? (
          <p className="text-sm text-slate-600">
            No sightings in {city} match the current filters. Try widening the date range or choosing all species.
          </p>
        ) : (
          <>
            <section aria-labelledby="species-breakdown-heading" className="space-y-2">
              <h3 id="species-breakdown-heading" className="text-sm font-bold text-slate-800">
                By species
              </h3>
              <ul className="space-y-1.5">
                {speciesBreakdown.map(({ name, count }) => {
                  const theme = getSpeciesTheme(name);
                  return (
                    <li key={name} className="text-xs">
                      <div className="flex justify-between gap-2 text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <span style={{ color: theme.color }} aria-hidden="true">{theme.symbol}</span>
                          {name}
                        </span>
                        <span className="font-semibold tabular-nums">{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${(count / maxSpecies) * 100}%`, backgroundColor: theme.color }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="timeline-heading" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 id="timeline-heading" className="text-sm font-bold text-slate-800">
                  Activity over time
                </h3>
                <div role="group" aria-label="Timeline grouping" className="flex rounded-lg border border-slate-200 p-0.5 text-[11px] font-semibold">
                  {(["year", "month"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTimelineView(v)}
                      aria-pressed={timelineView === v}
                      className={`px-2 py-1 rounded-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                        timelineView === v ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      By {v}
                    </button>
                  ))}
                </div>
              </div>
              {trends.error ? (
                <p className="text-xs text-red-700">Couldn&apos;t load the timeline: {trends.error}</p>
              ) : (
                <div className="h-44" role="img" aria-label={`Bar chart of ${city} sightings by ${timelineView}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeline} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={12} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => [v, "Sightings"]} />
                      <Bar dataKey="count" fill="#047857" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section aria-labelledby="recent-heading" className="space-y-2">
              <h3 id="recent-heading" className="text-sm font-bold text-slate-800">
                Most recent {Math.min(RECENT_LIMIT, total)}
              </h3>
              <ul className="divide-y divide-slate-100">
                {(sightings.data?.sightings ?? []).slice(0, RECENT_LIMIT).map((s) => {
                  const theme = getSpeciesTheme(s.species);
                  return (
                    <li key={s.id} className="py-2 flex gap-3 items-start">
                      {s.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- user uploads of unknown size; next/image would need fixed dimensions
                        <img
                          src={s.imageUrl}
                          alt={`Photo submitted with a ${s.species} sighting`}
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      )}
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                          <span style={{ color: theme.color }} aria-hidden="true">{theme.symbol}</span>
                          {s.species}
                        </p>
                        <p className="text-xs italic text-slate-500">{s.latinName}</p>
                        <p className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                          <time dateTime={s.date}>{formatDate(s.date)}</time>
                          <SourceBadge source={s.source} />
                        </p>
                        {s.notes && <p className="text-xs text-slate-600">&ldquo;{s.notes}&rdquo;</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
