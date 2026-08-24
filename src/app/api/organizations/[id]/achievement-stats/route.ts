import { NextRequest, NextResponse } from "next/server"
import { resolveOrgMembership } from "@/lib/org-api"
import { db } from "@/lib/db"
import type { OrgAchievementStatsDto, SharePlatform } from "@/types"

type RouteContext = { params: Promise<{ id: string }> }

const ALL_PLATFORMS: SharePlatform[] = [
  "NATIVE",
  "WHATSAPP",
  "LINKEDIN",
  "FACEBOOK",
  "X",
  "COPY_LINK",
  "DOWNLOAD",
]

/**
 * GET /api/organizations/[id]/achievement-stats
 *
 * Admin+. Returns org-scoped achievement analytics:
 *   {
 *     totalAchievements: number,
 *     totalShares: number,
 *     sharesByPlatform: { NATIVE, WHATSAPP, LINKEDIN, FACEBOOK, X, COPY_LINK, DOWNLOAD }
 *   }
 *
 * Both totals are scoped to the org via `organizationId` on
 * ShareableAchievement and AchievementShare (both have direct org columns,
 * unlike Event-scoped resources).
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params
    const result = await resolveOrgMembership(id, "ADMIN")
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const [totalAchievements, shareAgg] = await Promise.all([
      db.shareableAchievement.count({
        where: { organizationId: id },
      }),
      db.achievementShare.groupBy({
        by: ["platform"],
        where: { organizationId: id },
        _count: { _all: true },
      }),
    ])

    const sharesByPlatform = ALL_PLATFORMS.reduce(
      (acc, p) => {
        acc[p] = 0
        return acc
      },
      {} as Record<SharePlatform, number>
    )
    let totalShares = 0
    for (const row of shareAgg) {
      const p = row.platform as SharePlatform
      if ((ALL_PLATFORMS as string[]).includes(p)) {
        sharesByPlatform[p] = row._count._all
        totalShares += row._count._all
      }
    }

    const dto: OrgAchievementStatsDto = {
      totalAchievements,
      totalShares,
      sharesByPlatform,
    }
    return NextResponse.json(dto)
  } catch (e) {
    console.error("[GET /api/organizations/[id]/achievement-stats] error:", e)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
