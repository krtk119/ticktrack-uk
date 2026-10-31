"use client";

import dynamic from "next/dynamic";
import type { RegionData } from "./UKMap";

export type { RegionData };

function MapLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading interactive UK map"
      className="w-full h-[540px] sm:h-[620px] rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-6 text-center animate-pulse"
    >
      <div className="w-12 h-12 rounded-full border-4 border-emerald-600/20 border-t-emerald-600 animate-spin mb-4" />
      <p className="text-sm font-semibold text-slate-700">Loading map…</p>
      <p className="text-xs text-slate-400 mt-1">Rendering OpenStreetMap tiles and regional coordinates</p>
    </div>
  );
}

export const UKMap = dynamic(() => import("./UKMap"), {
  ssr: false,
  loading: () => <MapLoadingSkeleton />,
});
