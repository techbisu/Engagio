"use client"

import type {
  AchievementType,
  AchievementVisibility,
  AchievementTemplateId,
  SharePlatform,
  ShareableAchievementDto,
  PublicAchievementDto,
  AchievementData,
} from "@/types"

/**
 * Shared fetch helper for the shareable-achievements API surface.
 * Always sends JSON content-type, surfaces server error messages,
 * and works with relative Next.js API routes only.
 */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({} as { error?: string }))
    throw new Error(e.error || `Request failed: ${res.status}`)
  }
  const text = await res.text()
  if (!text) return undefined as unknown as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

// ---- Re-exported DTO types for convenience ----
export type {
  AchievementType,
  AchievementVisibility,
  AchievementTemplateId,
  SharePlatform,
  ShareableAchievementDto,
  PublicAchievementDto,
  AchievementData,
}

// ---- Input payload for POST /api/achievements ----
export interface CreateAchievementInput {
  activityId?: string
  eventId?: string
  type: AchievementType
  title: string
  subtitle?: string | null
  score?: number | null
  totalScore?: number | null
  percentage?: number | null
  rank?: number | null
  totalParticipants?: number | null
  achievementData?: AchievementData
  templateId?: AchievementTemplateId
  visibility?: AchievementVisibility
}

// ---- PATCH body for /api/achievements/[id] ----
export interface UpdateAchievementInput {
  visibility?: AchievementVisibility
  templateId?: AchievementTemplateId
}

// ---- Response from POST /api/achievements/[id]/generate-image ----
export interface GenerateImageResponse {
  imageUrl: string
  imagePublicId?: string | null
}

// ---- Response from POST /api/achievements/[id]/share ----
export interface ShareResponse {
  shareUrl: string
  text: string
  urls: {
    whatsapp: string
    linkedin: string
    facebook: string
    x: string
  }
  imageUrl?: string | null
}

// ---- Response from POST /api/achievements/[id]/regenerate-link ----
export interface RegenerateLinkResponse {
  publicToken: string
  shareUrl: string
}

// ---- Response from POST /api/achievements/[id]/revoke ----
export interface RevokeResponse {
  success: boolean
}

// ---- Templates metadata for the template selector ----
export interface TemplateOption {
  id: AchievementTemplateId
  label: string
  description: string
}

export const TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: "minimal", label: "Minimal", description: "Clean & simple" },
  { id: "modern", label: "Modern", description: "Bold gradient" },
  { id: "professional", label: "Professional", description: "Corporate" },
  { id: "celebration", label: "Celebration", description: "Festive" },
  { id: "conference", label: "Conference", description: "Event-ready" },
]

// ---- Type emoji map for the achievement card header ----
export const TYPE_META: Record<
  AchievementType,
  { label: string; emoji: string }
> = {
  QUIZ_RESULT: { label: "Quiz Result", emoji: "📝" },
  LIVE_QUIZ_RESULT: { label: "Live Quiz", emoji: "⚡" },
  KNOWLEDGE_CHECK_RESULT: { label: "Knowledge Check", emoji: "✅" },
  PRE_POST_RESULT: { label: "Pre/Post Result", emoji: "📊" },
  CERTIFICATE_EARNED: { label: "Certificate Earned", emoji: "🏆" },
  ACTIVITY_COMPLETED: { label: "Activity Completed", emoji: "🎯" },
  EVENT_PARTICIPATION: { label: "Event Participation", emoji: "🎟️" },
  LEADERBOARD_ACHIEVEMENT: { label: "Leaderboard", emoji: "🥇" },
}

// ---- Helpers ----

/** Slugify a title for filenames. */
export function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

/** Build the public share URL for a given token. */
export function buildShareUrl(token: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/?share=${token}`
  }
  return `/?share=${token}`
}

/** Build the achievement PNG download filename. */
export function downloadFilename(title: string): string {
  const slug = slugify(title) || "achievement"
  return `engagio-achievement-${slug}.png`
}
