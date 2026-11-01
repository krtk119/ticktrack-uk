import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";

/**
 * Uploaded photos live outside public/: Next.js only serves files that existed in
 * public/ at build time, so anything uploaded to a production build would 404.
 * They are served instead by app/api/uploads/[name]/route.ts.
 *
 * The turbopackIgnore comments tell the bundler these are runtime paths, so it
 * doesn't try to trace (and bundle) the whole project folder at build time.
 */
export function getUploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "uploads");
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Only names we generated ourselves are valid, which also blocks path traversal (e.g. "../.env"). */
export const UPLOAD_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/**
 * Re-encodes the image with sharp, which drops all metadata (EXIF, including GPS
 * location) by default. rotate() first applies the EXIF orientation so photos
 * don't appear sideways once that metadata is gone.
 */
export async function saveUploadedImage(buffer: Buffer, mimeType: string): Promise<string> {
  const ext = EXTENSIONS[mimeType];
  if (!ext) throw new Error(`Unsupported image type: ${mimeType}`);

  const dir = getUploadDir();
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${ext}`;
  await sharp(buffer).rotate().toFile(path.join(/*turbopackIgnore: true*/ dir, filename));
  return filename;
}

export function uploadUrl(filename: string): string {
  return `/api/uploads/${filename}`;
}
