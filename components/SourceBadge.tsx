import type { Sighting } from "@/lib/types";

/** Makes the difference between Elanco's dataset and unverified community reports visible everywhere a record is shown. */
export function SourceBadge({ source }: { source: Sighting["source"] }) {
  if (source === "community") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
        Community · unverified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
      Elanco dataset
    </span>
  );
}
