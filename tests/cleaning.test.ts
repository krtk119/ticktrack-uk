import { describe, it, expect } from "vitest";
import {
  rawRecordSchema,
  cleanSightings,
  type CleanSighting,
} from "@/lib/cleaning";

describe("Phase 1: Raw Record Schema", () => {
  it("validates a complete raw sighting record", () => {
    const raw = {
      id: "rec_123",
      date: "2023-05-10T12:00:00",
      location: "London",
      species: "Marsh tick",
      latinName: "Ixodes apronophorus",
    };

    const parsed = rawRecordSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it("accepts city field instead of location", () => {
    const raw = {
      id: "rec_123",
      date: "2023-05-10T12:00:00",
      city: "Manchester",
      species: "Tree-hole tick",
    };

    const parsed = rawRecordSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it("rejects record missing id", () => {
    const raw = {
      date: "2023-05-10T12:00:00",
      location: "London",
      species: "Marsh tick",
    };
    const parsed = rawRecordSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it("rejects record missing date", () => {
    const raw = {
      id: "rec_123",
      location: "London",
      species: "Marsh tick",
    };
    const parsed = rawRecordSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it("rejects record missing location and city", () => {
    const raw = {
      id: "rec_123",
      date: "2023-05-10T12:00:00",
      species: "Marsh tick",
    };
    const parsed = rawRecordSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it("rejects record missing species", () => {
    const raw = {
      id: "rec_123",
      date: "2023-05-10T12:00:00",
      location: "London",
    };
    const parsed = rawRecordSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });
});

describe("Phase 1: cleanSightings Pipeline", () => {
  const fixedNow = new Date("2024-01-01T00:00:00.000Z");

  it("trims strings and normalises canonical city and species names", () => {
    const raw = [
      {
        id: "  id_001  ",
        date: "  2023-04-15T10:30:00  ",
        location: "  london  ",
        species: "  marsh tick  ",
        latinName: "  Ixodes apronophorus  ",
      },
      {
        id: "id_002",
        date: "2023-06-20T14:00:00",
        city: "MANCHESTER",
        species: "TREE-HOLE TICK",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.total).toBe(2);
    expect(report.kept).toBe(2);
    expect(report.invalidRemoved).toBe(0);
    expect(report.duplicatesRemoved).toBe(0);

    expect(clean[0]).toMatchObject({
      id: "id_001",
      city: "London",
      location: "London",
      species: "Marsh tick",
      latinName: "Ixodes apronophorus",
    });

    expect(clean[1]).toMatchObject({
      id: "id_002",
      city: "Manchester",
      location: "Manchester",
      species: "Tree-hole tick",
      latinName: "Ixodes arboricola",
    });
  });

  it("rejects invalid or future dates", () => {
    const raw = [
      {
        id: "valid_past",
        date: "2023-08-01T12:00:00",
        location: "Bristol",
        species: "Passerine tick",
      },
      {
        id: "invalid_unparseable",
        date: "not-a-valid-date",
        location: "Bristol",
        species: "Passerine tick",
      },
      {
        id: "invalid_empty_date",
        date: "   ",
        location: "Bristol",
        species: "Passerine tick",
      },
      {
        id: "invalid_future",
        date: "2025-01-01T00:00:00",
        location: "Bristol",
        species: "Passerine tick",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.total).toBe(4);
    expect(report.kept).toBe(1);
    expect(report.invalidRemoved).toBe(3);
    expect(clean[0].id).toBe("valid_past");
  });

  it("rejects records with unknown cities or unknown species", () => {
    const raw = [
      {
        id: "bad_city",
        date: "2023-05-01T10:00:00",
        location: "Paris", // Not in 14 UK cities
        species: "Marsh tick",
      },
      {
        id: "bad_species",
        date: "2023-05-01T10:00:00",
        location: "Glasgow",
        species: "Alien tick", // Not in 5 UK species
      },
      {
        id: "empty_city",
        date: "2023-05-01T10:00:00",
        location: "   ",
        species: "Marsh tick",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.total).toBe(3);
    expect(report.kept).toBe(0);
    expect(report.invalidRemoved).toBe(3);
    expect(clean.length).toBe(0);
  });

  it("rejects non-object records and records missing required fields", () => {
    const raw = [
      null,
      undefined,
      "a string instead of object",
      123,
      { id: "missing_fields" },
      { id: "missing_date", location: "London", species: "Marsh tick" },
      { date: "2023-01-01T00:00:00", location: "London", species: "Marsh tick" },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.total).toBe(7);
    expect(report.kept).toBe(0);
    expect(report.invalidRemoved).toBe(7);
  });

  it("deduplicates records with the same id", () => {
    const raw = [
      {
        id: "duplicate_id",
        date: "2023-01-10T10:00:00",
        location: "Cardiff",
        species: "Fox/badger tick",
      },
      {
        id: "duplicate_id", // Same ID
        date: "2023-02-15T11:00:00",
        location: "Edinburgh",
        species: "Marsh tick",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.total).toBe(2);
    expect(report.kept).toBe(1);
    expect(report.duplicatesRemoved).toBe(1);
    expect(clean[0].id).toBe("duplicate_id");
    expect(clean[0].city).toBe("Cardiff");
  });

  it("deduplicates records with identical date + city + species even if IDs differ", () => {
    const raw = [
      {
        id: "id_alpha",
        date: "2023-07-04T12:00:00",
        location: "Newcastle",
        species: "Southern rodent tick",
      },
      {
        id: "id_beta", // Different ID, but same date + city + species
        date: "2023-07-04T12:00:00",
        location: "Newcastle",
        species: "Southern rodent tick",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.total).toBe(2);
    expect(report.kept).toBe(1);
    expect(report.duplicatesRemoved).toBe(1);
    expect(clean[0].id).toBe("id_alpha");
  });

  it("preserves records that differ in species or date at the same city", () => {
    const raw = [
      {
        id: "rec_1",
        date: "2023-07-04T12:00:00",
        location: "Leeds",
        species: "Southern rodent tick",
      },
      {
        id: "rec_2", // Same date & city, different species
        date: "2023-07-04T12:00:00",
        location: "Leeds",
        species: "Tree-hole tick",
      },
      {
        id: "rec_3", // Same city & species, different date
        date: "2023-07-05T12:00:00",
        location: "Leeds",
        species: "Southern rodent tick",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.total).toBe(3);
    expect(report.kept).toBe(3);
    expect(report.duplicatesRemoved).toBe(0);
    expect(report.invalidRemoved).toBe(0);
  });

  it("handles non-array inputs gracefully", () => {
    // @ts-expect-error test invalid invocation
    const { clean, report } = cleanSightings("not-an-array");
    expect(clean).toEqual([]);
    expect(report.total).toBe(0);
    expect(report.kept).toBe(0);
  });
});
