import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { UK_SPECIES } from "@/lib/species";
import { SPECIES_THEMES, getSpeciesTheme } from "@/lib/species-theme";
import { getDb, initSchema, closeDb, type Db } from "@/lib/db";
import { GET as getRegions } from "@/app/api/stats/regions/route";

describe("Phase F1: Species Palette & Accessibility", () => {
  it("defines color-blind-safe Okabe-Ito colors and distinct geometric shapes for all 5 species", () => {
    expect(UK_SPECIES.length).toBe(5);

    const usedShapes = new Set<string>();
    const usedColors = new Set<string>();

    for (const species of UK_SPECIES) {
      const theme = SPECIES_THEMES[species];
      expect(theme).toBeDefined();
      expect(theme.name).toBe(species);
      expect(theme.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.symbol).toBeDefined();

      // Ensure no duplicate shapes so we never rely on color alone
      expect(usedShapes.has(theme.shape)).toBe(false);
      usedShapes.add(theme.shape);
      usedColors.add(theme.color);
    }

    expect(usedShapes.size).toBe(5);
    expect(usedColors.size).toBe(5);
  });

  it("returns fallback theme for unknown species", () => {
    const fallback = getSpeciesTheme("Nonexistent species");
    expect(fallback.name).toBe("Marsh tick");
    expect(fallback.color).toBe("#4B5563");
  });
});

describe("Phase F1: Regional Stats with Dominant Species", () => {
  let db: Db;

  beforeEach(() => {
    closeDb();
    db = getDb(":memory:");
    initSchema(db);
  });

  afterEach(() => {
    closeDb();
  });

  it("calculates mostCommonSpecies for each city under given filters", async () => {
    const insert = db.prepare(`
      INSERT INTO sightings (id, date, city, species, latinName, source, verified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // London: 2 Marsh ticks, 1 Tree-hole tick -> dominant is Marsh tick
    insert.run("l1", "2023-05-01T10:00:00.000Z", "London", "Marsh tick", "Ixodes apronophorus", "elanco", 1);
    insert.run("l2", "2023-05-02T10:00:00.000Z", "London", "Marsh tick", "Ixodes apronophorus", "community", 0);
    insert.run("l3", "2023-05-03T10:00:00.000Z", "London", "Tree-hole tick", "Ixodes arboricola", "elanco", 1);

    // Manchester: 2 Passerine ticks -> dominant is Passerine tick
    insert.run("m1", "2023-05-01T10:00:00.000Z", "Manchester", "Passerine tick", "Dermacentor frontalis", "elanco", 1);
    insert.run("m2", "2023-05-02T10:00:00.000Z", "Manchester", "Passerine tick", "Dermacentor frontalis", "elanco", 1);

    const nowIso = new Date().toISOString();
    db.prepare("INSERT INTO sync_meta (key, value, updated_at) VALUES ('last_synced_at', ?, ?)").run(nowIso, nowIso);

    const req = new NextRequest("http://localhost:3000/api/stats/regions");
    const res = await getRegions(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    const london = json.regions.find((r: { city: string }) => r.city === "London");
    expect(london.count).toBe(3);
    expect(london.mostCommonSpecies).toBe("Marsh tick");

    const manchester = json.regions.find((r: { city: string }) => r.city === "Manchester");
    expect(manchester.count).toBe(2);
    expect(manchester.mostCommonSpecies).toBe("Passerine tick");

    const cardiff = json.regions.find((r: { city: string }) => r.city === "Cardiff");
    expect(cardiff.count).toBe(0);
    expect(cardiff.mostCommonSpecies).toBeNull();
  });
});
