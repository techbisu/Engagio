import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import {
  uploadImage,
  fileToBuffer,
  isCloudinaryConfigured,
  getStorageStatus,
} from "@/lib/storage";

/**
 * /api/upload
 *
 * Central image-upload endpoint for the entire app. The browser POSTs a
 * multipart/form-data body with `file` + `folder`, and this route forwards
 * the file to Cloudinary (signed upload via the server SDK). When
 * Cloudinary env vars aren't configured, it falls back to returning a
 * base64 data URL so dev environments without external storage still work.
 *
 * All admin + participant image uploads funnel through this single route so
 * we have one place to enforce auth, size limits, MIME checks, and audit logs.
 *
 *   POST /api/upload
 *     multipart/form-data:
 *       file:   File (image/*)
 *       folder: string (e.g. "organizations", "events/qr", "questions")
 *     -> 200 { url, publicId, isLocal, bytes, cloudinaryConfigured }
 *     -> 401 (unauthenticated)
 *     -> 400 (missing/invalid file, file too large, invalid type)
 *
 *   GET /api/upload
 *     -> 200 { configured: boolean }   // cheap probe for client-side "is Cloudinary on?"
 */

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB hard cap (route-level)
const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
])

async function requireAuth(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  return !!session?.user
}

/** POST /api/upload -- upload an image to Cloudinary (or base64 fallback). */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAuth())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 },
      )
    }

    const file = formData.get("file")
    const folder = formData.get("folder")

    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Missing or empty 'file' field" },
        { status: 400 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `File too large (max ${Math.floor(MAX_BYTES / 1024 / 1024)}MB)`,
          code: "FILE_TOO_LARGE",
        },
        { status: 413 },
      )
    }
    if (!ACCEPTED_MIME.has(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type || "unknown"}`,
          code: "INVALID_FILE_TYPE",
        },
        { status: 415 },
      )
    }

    const folderName =
      typeof folder === "string" && folder.trim()
        ? folder.trim().replace(/^\/+|\/+$/g, "")
        : "general"

    const buffer = await fileToBuffer(file)
    const result = await uploadImage(buffer, file.type, {
      folder: folderName,
    })

    return NextResponse.json({
      url: result.url,
      publicId: result.publicId ?? null,
      isLocal: result.isLocal,
      bytes: result.bytes,
      cloudinaryConfigured: isCloudinaryConfigured(),
    })
  } catch (e) {
    return NextResponse.json(
      {
        error: "Upload failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    )
  }
}

/** GET /api/upload -- cheap probe for whether Cloudinary is configured. */
export async function GET() {
  return NextResponse.json(getStorageStatus())
}
