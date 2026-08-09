import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { buildOgMetadata } from "@/lib/achievement"
import {
  parseAchievementData,
  toPublicAchievementDto,
} from "@/lib/achievement-mapper"

type RouteContext = { params: Promise<{ token: string }> }

/**
 * GET /api/share/[token]
 *
 * PUBLIC endpoint — no auth required. Used by:
 *   - The public share page (frontend renders the card from this data).
 *   - Social media crawlers (Twitter/Facebook/LinkedIn) for OG metadata.
 *   - The QR code embedded in the card (it encodes this URL).
 *
 * Behavior:
 *   - If the token doesn't exist → 404.
 *   - If `visibility === "PRIVATE"` → 403 with `{ error: "This achievement is private." }`.
 *     (Returned as an error so the public share page's error-handler regex
 *     `/private|403|forbidden/i` lands on the "private" UI state.)
 *   - If `visibility === "LINK_ONLY"` or `"PUBLIC"` → return the safe,
 *     public DTO (no internal IDs, no participantId, no organizationId).
 *
 * The DTO includes `ogTitle` + `ogDescription` (precomputed) and `imageUrl`
 * so crawlers and the public page can render the card.
 */
export async function GET(_req: Request, ctxParams: RouteContext) {
  try {
    const { token } = await ctxParams.params

    const row = await db.shareableAchievement.findUnique({
      where: { publicToken: token },
    })

    if (!row) {
      return NextResponse.json(
        { error: "Achievement not found" },
        { status: 404 }
      )
    }

    // Soft-revoked: the link still resolves, but the data is hidden.
    // Return 403 with a "private" message — the public share page's
    // error-handler regex matches and renders the private state.
    if (row.visibility === "PRIVATE") {
      return NextResponse.json(
        {
          visible: false,
          error: "This achievement is private.",
          message: "This achievement is private.",
        },
        { status: 403 }
      )
    }

    // Build OG metadata from the snapshot fields.
    const achievementData = parseAchievementData(row.achievementData)
    const og = buildOgMetadata({
      participantName: row.participantName,
      type: row.type as any,
      title: row.title,
      subtitle: row.subtitle,
      percentage: row.percentage,
      rank: row.rank,
      eventName: achievementData.eventTitle ?? undefined,
    })

    const dto = toPublicAchievementDto(row, og)

    // Return the raw PublicAchievementDto — the frontend's query is typed as
    // `api<PublicAchievementDto>(...)`, so no envelope wrapper.
    return NextResponse.json(dto)
  } catch (e) {
    console.error("[GET /api/share/[token]] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    )
  }
}
