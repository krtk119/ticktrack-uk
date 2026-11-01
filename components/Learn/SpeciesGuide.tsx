"use client";

import { useJson } from "@/lib/useJson";
import { pluralise } from "@/lib/format";
import { SPECIES_THEMES } from "@/lib/species-theme";
import { UK_SPECIES, type UKSpecies } from "@/lib/species";
import type { SpeciesSummaryResponse } from "@/lib/types";

// Deliberately short and general. These describe each species' usual hosts or habitat,
// not risk, and avoid claims the dataset can't support.
const DESCRIPTIONS: Record<UKSpecies, string> = {
  "Marsh tick": "Named for the damp, marshy habitats it is associated with.",
  "Southern rodent tick": "Associated with small mammals such as mice and voles.",
  "Passerine tick": "Associated with birds. “Passerine” means perching birds, such as thrushes and sparrows.",
  "Tree-hole tick": "Associated with birds that nest in tree holes and nest boxes.",
  "Fox/badger tick": "Associated with foxes and badgers, and can also be found on dogs.",
};

const MONTH_FULL: Record<string, string> = {
  Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June",
  Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December",
};

/** One card per species: a short description plus what our data says about it. */
export function SpeciesGuide() {
  // Summary numbers are calculated on the server, so this page never downloads every sighting.
  const { data, error, isLoading } = useJson<SpeciesSummaryResponse>("/api/stats/species");
  const stats = new Map((data?.species ?? []).map((s) => [s.species, s]));

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          Couldn&apos;t load sighting numbers ({error}). Species descriptions are still shown below.
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {UK_SPECIES.map((species) => {
          const theme = SPECIES_THEMES[species];
          const s = stats.get(species);
          return (
            <li key={species} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
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
                  <p className="text-sm italic text-slate-500">{theme.latinName}</p>
                </div>
              </div>
              <p className="text-sm text-slate-700">{DESCRIPTIONS[species]}</p>
              <dl className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-xs">
                <div>
                  <dt className="text-slate-500">Sightings</dt>
                  <dd className="font-semibold text-slate-900">{isLoading ? "…" : (s?.count ?? 0).toLocaleString("en-GB")}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Most reported in</dt>
                  <dd className="font-semibold text-slate-900">{isLoading ? "…" : s?.topCity ?? "–"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Busiest month</dt>
                  <dd className="font-semibold text-slate-900">{isLoading ? "…" : s?.peakMonth ? MONTH_FULL[s.peakMonth] : "–"}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      {data && (
        <p className="text-xs text-slate-500">
          Numbers are from {pluralise(data.total, "sighting")} in this app (Elanco dataset plus community reports).
        </p>
      )}
    </div>
  );
}
