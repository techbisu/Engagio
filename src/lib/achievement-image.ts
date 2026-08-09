/**
 * Internal helper that generates a shareable achievement card image.
 *
 * Shared between:
 *   - POST /api/achievements/[id]/generate-image  (explicit)
 *   - POST /api/achievements/[id]/share           (lazy on first share)
 *
 * Renders the SVG for the achievement's current template, converts to PNG
 * via sharp, uploads to Cloudinary (or base64 fallback), and updates the
 * ShareableAchievement row with the new imageUrl + imagePublicId + bumped
 * dataVersion.
 *
 * Returns the updated image fields. Throws on hard failures.
 */

import { db } from "@/lib/db"
import { renderCard } from "@/lib/card-renderer"
import { uploadImage, deleteImage } from "@/lib/storage"
import {
  parseAchievementData,
} from "@/lib/achievement-mapper"
import type {
  AchievementData,
  AchievementTemplateId,
  AchievementType,
} from "@/types"
import { buildShareUrl } from "@/lib/achievement"

type AchievementRow = {
  id: string
  organizationId: string
  eventId: string | null
  activityId: string | null
  participantId: string | null
  participantName: string
  type: string
  title: string
  subtitle: string | null
  score: number | null
  totalScore: number | null
  percentage: number | null
  rank: number | null
  totalParticipants: number | null
  achievementData: string
  publicToken: string
  visibility: string
  imageUrl: string | null
  imagePublicId: string | null
  templateId: string
  dataVersion: number
}

export interface GenerateImageResult {
  imageUrl: string
  imagePublicId: string | null
  dataVersion: number
  isLocal: boolean
}

/**
 * Generate (or regenerate) the card image for a ShareableAchievement.
 *
 * @param row     The achievement row (already fetched by the caller).
 * @param req     The Request — used to build the share URL for the QR code.
 * @param force   When false, skips work if `imageUrl` is already set.
 */
export async function generateAchievementImage(
  row: AchievementRow,
  req: Request,
  force = false
): Promise<GenerateImageResult> {
  // Skip if already generated and caller didn't force.
  if (!force && row.imageUrl) {
    return {
      imageUrl: row.imageUrl,
      imagePublicId: row.imagePublicId,
      dataVersion: row.dataVersion,
      isLocal: row.imageUrl.startsWith("data:"),
    }
  }

  // Build the share URL for the QR code.
  const shareUrl = buildShareUrl(req, row.publicToken)

  const achievementData: AchievementData = parseAchievementData(row.achievementData)

  // Render the card (SVG + PNG buffer).
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

  // Detect fallback case where sharp failed and `png` is actually the SVG string.
  // sharp output is a real PNG (magic bytes: 89 50 4E 47); otherwise treat
  // the buffer as an SVG and upload it as image/svg+xml.
  const isSvgFallback =
    png.length < 4 ||
    png[0] !== 0x89 ||
    png[1] !== 0x50 ||
    png[2] !== 0x4e ||
    png[3] !== 0x47

  const mimeType = isSvgFallback ? "image/svg+xml" : "image/png"
  const folder = "achievements"
  const transformation = isSvgFallback ? undefined : "q_auto"

  const uploaded = await uploadImage(png, mimeType, {
    folder,
    publicIdPrefix: `ach-${row.id.slice(-12)}`,
    transformation,
    tags: ["achievement", row.type, row.templateId],
  })

  // Best-effort: delete the previously-uploaded asset if it existed.
  if (row.imagePublicId && row.imagePublicId !== uploaded.publicId) {
    deleteImage(row.imagePublicId).catch(() => {})
  }

  const updated = await db.shareableAchievement.update({
    where: { id: row.id },
    data: {
      imageUrl: uploaded.url,
      imagePublicId: uploaded.publicId ?? null,
      dataVersion: { increment: 1 },
    },
    select: {
      imageUrl: true,
      imagePublicId: true,
      dataVersion: true,
    },
  })

  return {
    imageUrl: updated.imageUrl!,
    imagePublicId: updated.imagePublicId,
    dataVersion: updated.dataVersion,
    isLocal: uploaded.isLocal,
  }
}
