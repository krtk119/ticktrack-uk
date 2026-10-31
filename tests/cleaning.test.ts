import { describe, it, expect, vi } from "vitest";
import {
  rawRecordSchema,
  cleanSightings,
} from "@/lib/cleaning";

describe("Raw Record Schema", () => {
  it("validates a complete raw sighting record with location", () => {
    const raw = {
      id: "rec_123",
      date: "2022-08-01T06:40:31",
      location: "London",
      species: "Marsh tick",
      latinName: "Ixodes apronophorus",
    };

    const parsed = rawRecordSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toBe("rec_123");
      expect(parsed.data.location).toBe("London");
    }
  });

  it("rejects record missing location", () => {
    const raw = {
      id: "rec_123",
      date: "2022-08-01T06:40:31",
      species: "Marsh tick",
    };
    const parsed = rawRecordSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it("rejects record missing id", () => {
    const raw = {
      date: "2022-08-01T06:40:31",
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

  it("rejects record missing species", () => {
    const raw = {
      id: "rec_123",
      date: "2022-08-01T06:40:31",
      location: "London",
    };
    const parsed = rawRecordSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });
});

describe("cleanSightings UTC Date Parsing", () => {
  const fixedNow = new Date("2024-06-01T00:00:00.000Z");

  it("parses dates explicitly as UTC so 2022-08-01T00:30:00 stays on 1 August regardless of local timezone", () => {
    // Under Europe/London (BST = UTC+1 in August), a local parse of 00:30:00 would roll back to 31 July 23:30 UTC
    const raw = [
      {
        id: "utc_test_1",
        date: "2022-08-01T00:30:00",
        location: "London",
        species: "Marsh tick",
        latinName: "Ixodes apronophorus",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.kept).toBe(1);
    expect(clean[0].date).toBe("2022-08-01T00:30:00.000Z");

    const parsedUtc = new Date(clean[0].date);
    expect(parsedUtc.getUTCFullYear()).toBe(2022);
    expect(parsedUtc.getUTCMonth()).toBe(7); // August (0-indexed)
    expect(parsedUtc.getUTCDate()).toBe(1); // 1st August
  });

  it("accepts date-only strings like 2024-05-01 and treats them as midnight UTC", () => {
    const raw = [
      {
        id: "date_only_1",
        date: "2024-05-01",
        location: "Edinburgh",
        species: "Passerine tick",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.kept).toBe(1);
    expect(clean[0].date).toBe("2024-05-01T00:00:00.000Z");

    const parsedUtc = new Date(clean[0].date);
    expect(parsedUtc.getUTCFullYear()).toBe(2024);
    expect(parsedUtc.getUTCMonth()).toBe(4); // May
    expect(parsedUtc.getUTCDate()).toBe(1);
  });
});

describe("cleanSightings Trimming, Case Normalisation & Field Integrity", () => {
  const fixedNow = new Date("2024-06-01T00:00:00.000Z");

  it("trims strings and normalises casing for ' london ' -> 'London' and ' marsh TICK ' -> 'Marsh tick'", () => {
    const raw = [
      {
        id: "  id_spaced  ",
        date: "  2023-04-15T10:30:00  ",
        location: " london ",
        species: " marsh TICK ",
        latinName: "  Ixodes apronophorus  ",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.kept).toBe(1);
    expect(clean[0].city).toBe("London");
    expect(clean[0].species).toBe("Marsh tick");
    expect(clean[0].latinName).toBe("Ixodes apronophorus");
  });

  it("ensures a fully valid record comes out with every field correct and clean report", () => {
    const raw = [
      {
        id: "rec_perfect_1",
        date: "2023-06-15T10:30:00",
        location: "Manchester",
        species: "Passerine tick",
        latinName: "Dermacentor frontalis",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report).toEqual({
      total: 1,
      kept: 1,
      duplicatesRemoved: 0,
      missingFields: 0,
      invalidDate: 0,
      futureDate: 0,
      unknownCity: 0,
      unknownSpecies: 0,
      latinNameMismatch: 0,
    });

    expect(clean[0]).toEqual({
      id: "rec_perfect_1",
      date: "2023-06-15T10:30:00.000Z",
      city: "Manchester",
      species: "Passerine tick",
      latinName: "Dermacentor frontalis",
    });

    // Verify duplicate location field is removed from CleanSighting
    expect("location" in clean[0]).toBe(false);
  });
});

describe("cleanSightings Breakdown & Validation", () => {
  const fixedNow = new Date("2024-01-01T00:00:00.000Z");

  it("reports missingFields for missing/empty required attributes and non-objects", () => {
    const raw = [
      null,
      undefined,
      "not an object",
      {},
      { id: "1", date: "2023-01-01T00:00:00", species: "Marsh tick" }, // missing location
      { id: "2", location: "London", species: "Marsh tick" }, // missing date
      { date: "2023-01-01T00:00:00", location: "London", species: "Marsh tick" }, // missing id
      { id: "3", date: "2023-01-01T00:00:00", location: "London" }, // missing species
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.total).toBe(8);
    expect(report.kept).toBe(0);
    expect(report.missingFields).toBe(8);
    expect(clean.length).toBe(0);
  });

  it("reports invalidDate for unparseable dates or calendar rollovers", () => {
    const raw = [
      {
        id: "inv_1",
        date: "invalid-date-string",
        location: "London",
        species: "Marsh tick",
      },
      {
        id: "inv_2",
        date: "2022-02-31T00:00:00", // invalid February day rollover
        location: "London",
        species: "Marsh tick",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.total).toBe(2);
    expect(report.kept).toBe(0);
    expect(report.invalidDate).toBe(2);
  });

  it("reports futureDate for records after the reference timestamp", () => {
    const raw = [
      {
        id: "fut_1",
        date: "2024-06-01T12:00:00", // after fixedNow (2024-01-01)
        location: "Manchester",
        species: "Tree-hole tick",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.total).toBe(1);
    expect(report.kept).toBe(0);
    expect(report.futureDate).toBe(1);
  });

  it("reports unknownCity, logs a warning, and rejects the record", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const raw = [
      {
        id: "city_bad",
        date: "2023-05-01T12:00:00",
        location: "Paris", // Not in 14 UK cities
        species: "Passerine tick",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.unknownCity).toBe(1);
    expect(report.kept).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("rejected due to unknown city")
    );

    warnSpy.mockRestore();
  });

  it("reports unknownSpecies, logs a warning, and rejects the record", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const raw = [
      {
        id: "species_bad",
        date: "2023-05-01T12:00:00",
        location: "Bristol",
        species: "Alien tick", // Not in 5 UK species
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.unknownSpecies).toBe(1);
    expect(report.kept).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("rejected due to unknown species")
    );

    warnSpy.mockRestore();
  });

  it("keeps record with mapped Latin name and counts latinNameMismatch when latinName differs", () => {
    const raw = [
      {
        id: "mismatch_1",
        date: "2023-04-10T09:00:00",
        location: "Glasgow",
        species: "Marsh tick",
        latinName: "Incorrect latin name",
      },
      {
        id: "mismatch_2",
        date: "2023-04-11T09:00:00",
        location: "Glasgow",
        species: "Tree-hole tick",
        // latinName omitted
      },
      {
        id: "match_1",
        date: "2023-04-12T09:00:00",
        location: "Glasgow",
        species: "Passerine tick",
        latinName: "Dermacentor frontalis", // Exactly matches mapped name
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.kept).toBe(3);
    expect(report.latinNameMismatch).toBe(2);

    expect(clean[0].latinName).toBe("Ixodes apronophorus");
    expect(clean[1].latinName).toBe("Ixodes arboricola");
    expect(clean[2].latinName).toBe("Dermacentor frontalis");
  });

  it("deduplicates records with duplicate id or identical date + city + species", () => {
    const raw = [
      {
        id: "dup_id",
        date: "2023-02-01T10:00:00",
        location: "Cardiff",
        species: "Fox/badger tick",
      },
      {
        id: "dup_id", // duplicate ID
        date: "2023-02-02T10:00:00",
        location: "Edinburgh",
        species: "Marsh tick",
      },
      {
        id: "dup_sig_1",
        date: "2023-03-01T12:00:00",
        location: "Liverpool",
        species: "Passerine tick",
      },
      {
        id: "dup_sig_2", // different ID, identical date + city + species
        date: "2023-03-01T12:00:00",
        location: "Liverpool",
        species: "Passerine tick",
      },
    ];

    const { clean, report } = cleanSightings(raw, { now: fixedNow });

    expect(report.total).toBe(4);
    expect(report.kept).toBe(2);
    expect(report.duplicatesRemoved).toBe(2);
    expect(clean.map((c) => c.id)).toEqual(["dup_id", "dup_sig_1"]);
  });
});
