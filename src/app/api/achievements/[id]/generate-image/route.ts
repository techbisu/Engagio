import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { renderCard } from "@/lib/card-renderer"
import { parseAchievementData } from "@/lib/achievement-mapper"
import { buildShareUrl } from "@/lib/achievement"
import type { AchievementData, AchievementTemplateId, AchievementType } from "@/types"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/achievements/[id]/generate-image
 *
 * Authenticated (session-based, NOT tenant-context). Generates the card image
 * ON DEMAND and returns it directly as a PNG download. The caller must be
 * either the achievement owner (participantId === session.user.id) OR a
 * platform admin.
 *
 * Returns a PNG image response (Content-Type: image/png).
 */
export async function POST(req: NextRequest, ctxParams: RouteContext) {
  try {
    // Use session-based auth instead of requireTenantContext so external
    // participants (who aren't org members) can generate their achievement
    // card without being blocked by org-membership checks.
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { id } = await ctxParams.params

    const row = await db.shareableAchievement.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 })
    }

    // Only the owner or a platform admin can generate the image.
    const isOwner = row.participantId === session.user.id
    if (!isOwner) {
      // Check if user is a platform admin
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { platformRole: true },
      })
      if (user?.platformRole !== "SUPERADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Build the share URL for the QR code.
    const shareUrl = buildShareUrl(req, row.publicToken)
    const achievementData: AchievementData = parseAchievementData(row.achievementData)

    // Render the card (SVG + PNG buffer) on demand.
    const { png } = await renderCard({
      templateId: row.templateId as AchievementTemplateId,
      type: row.type as AchievementType,
      title: row.title,
      subtitle: row.subtitle,
      participantName: row.participantName,
      score: row.score,
      totalScore: row.totalScore,
      percentage: row.percentage,
      rank: row.rank,
      totalParticipants: row.totalParticipants,
      achievementData,
      orgLogoUrl: achievementData.orgLogoUrl ?? null,
      shareUrl,
    })

    // Return the PNG directly — no storage upload, no DB save.
    const fileName = `achievement-${row.id.slice(-12)}.png`
    const headers = new Headers({
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    })
    const pngBytes = new Uint8Array(png)
    return new NextResponse(pngBytes, { status: 200, headers })
  } catch (e) {
    console.error("[POST /api/achievements/[id]/generate-image] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
