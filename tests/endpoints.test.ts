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
    // In-memory isolated database for tests
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

    insert.run("s_1", "2023-05-15T10:00:00.000Z", "London", "Marsh tick", "Ixodes apronophorus", "elanco", 1, null, null);
    insert.run("s_2", "2023-05-16T10:00:00.000Z", "London", "Marsh tick", "Ixodes apronophorus", "community", 0, "Garden sighting", null);
    insert.run("s_3", "2023-06-20T14:00:00.000Z", "Manchester", "Tree-hole tick", "Ixodes arboricola", "elanco", 1, null, null);
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
    it("returns Elanco and community sightings with source and verified fields", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/sightings");
      const res = await getSightings(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.sightings.length).toBe(4);
      expect(json.stale).toBe(false);

      const elancoItem = json.sightings.find((s: { id: string }) => s.id === "s_1");
      expect(elancoItem.source).toBe("elanco");
      expect(elancoItem.verified).toBe(true);

      const commItem = json.sightings.find((s: { id: string }) => s.id === "s_2");
      expect(commItem.source).toBe("community");
      expect(commItem.verified).toBe(false);
      expect(commItem.notes).toBe("Garden sighting");
    });

    it("filters sightings by city, species, and source", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/sightings?city=London&species=Marsh%20tick&source=community");
      const res = await getSightings(req);
      const json = await res.json();

      expect(json.sightings.length).toBe(1);
      expect(json.sightings[0].id).toBe("s_2");
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
      // Empty database and failing upstream
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
    it("returns the sighting record when found", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/sightings/s_1");
      const res = await getSightingById(req, { params: Promise.resolve({ id: "s_1" }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.id).toBe("s_1");
      expect(json.city).toBe("London");
      expect(json.species).toBe("Marsh tick");
    });

    it("returns 404 NOT_FOUND error when not found", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/sightings/non_existent");
      const res = await getSightingById(req, { params: Promise.resolve({ id: "non_existent" }) });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe("NOT_FOUND");
      expect(json.stack).toBeUndefined();
    });
  });

  describe("POST /api/sightings", () => {
    it("creates a community sighting with valid fields and returns 201", async () => {
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
      expect(json.species).toBe("Tree-hole tick");
      expect(json.latinName).toBe("Ixodes arboricola");
      expect(json.source).toBe("community");
      expect(json.verified).toBe(false);
      expect(json.notes).toBe("Spotted on an oak tree");
      expect(json.possibleDuplicate).toBe(false);

      // Verify row persisted in SQLite
      const inDb = db.prepare("SELECT * FROM sightings WHERE id = ?").get(json.id);
      expect(inDb).toBeDefined();
    });

    it("returns 400 with field-level errors on invalid inputs", async () => {
      seedTestData();

      const formData = new FormData();
      formData.append("date", "2099-01-01T00:00:00"); // Future date
      formData.append("city", "Paris"); // Unsupported city
      formData.append("species", "Dragon tick"); // Unsupported species
      formData.append("notes", "a".repeat(501)); // Exceeds 500 chars

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
      // s_1 is London, Marsh tick at 2023-05-15T10:00:00.000Z

      const formData = new FormData();
      // Submit sighting 12 hours later in the same city for the same species
      formData.append("date", "2023-05-15T22:00:00");
      formData.append("city", "London");
      formData.append("species", "Marsh tick");

      const req = new NextRequest("http://localhost:3000/api/sightings", {
        method: "POST",
        body: formData,
      });

      const res = await postSightings(req);
      expect(res.status).toBe(201); // Warns, never rejects

      const json = await res.json();
      expect(json.possibleDuplicate).toBe(true);
      expect(json.warning).toContain("already recorded within 1 day");
      expect(json.id).toBeDefined();
    });

    it("processes and strips EXIF metadata from uploaded images with sharp", async () => {
      seedTestData();

      // Create a 100x100 test JPEG buffer with sharp
      const sharp = (await import("sharp")).default;
      const testImageBuffer = await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      const file = new File([testImageBuffer], "tick.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("date", "2023-09-02T10:00:00");
      formData.append("city", "Glasgow");
      formData.append("species", "Fox/badger tick");
      formData.append("image", file);

      const req = new NextRequest("http://localhost:3000/api/sightings", {
        method: "POST",
        body: formData,
      });

      const res = await postSightings(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.imageUrl).toMatch(/^\/uploads\/.+\.jpg$/);

      // Verify the saved file on disk has stripped EXIF
      const path = (await import("path")).default;
      const fs = (await import("fs")).default;
      const savedPath = path.join(process.cwd(), "public", json.imageUrl);
      expect(fs.existsSync(savedPath)).toBe(true);

      const metadata = await sharp(savedPath).metadata();
      expect(metadata.exif).toBeUndefined(); // EXIF metadata stripped

      // Cleanup test file
      fs.unlinkSync(savedPath);
    });
  });

  describe("GET /api/stats/regions", () => {
    it("returns sighting counts per city with latitude and longitude for all 14 cities", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/stats/regions");
      const res = await getRegions(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.regions.length).toBe(14);
      expect(json.total).toBe(4);

      const london = json.regions.find((r: { city: string }) => r.city === "London");
      expect(london.count).toBe(2);
      expect(london.latitude).toBeCloseTo(51.5074, 3);
      expect(london.longitude).toBeCloseTo(-0.1278, 3);

      const cardiff = json.regions.find((r: { city: string }) => r.city === "Cardiff");
      expect(cardiff.count).toBe(0);
      expect(cardiff.latitude).toBeDefined();
    });

    it("filters region counts by species and date range", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/stats/regions?species=Marsh%20tick");
      const res = await getRegions(req);
      const json = await res.json();

      const london = json.regions.find((r: { city: string }) => r.city === "London");
      expect(london.count).toBe(2);

      const manchester = json.regions.find((r: { city: string }) => r.city === "Manchester");
      expect(manchester.count).toBe(0); // Manchester record is Tree-hole tick
    });
  });

  describe("GET /api/stats/trends", () => {
    it("returns trends grouped by month", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/stats/trends?interval=month");
      const res = await getTrends(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.interval).toBe("month");
      expect(json.trends).toEqual([
        { period: "2023-05", count: 2 },
        { period: "2023-06", count: 1 },
        { period: "2023-08", count: 1 },
      ]);
    });

    it("returns trends grouped by week", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/stats/trends?interval=week");
      const res = await getTrends(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.interval).toBe("week");
      expect(json.trends.length).toBeGreaterThan(0);
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
    it("returns counts for all 12 calendar months Jan through Dec", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/stats/seasonal");
      const res = await getSeasonal(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.seasonal.length).toBe(12);

      const may = json.seasonal.find((m: { month: string }) => m.month === "May");
      expect(may.count).toBe(2);

      const jun = json.seasonal.find((m: { month: string }) => m.month === "Jun");
      expect(jun.count).toBe(1);

      const dec = json.seasonal.find((m: { month: string }) => m.month === "Dec");
      expect(dec.count).toBe(0);
    });

    it("filters seasonal trends by city", async () => {
      seedTestData();

      const req = new NextRequest("http://localhost:3000/api/stats/seasonal?city=London");
      const res = await getSeasonal(req);
      const json = await res.json();

      expect(json.city).toBe("London");
      const may = json.seasonal.find((m: { month: string }) => m.month === "May");
      expect(may.count).toBe(2);

      const jun = json.seasonal.find((m: { month: string }) => m.month === "Jun");
      expect(jun.count).toBe(0); // June was Manchester
    });
  });
});
