import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { uploadImage, fileToBuffer, isCloudinaryConfigured } from "@/lib/storage"

/**
 * POST /api/upload
 *
 * Authenticated. Accepts multipart/form-data with a `file` field + optional
 * `folder` field (e.g. "questions", "events", "payments", "certificates").
 *
 * Returns: { url, publicId, isLocal }
 *
 * If Cloudinary is not configured (no env vars), falls back to returning a
 * base64 data URL so the app keeps working in dev.
 *
 * Validates:
 * - Authenticated user
 * - File is an image (image/*)
 * - File size <= 5MB
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file")
    const folder = (formData.get("folder") as string) || "general"

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate MIME type — images only
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      )
    }

    // Validate file size — 5MB max
    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max 5MB." },
        { status: 400 }
      )
    }

    const buffer = await fileToBuffer(file)

    // Build transformation based on folder
    // Payments screenshots can be larger; question images smaller
    const transformation =
      folder === "payments"
        ? "w_1200,h_900,c_limit,q_auto"
        : folder === "certificates"
        ? "w_400,h_200,c_fit,q_auto"
        : folder === "events"
        ? "w_1200,h_600,c_fill,q_auto"
        : "w_800,h_600,c_limit,q_auto"

    const result = await uploadImage(buffer, file.type, {
      folder: `quizmaster/${folder}`,
      transformation,
      tags: [folder, session.user.id],
    })

    return NextResponse.json({
      url: result.url,
      publicId: result.publicId || null,
      isLocal: result.isLocal,
      bytes: result.bytes,
      cloudinaryConfigured: isCloudinaryConfigured(),
    })
  } catch (error) {
    console.error("[POST /api/upload] error:", error)
    return NextResponse.json(
      { error: "Upload failed", detail: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/upload — returns whether Cloudinary is configured.
 * Frontend uses this to show/hide the "Cloudinary not configured" warning.
 */
export async function GET() {
  return NextResponse.json({
    configured: isCloudinaryConfigured(),
  })
}
