import { NextRequest, NextResponse } from "next/server"
import { fetchOrgBySlug } from "@/lib/org-public"

/**
 * GET /api/public/org?slug=demo-medical
 *
 * PUBLIC — no auth required.
 * Query-param based org lookup (legacy, kept for backward compatibility).
 *
 * Prefer /api/public/org/[slug] for new code.
 */
export async function GET(req: NextRequest) {
  try {
    const slug = new URL(req.url).searchParams.get("slug")
    if (!slug) {
      return NextResponse.json(
        { error: "Organization slug is required" },
        { status: 400 }
      )
    }

    return await fetchOrgBySlug(slug)
  } catch (error) {
    console.error("[GET /api/public/org] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
