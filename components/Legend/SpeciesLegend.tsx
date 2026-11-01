import { SPECIES_THEMES } from "@/lib/species-theme";
import { UK_SPECIES } from "@/lib/species";

interface SpeciesLegendProps {
  selectedSpecies?: string;
  onSelectSpecies?: (species: string) => void;
}

export function SpeciesLegend({ selectedSpecies, onSelectSpecies }: SpeciesLegendProps) {
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Species
        </h3>
        <span className="text-[11px] text-slate-600">Each species has its own colour and shape. Select one to filter.</span>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {UK_SPECIES.map((speciesName) => {
          const theme = SPECIES_THEMES[speciesName];
          const isSelected = selectedSpecies === speciesName;

          return (
            <button
              key={speciesName}
              type="button"
              onClick={() => onSelectSpecies?.(isSelected ? "" : speciesName)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                isSelected
                  ? "ring-2 ring-emerald-600 border-slate-400 bg-slate-50 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
              }`}
              title={`Filter by ${theme.name} (${theme.latinName})`}
              aria-pressed={isSelected}
            >
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded text-xs font-bold"
                style={{ color: theme.color }}
                aria-hidden="true"
              >
                {theme.symbol}
              </span>
              <span className="truncate max-w-[140px] sm:max-w-none">{theme.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
