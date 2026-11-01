"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { getSpeciesTheme } from "@/lib/species-theme";
import { CITY_COORDINATES } from "@/lib/cities";

// Fit the map to the 14 cities rather than a fixed centre and zoom, so every city is
// visible on any screen size (a fixed zoom cut off most of England on phones).
const CITY_BOUNDS: [number, number][] = Object.values(CITY_COORDINATES).map((c) => [c.latitude, c.longitude]);

export interface RegionData {
  city: string;
  latitude: number;
  longitude: number;
  count: number;
  mostCommonSpecies?: string | null;
}

interface UKMapProps {
  regions: RegionData[];
  selectedCity?: string | null;
  onSelectCity?: (city: string) => void;
}

// Controller component to smoothly pan/zoom when a city is selected
function MapViewController({ selectedCity, regions }: { selectedCity?: string | null; regions: RegionData[] }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedCity) return;
    const target = regions.find((r) => r.city === selectedCity);
    if (target) {
      map.flyTo([target.latitude, target.longitude], 8, { duration: 1.2 });
    }
  }, [selectedCity, regions, map]);

  return null;
}

export default function UKMap({ regions, selectedCity, onSelectCity }: UKMapProps) {
  // The map only ever renders in the browser (ssr: false), so window is always available here.
  const compact = window.matchMedia("(max-width: 640px)").matches;

  return (
    <div className="relative w-full h-[540px] sm:h-[620px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
      <MapContainer
        bounds={CITY_BOUNDS}
        boundsOptions={{ padding: [30, 30] }}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />

        <MapViewController selectedCity={selectedCity} regions={regions} />

        {regions.map((region) => {
          const isSelected = selectedCity === region.city;
          const theme = getSpeciesTheme(region.mostCommonSpecies);
          const hasSightings = region.count > 0;

          // Square-root scaling so area (not radius) tracks the count. Markers are smaller
          // on phones, where full-size circles overlapped across the Midlands.
          const base = hasSightings
            ? Math.max(9, Math.min(32, Math.round(7 + Math.sqrt(region.count) * 2.3)))
            : 5;
          const radius = compact ? Math.max(6, Math.round(base * 0.6)) : base;

          const markerColor = hasSightings ? theme.color : "#94A3B8";

          return (
            <CircleMarker
              key={region.city}
              center={[region.latitude, region.longitude]}
              radius={isSelected ? radius + 4 : radius}
              pathOptions={{
                color: isSelected ? "#0F172A" : markerColor,
                fillColor: markerColor,
                fillOpacity: hasSightings ? (isSelected ? 0.9 : 0.75) : 0.25,
                weight: isSelected ? 3.5 : 2,
              }}
              eventHandlers={{
                click: () => onSelectCity?.(region.city),
              }}
            >
              <Tooltip direction="top" offset={[0, -radius]} opacity={0.95}>
                <div className="text-left font-sans text-xs p-1">
                  <div className="font-bold text-slate-900 flex items-center justify-between gap-3">
                    <span>{region.city}</span>
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {region.count.toLocaleString()} {region.count === 1 ? "sighting" : "sightings"}
                    </span>
                  </div>

                  {hasSightings && region.mostCommonSpecies && (
                    <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-1.5">
                      <span style={{ color: theme.color }} className="font-bold">
                        {theme.symbol}
                      </span>
                      <span>
                        Primary: <strong>{region.mostCommonSpecies}</strong>
                      </span>
                    </div>
                  )}

                  {!hasSightings && (
                    <div className="mt-1 text-[11px] text-slate-400 italic">
                      No sightings reported under current filters
                    </div>
                  )}

                  <div className="mt-1 text-[10px] text-slate-400">
                    Click to view details
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
