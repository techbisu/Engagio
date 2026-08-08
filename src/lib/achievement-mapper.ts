/**
 * Shared DTO mapper for the Shareable Achievement Card system.
 *
 * Both the authenticated `/api/achievements/*` routes and the public
 * `/api/share/[token]` route use these helpers so the field shape stays
 * consistent.
 */

import type {
  AchievementData,
  AchievementTemplateId,
  AchievementType,
  AchievementVisibility,
  PublicAchievementDto,
  ShareableAchievementDto,
} from "@/types"

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
  certificateId: string | null
  dataVersion: number
  createdAt: Date
  updatedAt: Date
  _count?: { shares: number }
}

const VALID_TYPES: AchievementType[] = [
  "QUIZ_RESULT",
  "LIVE_QUIZ_RESULT",
  "KNOWLEDGE_CHECK_RESULT",
  "PRE_POST_RESULT",
  "CERTIFICATE_EARNED",
  "ACTIVITY_COMPLETED",
  "EVENT_PARTICIPATION",
  "LEADERBOARD_ACHIEVEMENT",
]

const VALID_VIS: AchievementVisibility[] = ["PRIVATE", "LINK_ONLY", "PUBLIC"]
const VALID_TEMPLATES: AchievementTemplateId[] = [
  "minimal",
  "modern",
  "professional",
  "celebration",
  "conference",
]

export function isAchievementType(v: unknown): v is AchievementType {
  return typeof v === "string" && (VALID_TYPES as string[]).includes(v)
}
export function isAchievementVisibility(v: unknown): v is AchievementVisibility {
  return typeof v === "string" && (VALID_VIS as string[]).includes(v)
}
export function isAchievementTemplateId(v: unknown): v is AchievementTemplateId {
  return typeof v === "string" && (VALID_TEMPLATES as string[]).includes(v)
}

export function parseAchievementData(raw: string | null | undefined): AchievementData {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as AchievementData
    }
  } catch {
    // ignore — return empty
  }
  return {}
}

/** Map a Prisma row (with `_count.shares` if present) to ShareableAchievementDto. */
export function toAchievementDto(row: AchievementRow): ShareableAchievementDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    eventId: row.eventId ?? null,
    activityId: row.activityId ?? null,
    participantId: row.participantId ?? null,
    participantName: row.participantName,
    type: (row.type as AchievementType) ?? "ACTIVITY_COMPLETED",
    title: row.title,
    subtitle: row.subtitle ?? null,
    score: row.score ?? null,
    totalScore: row.totalScore ?? null,
    percentage: row.percentage ?? null,
    rank: row.rank ?? null,
    totalParticipants: row.totalParticipants ?? null,
    achievementData: parseAchievementData(row.achievementData),
    publicToken: row.publicToken,
    visibility: (row.visibility as AchievementVisibility) ?? "LINK_ONLY",
    imageUrl: row.imageUrl ?? null,
    imagePublicId: row.imagePublicId ?? null,
    templateId: (row.templateId as AchievementTemplateId) ?? "modern",
    certificateId: row.certificateId ?? null,
    dataVersion: row.dataVersion ?? 1,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    shareCount: row._count?.shares ?? 0,
  }
}

/** Map a Prisma row to PublicAchievementDto (only safe, public fields). */
export function toPublicAchievementDto(
  row: AchievementRow,
  og: { ogTitle: string; ogDescription: string }
): PublicAchievementDto {
  return {
    type: (row.type as AchievementType) ?? "ACTIVITY_COMPLETED",
    title: row.title,
    subtitle: row.subtitle ?? null,
    participantName: row.participantName,
    score: row.score ?? null,
    totalScore: row.totalScore ?? null,
    percentage: row.percentage ?? null,
    rank: row.rank ?? null,
    totalParticipants: row.totalParticipants ?? null,
    achievementData: parseAchievementData(row.achievementData),
    imageUrl: row.imageUrl ?? null,
    templateId: (row.templateId as AchievementTemplateId) ?? "modern",
    visibility: (row.visibility as AchievementVisibility) ?? "LINK_ONLY",
    createdAt: row.createdAt.toISOString(),
    ogTitle: og.ogTitle,
    ogDescription: og.ogDescription,
  }
}
