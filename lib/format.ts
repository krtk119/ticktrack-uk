/**
 * Display helpers. Dates are stored as UTC ISO strings, so they are always
 * formatted in UTC: a sighting on 1 August must not show as 31 July for
 * someone whose browser is in another timezone.
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2023-05" -> "May 2023" */
export function formatPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? singular : plural}`;
}

/** Builds a query string from filter values, skipping empty ones and the "all" source. */
export function buildQuery(values: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (!v) continue;
    if (k === "source" && v === "all") continue;
    params.set(k, v);
  }
  return params.toString();
}
