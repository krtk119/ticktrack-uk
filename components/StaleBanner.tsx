import { AlertTriangle } from "lucide-react";

interface StaleBannerProps {
  isStale: boolean;
}

export function StaleBanner({ isStale }: StaleBannerProps) {
  if (!isStale) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-500 text-amber-950 border-b border-amber-600/20 px-4 py-2.5 text-sm font-medium shadow-sm transition-all"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-950" aria-hidden="true" />
        <span>
          Showing saved data; the live data source is currently unavailable.
        </span>
      </div>
    </div>
  );
}
