"use client";

import { useJson } from "@/lib/useJson";
import { pluralise } from "@/lib/format";
import { SPECIES_THEMES } from "@/lib/species-theme";
import { UK_SPECIES } from "@/lib/species";
import { SPECIES_PROFILES } from "@/lib/species-profiles";
import type { SpeciesSummaryResponse } from "@/lib/types";

const MONTH_FULL: Record<string, string> = {
  Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June",
  Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December",
};

/** One card per species: identification facts from UKHSA, plus what our data says about it. */
export function SpeciesGuide() {
  // Summary numbers are calculated on the server, so this page never downloads every sighting.
  const { data, error, isLoading } = useJson<SpeciesSummaryResponse>("/api/stats/species");
  const stats = new Map((data?.species ?? []).map((s) => [s.species, s]));

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          Couldn&apos;t load sighting numbers ({error}). The species information is still shown below.
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {UK_SPECIES.map((species) => {
          const theme = SPECIES_THEMES[species];
          const profile = SPECIES_PROFILES[species];
          const s = stats.get(species);
          return (
            <li
              key={species}
              id={`species-${theme.shape}`}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3 scroll-mt-24"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ backgroundColor: theme.bgLight, color: theme.color }}
                  aria-hidden="true"
                >
                  {theme.symbol}
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">{species}</h3>
                  <p className="text-sm italic text-slate-600">{theme.latinName}</p>
                </div>
              </div>

              <dl className="space-y-1.5 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Usually found on</dt>
                  <dd className="text-slate-800">{profile.hosts}</dd>
                </div>
                {profile.habitat && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Habitat</dt>
                    <dd className="text-slate-800">{profile.habitat}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Recorded in the UK</dt>
                  <dd className="text-slate-800">{profile.ukRange}</dd>
                </div>
                {profile.peopleAndPets && (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">People and pets</dt>
                    <dd className="text-slate-800">{profile.peopleAndPets}</dd>
                  </div>
                )}
              </dl>

              <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs">
                <div>
                  <dt className="text-slate-600">Sightings here</dt>
                  <dd className="font-semibold text-slate-900">{isLoading ? "…" : (s?.count ?? 0).toLocaleString("en-GB")}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">Most reported in</dt>
                  <dd className="font-semibold text-slate-900">{isLoading ? "…" : s?.topCity ?? "–"}</dd>
                </div>
                <div>
                  <dt className="text-slate-600">Busiest month</dt>
                  <dd className="font-semibold text-slate-900">
                    {isLoading ? "…" : s?.peakMonth ? MONTH_FULL[s.peakMonth] : "–"}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-600">
        Species information from{" "}
        <a
          href="https://www.gov.uk/guidance/tick-species-profiles"
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-emerald-800"
        >
          UKHSA&apos;s tick species profiles<span className="sr-only"> (opens in a new tab)</span>
        </a>
        . Sighting figures are from {data ? pluralise(data.total, "sighting") : "the sightings"} in this app.
      </p>
    </div>
  );
}
