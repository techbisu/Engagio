import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { uploadImage, isCloudinaryConfigured } from "@/lib/storage";

/**
 * POST /api/upload — image upload endpoint.
 * Accepts multipart/form-data with `file` + `folder` fields.
 * Returns { url, publicId, isLocal, bytes, cloudinaryConfigured }.
 */
export async function POST(req: NextRequest) {
  try {
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
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `Invalid file type: ${file.type}` }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadImage(buffer, file.type, { folder, transformation: "q_auto" });
    return NextResponse.json({
      url: result.url, publicId: result.publicId ?? null, isLocal: result.isLocal,
      bytes: result.bytes ?? file.size, cloudinaryConfigured: isCloudinaryConfigured(),
    });
  } catch (error) {
    console.error("[POST /api/upload] error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

/**
 * GET /api/upload — return Cloudinary configuration status.
 */
export async function GET() {
  return NextResponse.json({ configured: isCloudinaryConfigured() });
}
