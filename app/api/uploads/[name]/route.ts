import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getUploadDir, UPLOAD_NAME_PATTERN, CONTENT_TYPES } from "@/lib/uploads";
import { jsonError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** GET /api/uploads/[name] — serves a stored sighting photo. */
export async function GET(_request: NextRequest, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;

  if (!UPLOAD_NAME_PATTERN.test(name)) {
    return jsonError("NOT_FOUND", "Image not found", 404);
  }

  try {
    const file = await fs.readFile(path.join(/*turbopackIgnore: true*/ getUploadDir(), name));
    const ext = name.split(".").pop() as string;
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext],
        // Filenames are random and never reused, so the file can be cached indefinitely.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonError("NOT_FOUND", "Image not found", 404);
  }
}
