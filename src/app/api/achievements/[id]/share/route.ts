import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireTenantContext, auditLog, ownsResource } from "@/lib/tenant"
import {
  buildShareText,
  buildShareUrls,
  buildShareUrl,
} from "@/lib/achievement"
import { generateAchievementImage } from "@/lib/achievement-image"
import type { SharePlatform } from "@/types"

type RouteContext = { params: Promise<{ id: string }> }

const VALID_PLATFORMS: SharePlatform[] = [
  "NATIVE",
  "WHATSAPP",
  "LINKEDIN",
  "FACEBOOK",
  "X",
  "COPY_LINK",
  "DOWNLOAD",
]

function isSharePlatform(v: unknown): v is SharePlatform {
  return typeof v === "string" && (VALID_PLATFORMS as string[]).includes(v)
}

/**
 * POST /api/achievements/[id]/share
 *
 * Owner or admin. Records a share event and returns the share URL + per-platform
 * share URLs + share text + the card image URL (generating it on demand if
 * missing).
 *
 * Body: `{ platform: SharePlatform }`
 *
 * Returns:
 *   {
 *     shareUrl: string,
 *     text: string,
 *     urls: { whatsapp, linkedin, facebook, x },
 *     imageUrl: string | null
 *   }
 */
export async function POST(req: NextRequest, ctxParams: RouteContext) {
  try {
    const ctx = await requireTenantContext(req)
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }
    const { id } = await ctxParams.params

    const row = await db.shareableAchievement.findUnique({ where: { id } })
    if (!row || !ownsResource(row, ctx)) {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 })
    }
    const isOwner = row.participantId === ctx.userId
    const isAdmin =
      ctx.isPlatformAdmin ||
      ctx.orgRole === "OWNER" ||
      ctx.orgRole === "ADMIN"
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      body = {}
    }
    const platform = body?.platform
    if (!isSharePlatform(platform)) {
      return NextResponse.json(
        { error: "Invalid or missing `platform`" },
        { status: 400 }
      )
    }

    // Build the public share URL + share text.
    const shareUrl = buildShareUrl(req, row.publicToken)
    const eventName =
      row.subtitle ||
      (typeof row.achievementData === "string"
        ? (() => {
            try {
              return JSON.parse(row.achievementData)?.eventTitle ?? undefined
            } catch {
              return undefined
            }
          })()
        : undefined)
    const text = buildShareText({
      participantName: row.participantName,
      type: row.type as any,
      title: row.title,
      percentage: row.percentage,
      rank: row.rank,
      eventName,
      shareUrl,
    })
    const urls = buildShareUrls(shareUrl, text)

    // Lazy-generate the card image if it doesn't exist yet.
    let imageUrl = row.imageUrl
    if (!imageUrl) {
      try {
        const result = await generateAchievementImage(row, req, false)
        imageUrl = result.imageUrl
      } catch (e) {
        console.error("[share] lazy image generation failed:", e)
        imageUrl = null
      }
    }

    // Record the share event (analytics).
    await db.achievementShare.create({
      data: {
        organizationId: row.organizationId,
        achievementId: row.id,
        platform,
      },
    })

    await auditLog(
      ctx,
      "ACHIEVEMENT_SHARED",
      "ShareableAchievement",
      row.id,
      { platform }
    )

    return NextResponse.json({
      shareUrl,
      text,
      urls,
      imageUrl,
    })
  } catch (e) {
    console.error("[POST /api/achievements/[id]/share] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
