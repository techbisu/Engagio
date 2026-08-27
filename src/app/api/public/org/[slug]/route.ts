import { NextRequest, NextResponse } from "next/server"
import { fetchOrgBySlug } from "@/lib/org-public"

/**
 * GET /api/public/org/[slug]
 *
 * PUBLIC — no auth required.
 * Path-based org lookup: /api/public/org/demo-medical
 *
 * Used by the subdomain flow and the /org/[orgSlug] page.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug) {
      return NextResponse.json(
        { error: "Organization slug is required" },
        { status: 400 }
      )
    }

    return await fetchOrgBySlug(slug)
  } catch (error) {
    console.error("[GET /api/public/org/[slug]] error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
