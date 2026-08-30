import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { uploadImage, isCloudinaryConfigured } from "@/lib/storage";

/**
 * POST /api/upload — image upload endpoint.
 *
 * Accepts multipart/form-data with:
 *   - file: the image File (JPEG/PNG/WebP/GIF)
 *   - folder: the logical Cloudinary folder (e.g. "organizations", "events")
 *
 * Returns:
 *   200: { url, publicId, isLocal, bytes, cloudinaryConfigured }
 *   401: Not authenticated
 *   400: No file / invalid file
 *
 * When Cloudinary is configured (CLOUDINARY_CLOUD_NAME + API_KEY + API_SECRET
 * env vars set), the image is uploaded to Cloudinary and a CDN URL is returned.
 * When Cloudinary is NOT configured, the image is returned as a base64 data URL
 * so the app works in dev without external services.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth required — only authenticated users can upload
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const folder = (formData.get("folder") as string) || "general";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF` },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 400 }
      );
    }

    // Convert File to Buffer for the storage layer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload via the storage abstraction layer
    const result = await uploadImage(buffer, file.type, {
      folder,
      transformation: "q_auto", // auto-quality optimization
    });

    return NextResponse.json({
      url: result.url,
      publicId: result.publicId ?? null,
      isLocal: result.isLocal,
      bytes: result.bytes ?? file.size,
      cloudinaryConfigured: isCloudinaryConfigured(),
    });
  } catch (error) {
    console.error("[POST /api/upload] error:", error);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}
