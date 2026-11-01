import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { getDb, initSchema, closeDb } from "@/lib/db";
import { POST as postSightings } from "@/app/api/sightings/route";
import { GET as getUpload } from "@/app/api/uploads/[name]/route";

/** A tiny JPEG carrying EXIF metadata, including a GPS tag, like a phone photo would. */
async function jpegWithGps(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: "#888888" } })
    .jpeg()
    .withExif({
      IFD0: { Copyright: "test" },
      IFD3: { GPSLatitudeRef: "N" },
    })
    .toBuffer();
}

function postWithImage(fields: Record<string, string>, image: Buffer) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("image", new File([new Uint8Array(image)], "tick.jpg", { type: "image/jpeg" }));
  return postSightings(new NextRequest("http://localhost:3000/api/sightings", { method: "POST", body: form }));
}

describe("Photo uploads", () => {
  let uploadDir: string;

  beforeEach(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "ticktrack-uploads-"));
    process.env.UPLOAD_DIR = uploadDir;
    closeDb();
    initSchema(getDb(":memory:"));
  });

  afterEach(() => {
    closeDb();
    delete process.env.UPLOAD_DIR;
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it("strips EXIF metadata, including GPS, before storing a photo", async () => {
    const original = await jpegWithGps();
    // Sanity check: the test image really does carry EXIF data.
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const res = await postWithImage({ date: "2024-05-01", city: "Leeds", species: "Marsh tick" }, original);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.imageUrl).toMatch(/^\/api\/uploads\/[0-9a-f-]{36}\.jpg$/);

    const storedName = json.imageUrl.split("/").pop();
    const stored = fs.readFileSync(path.join(uploadDir, storedName));
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
  });

  it("serves a stored photo through /api/uploads", async () => {
    const res = await postWithImage({ date: "2024-05-01", city: "Leeds", species: "Marsh tick" }, await jpegWithGps());
    const { imageUrl } = await res.json();
    const name = imageUrl.split("/").pop();

    const getRes = await getUpload(new NextRequest(`http://localhost:3000${imageUrl}`), {
      params: Promise.resolve({ name }),
    });
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("refuses names it didn't generate, so paths like ../.env can't be read", async () => {
    for (const name of ["../.env", "..%2F.env", "photo.jpg", "not-a-uuid.png"]) {
      const res = await getUpload(new NextRequest("http://localhost:3000/api/uploads/x"), {
        params: Promise.resolve({ name }),
      });
      expect(res.status).toBe(404);
    }
  });

  it("doesn't save the photo when the rest of the report is invalid", async () => {
    const res = await postWithImage({ date: "2024-05-01", city: "Paris", species: "Marsh tick" }, await jpegWithGps());
    expect(res.status).toBe(400);
    expect(fs.readdirSync(uploadDir)).toHaveLength(0);
  });
});
