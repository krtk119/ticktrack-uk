"use client";

import { useState } from "react";
import { Microscope, Mail } from "lucide-react";
import { SPECIES_THEMES } from "@/lib/species-theme";
import { UK_SPECIES } from "@/lib/species";
import { FOUND_ON_OPTIONS, SPECIES_PROFILES, type FoundOn } from "@/lib/species-profiles";

/**
 * Narrows down the species by where the tick was found, using the hosts and habitats
 * UKHSA lists for each one. It deliberately doesn't claim to identify a tick by its
 * looks: most UK ticks can only be told apart under magnification.
 */
export function IdentifyHelper() {
  const [foundOn, setFoundOn] = useState<FoundOn | "">("");

  const matches = foundOn ? UK_SPECIES.filter((s) => SPECIES_PROFILES[s].foundOn.includes(foundOn)) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <label htmlFor="found-on" className="block text-sm font-semibold text-slate-800 mb-1">
            Where did you find the tick?
          </label>
          <select
            id="found-on"
            value={foundOn}
            onChange={(e) => setFoundOn(e.target.value as FoundOn | "")}
            className="w-full text-sm bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="">Choose one</option>
            {FOUND_ON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div aria-live="polite" className="space-y-2 text-sm">
          {foundOn && (
            <>
              <p className="font-semibold text-slate-800">
                {matches.length === 1 ? "Of the species in this app, it may be:" : "Of the species in this app, it may be one of:"}
              </p>
              <ul className="space-y-1.5">
                {matches.map((s) => {
                  const theme = SPECIES_THEMES[s];
                  return (
                    <li key={s}>
                      <a
                        href={`#species-${theme.shape}`}
                        className="inline-flex items-center gap-2 font-semibold text-emerald-800 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded"
                      >
                        <span style={{ color: theme.color }} aria-hidden="true">{theme.symbol}</span>
                        {s}
                      </a>
                      <span className="text-slate-600"> · usually on {SPECIES_PROFILES[s].hosts.toLowerCase()}</span>
                    </li>
                  );
                })}
              </ul>
              {(foundOn === "dog" || foundOn === "person") && (
                <p className="text-slate-700 bg-sky-50 border border-sky-200 rounded-xl p-3">
                  Most ticks found on people and pets in the UK are <em>Ixodes ricinus</em> (the sheep or deer tick),
                  which UKHSA describes as the most abundant and widespread UK tick. It isn&apos;t one of the species in
                  this dataset.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 text-sm text-slate-700">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Microscope className="w-5 h-5 text-emerald-700" aria-hidden="true" />
          Why this can only narrow it down
        </h3>
        <p>
          UK tick species look very similar to the naked eye, especially when small or partly fed. Telling them apart
          reliably means examining them under magnification, so where a tick was found is a more useful clue than how
          it looks.
        </p>
        <h3 className="font-bold text-slate-900 flex items-center gap-2 pt-1">
          <Mail className="w-5 h-5 text-emerald-700" aria-hidden="true" />
          Get it identified by experts
        </h3>
        <p>
          UKHSA&apos;s Tick Surveillance Scheme identifies ticks that the public send in and emails back the species,
          usually within 2 weeks. You pay the postage.{" "}
          <a
            href="https://www.gov.uk/tick-recording-scheme"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-emerald-800 font-semibold"
          >
            How to send a tick<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </div>
    </div>
  );
}
