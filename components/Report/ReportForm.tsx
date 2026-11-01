"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, AlertCircle, ImagePlus, X, Loader2 } from "lucide-react";
import { UK_CITIES } from "@/lib/cities";
import { UK_SPECIES } from "@/lib/species";
import { SPECIES_THEMES } from "@/lib/species-theme";
import { buildQuery, formatDate } from "@/lib/format";
import type { Sighting } from "@/lib/types";

// These limits mirror the server's checks in app/api/sightings/route.ts. The server
// always validates again; checking here just gives instant feedback.
const MAX_NOTES = 500;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Field = "date" | "city" | "species" | "notes" | "image";
type FieldErrors = Partial<Record<Field, string>>;

interface CreatedSighting extends Sighting {
  possibleDuplicate: boolean;
  warning?: string;
}

/** Today's date as YYYY-MM-DD in the user's own timezone, for the date input. */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FIELD_LABELS: Record<Field, string> = {
  date: "Date",
  city: "City",
  species: "Species",
  notes: "Notes",
  image: "Photo",
};

export function ReportForm() {
  const [date, setDate] = useState(todayLocal);
  const [city, setCity] = useState("");
  const [species, setSpecies] = useState("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedSighting | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<string | null>(null);

  // Free the photo preview's memory when the form goes away.
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  function setPreview(file: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = file ? URL.createObjectURL(file) : null;
    previewRef.current = url;
    setPreviewUrl(url);
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!date) e.date = "Enter the date you saw the tick.";
    else if (date > todayLocal()) e.date = "The date can't be in the future.";
    if (!city) e.city = "Choose the city where you saw the tick.";
    if (!species) e.species = "Choose the species. Not sure? See the species guide on the Learn page.";
    if (notes.length > MAX_NOTES) e.notes = `Notes must be ${MAX_NOTES} characters or fewer.`;
    if (image) {
      if (!ALLOWED_TYPES.includes(image.type)) e.image = "Photos must be JPEG, PNG or WebP.";
      else if (image.size > MAX_IMAGE_BYTES) e.image = "Photos must be 5 MB or smaller.";
    }
    return e;
  }

  function handleImageChange(file: File | null) {
    setImage(file);
    setPreview(file);
    setErrors((prev) => ({ ...prev, image: undefined }));
  }

  function clearImage() {
    handleImageChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const clientErrors = validate();
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      // Move focus to the error summary so screen-reader users hear what to fix.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    const body = new FormData();
    body.set("date", date);
    body.set("city", city);
    body.set("species", species);
    if (notes.trim()) body.set("notes", notes.trim());
    if (image) body.set("image", image);

    setSubmitting(true);
    try {
      const res = await fetch("/api/sightings", { method: "POST", body });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        // Show the server's own field-level errors: it is the final authority.
        const details = (json?.error?.details ?? {}) as Partial<Record<Field, string[]>>;
        const serverErrors: FieldErrors = {};
        for (const key of Object.keys(details) as Field[]) {
          if (details[key]?.length) serverErrors[key] = details[key]![0];
        }
        setErrors(serverErrors);
        setFormError(json?.error?.message ?? `The report couldn't be saved (HTTP ${res.status}).`);
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }

      setCreated(json as CreatedSighting);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
      requestAnimationFrame(() => summaryRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  }

  function startAnother() {
    setCreated(null);
    setDate(todayLocal());
    setCity("");
    setSpecies("");
    setNotes("");
    clearImage();
    setErrors({});
    setFormError(null);
  }

  if (created) {
    const mapLink = `/?${buildQuery({ city: created.city, source: "community" })}`;
    return (
      <div ref={resultRef} tabIndex={-1} className="space-y-4 focus:outline-none" role="status" aria-live="polite">
        <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-700" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="font-bold text-emerald-900">Thanks, your sighting has been saved</h2>
            <p className="text-sm text-emerald-900">
              {created.species} in {created.city} on {formatDate(created.date)}. It now appears on the map as an
              unverified community report.
            </p>
          </div>
        </div>

        {created.possibleDuplicate && (
          <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <AlertTriangle className="w-6 h-6 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="space-y-1 text-sm text-amber-950">
              <h3 className="font-bold">This might be a duplicate</h3>
              <p>
                A sighting of the same species in the same city was already recorded within a day of this date. Your
                report has still been saved; this is just a flag so duplicates can be spotted. (This is a simple rule
                check, not AI.)
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            href={mapLink}
            className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            See it on the map
          </Link>
          <button
            type="button"
            onClick={startAnother}
            className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer"
          >
            Report another sighting
          </button>
        </div>
      </div>
    );
  }

  const errorList = Object.entries(errors).filter(([, msg]) => msg) as [Field, string][];
  const inputClass = (field: Field) =>
    `w-full text-sm bg-white border rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
      errors[field] ? "border-red-500" : "border-slate-300"
    }`;
  const describedBy = (field: Field, hint?: string) =>
    [hint, errors[field] ? `${field}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {(errorList.length > 0 || formError) && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
        >
          <p className="flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            {formError ?? "Please fix the following:"}
          </p>
          {errorList.length > 0 && (
            <ul className="mt-2 list-disc pl-5 space-y-0.5">
              {errorList.map(([field, msg]) => (
                <li key={field}>
                  <a href={`#${field}`} className="underline">{FIELD_LABELS[field]}</a>: {msg}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="block text-sm font-semibold text-slate-800 mb-1">
            Date seen <span className="text-red-700" aria-hidden="true">*</span>
          </label>
          <input
            id="date"
            type="date"
            required
            value={date}
            max={todayLocal()}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={describedBy("date")}
            className={inputClass("date")}
          />
          {errors.date && <p id="date-error" className="mt-1 text-xs text-red-700">{errors.date}</p>}
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-semibold text-slate-800 mb-1">
            City <span className="text-red-700" aria-hidden="true">*</span>
          </label>
          <select
            id="city"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-invalid={Boolean(errors.city)}
            aria-describedby={describedBy("city", "city-hint")}
            className={`${inputClass("city")} cursor-pointer`}
          >
            <option value="">Choose a city</option>
            {UK_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <p id="city-hint" className="mt-1 text-xs text-slate-500">
            Only the city is recorded, never an exact location.
          </p>
          {errors.city && <p id="city-error" className="mt-1 text-xs text-red-700">{errors.city}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="species" className="block text-sm font-semibold text-slate-800 mb-1">
          Species <span className="text-red-700" aria-hidden="true">*</span>
        </label>
        <select
          id="species"
          required
          value={species}
          onChange={(e) => setSpecies(e.target.value)}
          aria-invalid={Boolean(errors.species)}
          aria-describedby={describedBy("species", "species-hint")}
          className={`${inputClass("species")} cursor-pointer`}
        >
          <option value="">Choose a species</option>
          {UK_SPECIES.map((s) => (
            <option key={s} value={s}>{SPECIES_THEMES[s].symbol} {s} ({SPECIES_THEMES[s].latinName})</option>
          ))}
        </select>
        <p id="species-hint" className="mt-1 text-xs text-slate-500">
          Not sure which one? The <Link href="/learn#identify" className="underline text-emerald-800">identification guide</Link> may help.
        </p>
        {errors.species && <p id="species-error" className="mt-1 text-xs text-red-700">{errors.species}</p>}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="notes" className="block text-sm font-semibold text-slate-800 mb-1">
            Notes <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <span
            id="notes-count"
            className={`text-xs tabular-nums ${notes.length > MAX_NOTES ? "text-red-700 font-semibold" : "text-slate-500"}`}
          >
            {notes.length}/{MAX_NOTES}
          </span>
        </div>
        <textarea
          id="notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-invalid={Boolean(errors.notes)}
          aria-describedby={describedBy("notes", "notes-count")}
          placeholder="e.g. found on my dog after a walk in the park"
          className={inputClass("notes")}
        />
        {errors.notes && <p id="notes-error" className="mt-1 text-xs text-red-700">{errors.notes}</p>}
      </div>

      <div>
        <p id="image-label" className="block text-sm font-semibold text-slate-800 mb-1">
          Photo <span className="font-normal text-slate-500">(optional)</span>
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label
            htmlFor="image"
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-400 bg-white hover:bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 cursor-pointer focus-within:ring-2 focus-within:ring-emerald-600"
          >
            <ImagePlus className="w-5 h-5 text-emerald-700" aria-hidden="true" />
            <span className="sr-only">Photo (optional): </span>
            {image ? "Choose a different photo" : "Choose a photo"}
            <input
              ref={fileInputRef}
              id="image"
              type="file"
              accept={ALLOWED_TYPES.join(",")}
              onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
              aria-invalid={Boolean(errors.image)}
              aria-describedby={describedBy("image", "image-hint")}
              className="sr-only"
            />
          </label>
          {previewUrl && image && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a file the user picked */}
              <img src={previewUrl} alt="Preview of the photo you chose" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
              <div className="text-xs text-slate-600 space-y-1">
                <p className="max-w-[12rem] truncate">{image.name}</p>
                <button
                  type="button"
                  onClick={clearImage}
                  className="inline-flex items-center gap-1 font-semibold text-slate-700 underline cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" /> Remove photo
                </button>
              </div>
            </div>
          )}
        </div>
        <p id="image-hint" className="mt-1 text-xs text-slate-500">
          JPEG, PNG or WebP, up to 5 MB. Location data is removed from photos before they&apos;re stored.
        </p>
        {errors.image && <p id="image-error" className="mt-1 text-xs text-red-700">{errors.image}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-5">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 enabled:cursor-pointer"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {submitting ? "Submitting…" : "Submit sighting"}
        </button>
        <p className="text-xs text-slate-500">
          Reports are shown publicly as unverified community sightings. No account or personal details are collected.
        </p>
      </div>
    </form>
  );
}
