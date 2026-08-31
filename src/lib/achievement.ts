/**
 * Achievement card generation utilities.
 *
 * Builds the metadata for a shareable achievement card from existing
 * Activities/Assessments/Certificates data. Does NOT duplicate result data —
 * just snapshots the relevant fields at card-creation time.
 */

import { generateQrCodeDataUrl } from "./cert"
import type {
  AchievementType,
  AchievementData,
  AchievementTemplateId,
} from "@/types"

/** 32-char hex token — cryptographically random, non-sequential. */
export function generatePublicToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Build the OG title/description for social sharing.
 * Example: "Biswajit scored 86% in Cardiology Knowledge Assessment"
 */
export function buildOgMetadata(params: {
  participantName: string
  type: AchievementType
  title: string
  subtitle?: string | null
  percentage?: number | null
  rank?: number | null
  eventName?: string
}): { ogTitle: string; ogDescription: string } {
  const { participantName, type, title, percentage, rank, eventName } = params

  let ogTitle = ""
  let ogDescription = ""

  switch (type) {
    case "QUIZ_RESULT":
    case "KNOWLEDGE_CHECK_RESULT":
      // For participation certificates (no score), use a completion message
      // instead of "scored X%". This prevents score leakage on share pages.
      ogTitle =
        percentage != null && percentage > 0
          ? `${participantName} scored ${percentage}% in ${title}`
          : `${participantName} completed ${title}`
      break
    case "LIVE_QUIZ_RESULT":
    case "LEADERBOARD_ACHIEVEMENT":
      ogTitle =
        rank != null
          ? `${participantName} ranked #${rank} in ${title}`
          : `${participantName} completed ${title}`
      break
    case "PRE_POST_RESULT":
      ogTitle = `${participantName} improved in ${title}`
      break
    case "CERTIFICATE_EARNED":
      ogTitle = `${participantName} earned a certificate in ${title}`
      break
    default:
      ogTitle = `${participantName} participated in ${title}`
  }

  ogDescription = eventName
    ? `${eventName} · Shared via Engagio`
    : "Shared via Engagio"

  return { ogTitle, ogDescription }
}

/**
 * Pick a default template based on the achievement type.
 */
export function defaultTemplateForType(
  type: AchievementType
): AchievementTemplateId {
  switch (type) {
    case "LIVE_QUIZ_RESULT":
    case "LEADERBOARD_ACHIEVEMENT":
      return "celebration"
    case "CERTIFICATE_EARNED":
      return "professional"
    case "PRE_POST_RESULT":
      return "modern"
    case "ACTIVITY_COMPLETED":
    case "EVENT_PARTICIPATION":
      return "conference"
    default:
      return "modern"
  }
}

/**
 * Build the share text for WhatsApp/social platforms.
 */
export function buildShareText(params: {
  participantName: string
  type: AchievementType
  title: string
  percentage?: number | null
  rank?: number | null
  eventName?: string
  shareUrl: string
}): string {
  const { participantName, type, title, percentage, rank, eventName, shareUrl } = params
  let text = `I just completed ${title}`
  if (eventName) text += ` at ${eventName}`
  text += "!\n\n"

  if (percentage != null && percentage > 0) {
    text += `🏆 Score: ${percentage}%\n`
  }
  if (rank != null && rank > 0) {
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏆"
    text += `${medal} Rank: #${rank}\n`
  }

  text += `\nView my achievement:\n${shareUrl}\n\nPowered by Engagio`
  return text
}

/**
 * Build social share URLs for each platform.
 */
export function buildShareUrls(shareUrl: string, text: string): {
  whatsapp: string
  linkedin: string
  facebook: string
  x: string
} {
  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedText = encodeURIComponent(text)
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text + "\n" + shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
  }
}

/**
 * Generate the QR code for a share URL (used on some card templates).
 */
export async function generateAchievementQr(
  shareUrl: string
): Promise<string> {
  return generateQrCodeDataUrl(shareUrl)
}

/**
 * Build the public share URL for an achievement token.
 *
 * NOTE: This is the SERVER-side URL builder. It uses the new
 * file-based route `/share/[token]` (Phase 1 routing migration).
 */
export function buildShareUrl(
  req: Request | { headers: { get: (k: string) => string | null } },
  token: string
): string {
  const proto =
    req.headers.get("x-forwarded-proto") ||
    req.headers.get("x-real-protocol") ||
    "https"
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000"
  return `${proto}://${host}/share/${token}`
}
