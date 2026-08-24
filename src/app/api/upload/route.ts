import { checkBodySize, BODY_LIMITS } from "@/lib/body-limit";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import {
  uploadFile,
  getStorageStatus,
  isCloudinaryConfigured,
} from "@/lib/storage";

/**
 * POST /api/upload
 * Authenticated. Multipart form upload: { file: File, folder?: string }
 *
 * Uploads via the server-side signed Cloudinary path (storage.ts
 * `signCloudinaryParams` with the API secret). When Cloudinary is not
 * configured, falls back to a base64 data URL (dev mode).
 *
 * Response shape matches src/lib/upload-client.ts `UploadResponse`:
 *   { url, publicId, isLocal, bytes?, cloudinaryConfigured }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  const tooLarge = await checkBodySize(req, BODY_LIMITS.UPLOAD);
  if (tooLarge) return tooLarge;
  const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
    }

    // Folder must be a short, safe string (it becomes a Cloudinary folder path).
    const rawFolder = String(form.get("folder") || "general").trim();
    const folder =
      rawFolder && rawFolder.length <= 80 && !/[\0\r\n]/.test(rawFolder)
        ? rawFolder
        : "general";

    const { url, publicId } = await uploadFile(form, "file", { folder });
    if (!url) {
      return NextResponse.json(
        { error: "A file field named 'file' is required" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      url,
      publicId,
      isLocal: !publicId,
      cloudinaryConfigured: isCloudinaryConfigured(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload
 * Authenticated. Returns whether Cloudinary is configured. Used by
 * `isCloudinaryConfigured()` in src/lib/upload-client.ts (checks
 * `data.configured === true`).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = getStorageStatus();
  return NextResponse.json({
    configured: status.cloudinaryConfigured,
    provider: status.provider,
    cloudName: status.cloudName ?? null,
  });
}
