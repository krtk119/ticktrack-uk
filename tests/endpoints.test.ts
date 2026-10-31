import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { getDb, initSchema, closeDb } from "@/lib/db";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getSightings, POST as postSightings } from "@/app/api/sightings/route";
import { GET as getSightingById } from "@/app/api/sightings/[id]/route";
import { GET as getRegions } from "@/app/api/stats/regions/route";
import { GET as getTrends } from "@/app/api/stats/trends/route";
import { GET as getSeasonal } from "@/app/api/stats/seasonal/route";

describe("Phase 3: Route Handlers Endpoints", () => {
  let db: Database.Database;

  beforeEach(() => {
    closeDb();
    db = getDb(":memory:");
    initSchema(db);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    closeDb();
    vi.restoreAllMocks();
  });

  const seedTestData = () => {
    const insert = db.prepare(`
      INSERT INTO sightings (id, date, city, species, latinName, source, verified, notes, imageUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // S_1 & S_2 in May 2023
    insert.run("s_1", "2023-05-15T10:00:00.000Z", "London", "Marsh tick", "Ixodes apronophorus", "elanco", 1, null, null);
    insert.run("s_2", "2023-05-16T10:00:00.000Z", "London", "Marsh tick", "Ixodes apronophorus", "community", 0, "Garden sighting", null);
    // S_3 in June 2023
    insert.run("s_3", "2023-06-20T14:00:00.000Z", "Manchester", "Tree-hole tick", "Ixodes arboricola", "elanco", 1, null, null);
    // Note: July 2023 has 0 sightings to test gap-filling
    // S_4 in August 2023
    insert.run("s_4", "2023-08-10T12:00:00.000Z", "Bristol", "Passerine tick", "Dermacentor frontalis", "community", 0, null, "/uploads/photo.jpg");

    // Add recent sync meta so ensureSynced doesn't trigger a network call
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO sync_meta (key, value, updated_at) VALUES ('last_synced_at', ?, ?)
    `).run(nowIso, nowIso);
  };

  describe("GET /api/health", () => {
    it("reports healthy when database and upstream are available", async () => {
      seedTestData();

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ status: "healthy" }),
        })
      );

      const res = await getHealth();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("healthy");
      expect(json.database.status).toBe("connected");
      expect(json.database.sightingsCount).toBe(4);
      expect(json.upstream.status).toBe("available");
    });

    it("reports degraded when upstream is unavailable but database is connected", async () => {
      seedTestData();

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Timeout")));

      const res = await getHealth();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("degraded");
      expect(json.database.status).toBe("connected");
      expect(json.upstream.status).toBe("unavailable");
    });
  });

  describe("GET /api/sightings", () => {
    it("returns Elanco and community sightings with source and verified fields, descriptive key only, no location", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/sightings");
      const res = await getSightings(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.sightings.length).toBe(4);
      expect(json.stale).toBe(false);
      expect("data" in json).toBe(false); // No duplicate data key

      const elancoItem = json.sightings.find((s: { id: string }) => s.id === "s_1");
      expect(elancoItem.source).toBe("elanco");
      expect(elancoItem.verified).toBe(true);
      expect(elancoItem.city).toBe("London");
      expect("location" in elancoItem).toBe(false); // Location is gone, city only

      const commItem = json.sightings.find((s: { id: string }) => s.id === "s_2");
      expect(commItem.source).toBe("community");
      expect(commItem.verified).toBe(false);
      expect(commItem.notes).toBe("Garden sighting");
      expect("location" in commItem).toBe(false);
    });

    it("filters sightings by city, species, and source", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/sightings?city=London&species=Marsh%20tick&source=community");
      const res = await getSightings(req);
      const json = await res.json();

      expect(json.sightings.length).toBe(1);
      expect(json.sightings[0].id).toBe("s_2");
    });

    it("returns 400 when filtering by an unknown city or unknown species", async () => {
      seedTestData();

      const badCityReq = new NextRequest("http://localhost:3000/api/sightings?city=Paris");
      const badCityRes = await getSightings(badCityReq);
      expect(badCityRes.status).toBe(400);

      const badCityJson = await badCityRes.json();
      expect(badCityJson.error.code).toBe("INVALID_PARAMETER");
      expect(badCityJson.error.message).toContain("Unknown city 'Paris'");
      expect(badCityJson.error.message).toContain("Valid cities are:");

      const badSpeciesReq = new NextRequest("http://localhost:3000/api/sightings?species=Dragon%20tick");
      const badSpeciesRes = await getSightings(badSpeciesReq);
      expect(badSpeciesRes.status).toBe(400);

      const badSpeciesJson = await badSpeciesRes.json();
      expect(badSpeciesJson.error.code).toBe("INVALID_PARAMETER");
      expect(badSpeciesJson.error.message).toContain("Unknown species 'Dragon tick'");
      expect(badSpeciesJson.error.message).toContain("Valid species are:");
    });

    it("filters sightings by from and to date ranges", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/sightings?from=2023-06-01&to=2023-07-01");
      const res = await getSightings(req);
      const json = await res.json();

      expect(json.sightings.length).toBe(1);
      expect(json.sightings[0].id).toBe("s_3");
    });

    it("returns 503 SERVICE_UNAVAILABLE when DB is empty and upstream is down", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Upstream dead")));

      const req = new NextRequest("http://localhost:3000/api/sightings");
      const res = await getSightings(req);
      expect(res.status).toBe(503);

      const json = await res.json();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe("SERVICE_UNAVAILABLE");
      expect(json.error.message).toContain("Upstream Elanco API is unavailable");
      expect(json.stack).toBeUndefined();
    });
  });

  describe("GET /api/sightings/[id]", () => {
    it("returns the sighting record without location key", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/sightings/s_1");
      const res = await getSightingById(req, { params: Promise.resolve({ id: "s_1" }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.id).toBe("s_1");
      expect(json.city).toBe("London");
      expect("location" in json).toBe(false);
      expect(json.species).toBe("Marsh tick");
    });

    it("returns 404 NOT_FOUND error when not found", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/sightings/non_existent");
      const res = await getSightingById(req, { params: Promise.resolve({ id: "non_existent" }) });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/sightings", () => {
    it("creates a community sighting with valid fields and returns 201 without location key", async () => {
      seedTestData();

      const formData = new FormData();
      formData.append("date", "2023-09-01T10:00:00");
      formData.append("city", "Cardiff");
      formData.append("species", "Tree-hole tick");
      formData.append("notes", "Spotted on an oak tree");

      const req = new NextRequest("http://localhost:3000/api/sightings", {
        method: "POST",
        body: formData,
      });

      const res = await postSightings(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.id).toMatch(/^comm_/);
      expect(json.city).toBe("Cardiff");
      expect("location" in json).toBe(false);
      expect(json.species).toBe("Tree-hole tick");
      expect(json.latinName).toBe("Ixodes arboricola");
      expect(json.source).toBe("community");
      expect(json.verified).toBe(false);
      expect(json.notes).toBe("Spotted on an oak tree");
      expect(json.possibleDuplicate).toBe(false);
    });

    it("returns 400 with field-level errors on invalid inputs", async () => {
      seedTestData();

      const formData = new FormData();
      formData.append("date", "2099-01-01T00:00:00");
      formData.append("city", "Paris");
      formData.append("species", "Dragon tick");
      formData.append("notes", "a".repeat(501));

      const req = new NextRequest("http://localhost:3000/api/sightings", {
        method: "POST",
        body: formData,
      });

      const res = await postSightings(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.details.date).toBeDefined();
      expect(json.error.details.city).toBeDefined();
      expect(json.error.details.species).toBeDefined();
      expect(json.error.details.notes).toBeDefined();
    });

    it("warns about possibleDuplicate when same city + species exists within 1 day, without rejecting", async () => {
      seedTestData();

      const formData = new FormData();
      formData.append("date", "2023-05-15T22:00:00");
      formData.append("city", "London");
      formData.append("species", "Marsh tick");

      const req = new NextRequest("http://localhost:3000/api/sightings", {
        method: "POST",
        body: formData,
      });

      const res = await postSightings(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.possibleDuplicate).toBe(true);
      expect(json.warning).toContain("already recorded within 1 day");
    });
  });

  describe("GET /api/stats/regions", () => {
    it("returns sighting counts per city with descriptive key 'regions' only, no data key", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/stats/regions");
      const res = await getRegions(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.regions.length).toBe(14);
      expect("data" in json).toBe(false);
      expect(json.total).toBe(4);

      const london = json.regions.find((r: { city: string }) => r.city === "London");
      expect(london.count).toBe(2);
      expect(london.latitude).toBeCloseTo(51.5074, 3);
    });

    it("returns 400 when filtering by an unknown species", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/stats/regions?species=Alien%20tick");
      const res = await getRegions(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe("INVALID_PARAMETER");
      expect(json.error.message).toContain("Unknown species 'Alien tick'");
      expect(json.error.message).toContain("Valid species are:");
    });
  });

  describe("GET /api/stats/trends", () => {
    it("fills zero-count periods between first and last sighting so charts don't skip gaps", async () => {
      seedTestData();
      // s_1, s_2 are in 2023-05 (count 2)
      // s_3 is in 2023-06 (count 1)
      // July 2023 has 0 sightings
      // s_4 is in 2023-08 (count 1)

      const req = new NextRequest("http://localhost:3000/api/stats/trends?interval=month");
      const res = await getTrends(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.interval).toBe("month");
      expect("data" in json).toBe(false); // Only 'trends', no 'data'

      // July 2023 must be present with count 0
      expect(json.trends).toEqual([
        { period: "2023-05", count: 2 },
        { period: "2023-06", count: 1 },
        { period: "2023-07", count: 0 },
        { period: "2023-08", count: 1 },
      ]);
      expect(json.total).toBe(4);
    });

    it("fills zero-count periods for the entire from/to requested date range", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/stats/trends?interval=month&from=2023-04-01&to=2023-09-30");
      const res = await getTrends(req);
      const json = await res.json();

      expect(json.trends.map((t: { period: string }) => t.period)).toEqual([
        "2023-04",
        "2023-05",
        "2023-06",
        "2023-07",
        "2023-08",
        "2023-09",
      ]);

      const apr = json.trends.find((t: { period: string }) => t.period === "2023-04");
      expect(apr.count).toBe(0);
      const jul = json.trends.find((t: { period: string }) => t.period === "2023-07");
      expect(jul.count).toBe(0);
      const sep = json.trends.find((t: { period: string }) => t.period === "2023-09");
      expect(sep.count).toBe(0);
    });

    it("returns 400 for unknown city or unknown species in trends filter", async () => {
      seedTestData();

      const badCityReq = new NextRequest("http://localhost:3000/api/stats/trends?city=Paris");
      const badCityRes = await getTrends(badCityReq);
      expect(badCityRes.status).toBe(400);
      const cityJson = await badCityRes.json();
      expect(cityJson.error.message).toContain("Unknown city 'Paris'");

      const badSpeciesReq = new NextRequest("http://localhost:3000/api/stats/trends?species=Alien%20tick");
      const badSpeciesRes = await getTrends(badSpeciesReq);
      expect(badSpeciesRes.status).toBe(400);
      const speciesJson = await badSpeciesRes.json();
      expect(speciesJson.error.message).toContain("Unknown species 'Alien tick'");
    });

    it("returns 400 for invalid interval parameter", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/stats/trends?interval=year");
      const res = await getTrends(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe("INVALID_PARAMETER");
    });
  });

  describe("GET /api/stats/seasonal", () => {
    it("returns counts with descriptive key 'months' only, no data key", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/stats/seasonal");
      const res = await getSeasonal(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.months.length).toBe(12);
      expect("data" in json).toBe(false);
      expect("seasonal" in json).toBe(false);

      const may = json.months.find((m: { month: string }) => m.month === "May");
      expect(may.count).toBe(2);

      const jul = json.months.find((m: { month: string }) => m.month === "Jul");
      expect(jul.count).toBe(0);
    });

    it("returns 400 for unknown city in seasonal filter", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/stats/seasonal?city=Paris");
      const res = await getSeasonal(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe("INVALID_PARAMETER");
      expect(json.error.message).toContain("Unknown city 'Paris'");
      expect(json.error.message).toContain("Valid cities are:");
    });
  });
});
