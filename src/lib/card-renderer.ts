/**
 * Server-side card renderer for shareable achievement cards.
 *
 * Strategy: build an SVG string (1200×1200 square) for one of 5 templates,
 * then convert to PNG via `sharp`.
 *
 * ─── Font availability note ────────────────────────────────────────────────
 * The SVG uses `font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif"`
 * because `Inter` is NOT installed on Vercel's serverless environment
 * (Amazon Linux). When sharp/librsvg encounters a missing font, it falls
 * back to a default font that often lacks glyphs — producing "tofu" boxes
 * (□□□□) instead of readable text.
 *
 * `DejaVu Sans` is pre-installed on virtually all Linux distributions
 * (including Vercel) and has full Latin/Unicode coverage. `Liberation Sans`
 * is a secondary fallback (metric-compatible with Arial). The generic
 * `sans-serif` is the last-resort fallback.
 *
 * Templates:
 *   1. minimal       — clean white, large score, thin emerald accent line.
 *   2. modern        — geometric shapes, SaaS-style, score in a rounded card.
 *   3. professional  — formal serif, certificate-style border, org logo.
 *   4. celebration   — energetic, confetti, trophy, rank medal.
 *   5. conference    — event-focused, event name prominent.
 */

import sharp from "sharp"
import {
  generateAchievementQr,
} from "./achievement"
import type {
  AchievementTemplateId,
  AchievementType,
  AchievementData,
} from "@/types"

export interface CardRenderParams {
  templateId: AchievementTemplateId
  type: AchievementType
  title: string
  subtitle?: string | null
  participantName: string
  score?: number | null
  totalScore?: number | null
  percentage?: number | null
  rank?: number | null
  totalParticipants?: number | null
  achievementData: AchievementData
  orgLogoUrl?: string | null
  /** Public share URL — when provided, a QR code is embedded in the card. */
  shareUrl?: string
}

export interface RenderedCard {
  png: Buffer
  svg: string
}

// ─── Font stacks (Linux/Vercel-safe) ─────────────────────────────────────────
// DejaVu Sans is pre-installed on virtually all Linux distros (including
// Vercel's Amazon Linux serverless). Liberation Sans is the Arial-compatible
// fallback. NEVER use "Inter" or "system-ui" — they're not available in
// sharp/librsvg's font resolution and produce "tofu" boxes.
const FONT_SANS = "DejaVu Sans, Liberation Sans, Arial, sans-serif"
const FONT_SERIF = "DejaVu Serif, Liberation Serif, Georgia, serif"
const FONT_MONO = "DejaVu Sans Mono, Liberation Mono, Courier New, monospace"

// ─── Color palette (emerald/teal — matches Engagio brand) ────────────────────
const COLORS = {
  emerald: "#10b981",
  emeraldDark: "#047857",
  emeraldDarker: "#065f46",
  teal: "#14b8a6",
  tealDark: "#0f766e",
  slate: "#0f172a",
  slateLight: "#475569",
  slateMuted: "#94a3b8",
  slateFaint: "#e2e8f0",
  white: "#ffffff",
  amber: "#f59e0b",
  gold: "#fbbf24",
  goldLight: "#fde68a",
  rose: "#f43f5e",
  cream: "#fefce8",
}

// ─── Type label ────────────────────────────────────────────────────────────
function typeLabel(type: AchievementType): { emoji: string; label: string } {
  switch (type) {
    case "QUIZ_RESULT":
    case "KNOWLEDGE_CHECK_RESULT":
      return { emoji: "🧠", label: "KNOWLEDGE CHECK" }
    case "LIVE_QUIZ_RESULT":
      return { emoji: "⚡", label: "LIVE QUIZ" }
    case "PRE_POST_RESULT":
      return { emoji: "📈", label: "LEARNING PROGRESS" }
    case "CERTIFICATE_EARNED":
      return { emoji: "🎓", label: "CERTIFICATE" }
    case "ACTIVITY_COMPLETED":
    case "EVENT_PARTICIPATION":
      return { emoji: "💬", label: "PARTICIPATED" }
    case "LEADERBOARD_ACHIEVEMENT":
      return { emoji: "🏆", label: "ACHIEVEMENT" }
    default:
      return { emoji: "🏆", label: "ACHIEVEMENT" }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + "…"
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    if (!cur) {
      cur = w
    } else if ((cur + " " + w).length <= maxCharsPerLine) {
      cur += " " + w
    } else {
      lines.push(cur)
      cur = w
      if (lines.length === maxLines - 1) break
    }
  }
  if (cur) lines.push(cur)
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length + 3) {
    lines[maxLines - 1] = truncate(lines[maxLines - 1], maxCharsPerLine)
  }
  return lines.slice(0, maxLines)
}

function rankSuffix(rank: number): string {
  if (rank === 1) return "st"
  if (rank === 2) return "nd"
  if (rank === 3) return "rd"
  return "th"
}

// ─── QR code (async, only when shareUrl provided) ──────────────────────────

async function buildQrImageTag(shareUrl: string, x: number, y: number, size = 160): Promise<string> {
  try {
    const dataUrl = await generateAchievementQr(shareUrl)
    return `<image href="${dataUrl}" x="${x}" y="${y}" width="${size}" height="${size}" />`
  } catch {
    return ""
  }
}

function orgLogoTag(url: string, x: number, y: number, height = 72): string {
  const width = height * 2.2
  return `<image href="${escapeXml(url)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMinYMid meet" />`
}

// ─── Common header / footer pieces ────────────────────────────────────────

function engagioWordmark(y: number, size = 20, color = COLORS.slateMuted): string {
  return `<text x="600" y="${y}" font-family="${FONT_SANS}" font-size="${size}" font-weight="700" letter-spacing="6" fill="${color}" text-anchor="middle">ENGAGIO</text>`
}

function poweredByFooter(y: number, color = COLORS.slateMuted): string {
  return `<text x="600" y="${y}" font-family="${FONT_SANS}" font-size="16" font-weight="500" fill="${color}" text-anchor="middle">Powered by Engagio</text>`
}

// ─── Shared defs (gradients, filters used across templates) ─────────────────
function sharedDefs(idPrefix: string): string {
  return `
    <linearGradient id="${idPrefix}-emerald-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.emerald}" />
      <stop offset="100%" stop-color="${COLORS.teal}" />
    </linearGradient>
    <linearGradient id="${idPrefix}-dark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.slate}" />
      <stop offset="100%" stop-color="${COLORS.emeraldDarker}" />
    </linearGradient>
    <linearGradient id="${idPrefix}-gold-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.goldLight}" />
      <stop offset="50%" stop-color="${COLORS.gold}" />
      <stop offset="100%" stop-color="${COLORS.amber}" />
    </linearGradient>
    <filter id="${idPrefix}-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="24" flood-color="${COLORS.slate}" flood-opacity="0.15" />
    </filter>
    <filter id="${idPrefix}-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  `
}

// ─── Template 1: minimal — clean white, BIG score ──────────────────────────
async function renderMinimal(p: CardRenderParams): Promise<string> {
  const { type, title, subtitle, participantName, percentage, rank, score, totalScore } = p
  const { emoji, label } = typeLabel(type)

  let metricLine = ""
  let metricSub = "FINAL SCORE"
  if (percentage != null && percentage >= 0) {
    metricLine = `${percentage}%`
    metricSub = "FINAL PERCENTAGE"
  } else if (rank != null && rank > 0) {
    metricLine = `#${rank}`
    metricSub = `RANK${p.totalParticipants ? ` OF ${p.totalParticipants}` : ""}`
  } else if (score != null && totalScore != null) {
    metricLine = `${score}/${totalScore}`
    metricSub = "POINTS"
  } else if (score != null) {
    metricLine = `${score}`
    metricSub = "POINTS"
  } else {
    metricLine = "✓"
    metricSub = "COMPLETED"
  }

  const titleLines = wrapText(title, 30, 2)
  const titleBlock = titleLines
    .map((line, i) => `<text x="600" y="${560 + i * 60}" font-family="${FONT_SANS}" font-size="44" font-weight="700" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  const subtitleBlock = subtitle
    ? `<text x="600" y="${560 + titleLines.length * 60 + 36}" font-family="${FONT_SANS}" font-size="24" font-weight="400" fill="${COLORS.slateLight}" text-anchor="middle">${escapeXml(truncate(subtitle, 64))}</text>`
    : ""

  const logoBlock = p.orgLogoUrl
    ? orgLogoTag(p.orgLogoUrl, 1020, 80, 56)
    : ""

  const qrTag = p.shareUrl ? await buildQrImageTag(p.shareUrl, 80, 960, 160) : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>${sharedDefs("min")}</defs>
  <rect width="1200" height="1200" fill="${COLORS.white}" />
  <rect x="0" y="0" width="1200" height="8" fill="url(#min-emerald-grad)" />

  ${engagioWordmark(130, 22, COLORS.slateMuted)}
  ${logoBlock}

  <!-- type label -->
  <text x="600" y="320" font-family="${FONT_SANS}" font-size="22" font-weight="700" letter-spacing="4" fill="${COLORS.emeraldDark}" text-anchor="middle">${emoji}  ${label}</text>

  <!-- BIG metric -->
  <text x="600" y="470" font-family="${FONT_SANS}" font-size="220" font-weight="800" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(metricLine)}</text>
  <text x="600" y="540" font-family="${FONT_SANS}" font-size="20" font-weight="700" letter-spacing="6" fill="${COLORS.slateMuted}" text-anchor="middle">${metricSub}</text>

  ${titleBlock}
  ${subtitleBlock}

  <!-- participant name -->
  <text x="600" y="${820 + (subtitleBlock ? 80 : 0)}" font-family="${FONT_SANS}" font-size="36" font-weight="700" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(truncate(participantName, 44))}</text>
  <rect x="540" y="${860 + (subtitleBlock ? 80 : 0)}" width="120" height="4" rx="2" fill="${COLORS.emerald}" />

  ${qrTag}
  ${poweredByFooter(1140)}
</svg>`
}

// ─── Template 2: modern — geometric, premium token style ───────────────────
async function renderModern(p: CardRenderParams): Promise<string> {
  const { type, title, subtitle, participantName, percentage, rank, score, totalScore } = p
  const { emoji, label } = typeLabel(type)

  let metricLine = ""
  let metricSub = "SCORE"
  if (percentage != null && percentage >= 0) {
    metricLine = `${percentage}%`
    metricSub = "PERCENTAGE"
  } else if (rank != null && rank > 0) {
    metricLine = `#${rank}`
    metricSub = `RANK${p.totalParticipants ? ` · OF ${p.totalParticipants}` : ""}`
  } else if (score != null && totalScore != null) {
    metricLine = `${score}/${totalScore}`
    metricSub = "POINTS"
  } else if (score != null) {
    metricLine = `${score}`
    metricSub = "POINTS"
  } else {
    metricLine = "✓"
    metricSub = "COMPLETED"
  }

  const titleLines = wrapText(title, 26, 2)
  const titleBlock = titleLines
    .map((line, i) => `<text x="600" y="${720 + i * 56}" font-family="${FONT_SANS}" font-size="40" font-weight="700" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  const subtitleBlock = subtitle
    ? `<text x="600" y="${720 + titleLines.length * 56 + 34}" font-family="${FONT_SANS}" font-size="22" font-weight="400" fill="${COLORS.slateLight}" text-anchor="middle">${escapeXml(truncate(subtitle, 56))}</text>`
    : ""

  const logoBlock = p.orgLogoUrl
    ? orgLogoTag(p.orgLogoUrl, 80, 80, 64)
    : ""

  const qrTag = p.shareUrl ? await buildQrImageTag(p.shareUrl, 80, 960, 160) : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>${sharedDefs("mod")}</defs>
  <rect width="1200" height="1200" fill="#f8fafc" />

  <!-- geometric shapes background -->
  <circle cx="1000" cy="160" r="260" fill="${COLORS.emerald}" opacity="0.08" />
  <circle cx="1110" cy="340" r="100" fill="${COLORS.teal}" opacity="0.12" />
  <circle cx="160" cy="1040" r="200" fill="${COLORS.emerald}" opacity="0.06" />
  <circle cx="70" cy="880" r="70" fill="${COLORS.teal}" opacity="0.1" />
  <rect x="0" y="0" width="1200" height="8" fill="url(#mod-emerald-grad)" />

  ${engagioWordmark(130, 22, COLORS.slateMuted)}
  ${logoBlock}

  <!-- type label -->
  <text x="600" y="220" font-family="${FONT_SANS}" font-size="22" font-weight="700" letter-spacing="4" fill="${COLORS.emeraldDark}" text-anchor="middle">${emoji}  ${label}</text>

  <!-- rounded score card (premium token look) -->
  <rect x="280" y="280" width="640" height="360" rx="40" ry="40" fill="${COLORS.white}" filter="url(#mod-card-shadow)" />
  <rect x="280" y="280" width="640" height="8" rx="4" fill="url(#mod-emerald-grad)" />

  <!-- BIG metric inside the card -->
  <text x="600" y="500" font-family="${FONT_SANS}" font-size="160" font-weight="800" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(metricLine)}</text>
  <text x="600" y="580" font-family="${FONT_SANS}" font-size="20" font-weight="700" letter-spacing="6" fill="${COLORS.slateMuted}" text-anchor="middle">${metricSub}</text>

  ${titleBlock}
  ${subtitleBlock}

  <!-- participant name pill -->
  <rect x="320" y="${880 + (subtitleBlock ? 70 : 0)}" width="560" height="72" rx="36" ry="36" fill="url(#mod-emerald-grad)" />
  <text x="600" y="${926 + (subtitleBlock ? 70 : 0)}" font-family="${FONT_SANS}" font-size="32" font-weight="800" fill="${COLORS.white}" text-anchor="middle">${escapeXml(truncate(participantName, 40))}</text>

  ${qrTag}
  ${poweredByFooter(1140)}
</svg>`
}

// ─── Template 3: professional — certificate style ───────────────────────────
async function renderProfessional(p: CardRenderParams): Promise<string> {
  const { type, title, subtitle, participantName, percentage, rank, score, totalScore } = p
  const { emoji, label } = typeLabel(type)

  let metricLine = ""
  let metricSub = "FINAL SCORE"
  if (percentage != null && percentage >= 0) {
    metricLine = `${percentage}%`
    metricSub = "FINAL PERCENTAGE"
  } else if (rank != null && rank > 0) {
    metricLine = `${rank}${rankSuffix(rank)}`
    metricSub = `RANK${p.totalParticipants ? ` OF ${p.totalParticipants}` : ""}`
  } else if (score != null && totalScore != null) {
    metricLine = `${score} / ${totalScore}`
    metricSub = "FINAL SCORE"
  } else if (score != null) {
    metricLine = `${score}`
    metricSub = "FINAL SCORE"
  } else {
    metricLine = "—"
    metricSub = "COMPLETED"
  }

  const titleLines = wrapText(title, 32, 2)
  const titleBlock = titleLines
    .map((line, i) => `<text x="600" y="${740 + i * 58}" font-family="${FONT_SERIF}" font-size="44" font-weight="700" font-style="italic" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  const subtitleBlock = subtitle
    ? `<text x="600" y="${740 + titleLines.length * 58 + 34}" font-family="${FONT_SERIF}" font-size="22" font-weight="400" font-style="italic" fill="${COLORS.slateLight}" text-anchor="middle">${escapeXml(truncate(subtitle, 64))}</text>`
    : ""

  const logoBlock = p.orgLogoUrl
    ? orgLogoTag(p.orgLogoUrl, 80, 100, 80)
    : ""

  const qrTag = p.shareUrl ? await buildQrImageTag(p.shareUrl, 80, 960, 160) : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>${sharedDefs("pro")}</defs>
  <rect width="1200" height="1200" fill="${COLORS.white}" />

  <!-- certificate-style border (double) -->
  <rect x="40" y="40" width="1120" height="1120" fill="none" stroke="${COLORS.emeraldDark}" stroke-width="4" />
  <rect x="56" y="56" width="1088" height="1088" fill="none" stroke="${COLORS.emerald}" stroke-width="2" />

  <!-- corner flourishes -->
  <rect x="40" y="40" width="140" height="8" fill="${COLORS.emeraldDark}" />
  <rect x="40" y="40" width="8" height="140" fill="${COLORS.emeraldDark}" />
  <rect x="1020" y="40" width="140" height="8" fill="${COLORS.emeraldDark}" />
  <rect x="1152" y="40" width="8" height="140" fill="${COLORS.emeraldDark}" />
  <rect x="40" y="1152" width="140" height="8" fill="${COLORS.emeraldDark}" />
  <rect x="40" y="1020" width="8" height="140" fill="${COLORS.emeraldDark}" />
  <rect x="1020" y="1152" width="140" height="8" fill="${COLORS.emeraldDark}" />
  <rect x="1152" y="1020" width="8" height="140" fill="${COLORS.emeraldDark}" />

  ${engagioWordmark(150, 18, COLORS.slateMuted)}
  ${logoBlock}

  <!-- "CERTIFICATE OF ACHIEVEMENT" header -->
  <text x="600" y="280" font-family="${FONT_SERIF}" font-size="24" font-weight="400" letter-spacing="8" fill="${COLORS.slateMuted}" text-anchor="middle">${label}</text>
  <text x="600" y="360" font-family="${FONT_SERIF}" font-size="60" font-weight="700" fill="${COLORS.slate}" text-anchor="middle">Certificate of Achievement</text>
  <line x1="440" y1="400" x2="760" y2="400" stroke="${COLORS.emerald}" stroke-width="2" />
  <circle cx="600" cy="400" r="6" fill="${COLORS.emerald}" />

  <!-- "This is to certify that" -->
  <text x="600" y="480" font-family="${FONT_SERIF}" font-size="24" font-style="italic" fill="${COLORS.slateLight}" text-anchor="middle">This is to certify that</text>
  <text x="600" y="580" font-family="${FONT_SERIF}" font-size="56" font-weight="700" fill="${COLORS.emeraldDark}" text-anchor="middle">${escapeXml(truncate(participantName, 44))}</text>
  <text x="600" y="640" font-family="${FONT_SERIF}" font-size="22" font-style="italic" fill="${COLORS.slateLight}" text-anchor="middle">has successfully completed</text>

  ${titleBlock}
  ${subtitleBlock}

  <!-- metric -->
  <text x="600" y="${880 + (subtitleBlock ? 80 : 20)}" font-family="${FONT_SERIF}" font-size="88" font-weight="700" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(metricLine)}</text>
  <text x="600" y="${920 + (subtitleBlock ? 80 : 20)}" font-family="${FONT_SANS}" font-size="18" font-weight="700" letter-spacing="6" fill="${COLORS.slateMuted}" text-anchor="middle" dy="20">${metricSub}</text>

  ${qrTag}
  ${poweredByFooter(1140)}
</svg>`
}

// ─── Template 4: celebration — energetic, trophy, BIG medal ────────────────
async function renderCelebration(p: CardRenderParams): Promise<string> {
  const { type, title, subtitle, participantName, percentage, rank, score, totalScore } = p
  const { emoji, label } = typeLabel(type)

  let metricLine = ""
  let metricSub = ""
  let medalEmoji = ""
  if (rank != null && rank > 0) {
    medalEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏆"
    metricLine = `${rank}${rankSuffix(rank)}`
    metricSub = `RANK${p.totalParticipants ? ` OF ${p.totalParticipants}` : ""}`
  } else if (percentage != null && percentage >= 0) {
    metricLine = `${percentage}%`
    metricSub = "SCORE"
    medalEmoji = "🎉"
  } else if (score != null && totalScore != null) {
    metricLine = `${score}/${totalScore}`
    metricSub = "POINTS"
    medalEmoji = "🎉"
  } else {
    metricLine = "✓"
    metricSub = "COMPLETED"
    medalEmoji = "🎉"
  }

  const titleLines = wrapText(title, 28, 2)
  const titleBlock = titleLines
    .map((line, i) => `<text x="600" y="${760 + i * 56}" font-family="${FONT_SANS}" font-size="42" font-weight="800" fill="${COLORS.white}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  const subtitleBlock = subtitle
    ? `<text x="600" y="${760 + titleLines.length * 56 + 36}" font-family="${FONT_SANS}" font-size="22" font-weight="500" fill="${COLORS.slateFaint}" text-anchor="middle">${escapeXml(truncate(subtitle, 56))}</text>`
    : ""

  const logoBlock = p.orgLogoUrl
    ? `<g opacity="0.95">${orgLogoTag(p.orgLogoUrl, 80, 80, 64)}</g>`
    : ""

  const qrTag = p.shareUrl ? await buildQrImageTag(p.shareUrl, 80, 960, 160) : ""

  // Confetti dots (deterministic positions)
  const confettiColors = [COLORS.emerald, COLORS.teal, COLORS.gold, COLORS.amber, COLORS.rose]
  let confetti = ""
  let s = 12345
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rand() * 1200)
    const y = Math.floor(rand() * 500)
    const r = 4 + Math.floor(rand() * 10)
    const c = confettiColors[i % confettiColors.length]
    const op = 0.4 + rand() * 0.5
    confetti += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${op.toFixed(2)}" />`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>${sharedDefs("cel")}</defs>

  <!-- dark emerald gradient background -->
  <rect width="1200" height="1200" fill="url(#cel-dark-grad)" />
  ${confetti}

  ${engagioWordmark(130, 22, "#a7f3d0")}
  ${logoBlock}

  <!-- type label -->
  <text x="600" y="220" font-family="${FONT_SANS}" font-size="24" font-weight="700" letter-spacing="4" fill="${COLORS.gold}" text-anchor="middle">${emoji}  ${label}</text>

  <!-- BIG gold medal -->
  <circle cx="600" cy="380" r="100" fill="url(#cel-gold-grad)" filter="url(#cel-glow)" />
  <circle cx="600" cy="380" r="100" fill="none" stroke="${COLORS.white}" stroke-width="4" opacity="0.4" />
  <text x="600" y="420" font-family="${FONT_SANS}" font-size="80" text-anchor="middle">${medalEmoji}</text>

  <!-- ribbon -->
  <path d="M 530 470 L 530 560 L 575 525 L 600 560 L 625 525 L 670 560 L 670 470 Z" fill="${COLORS.gold}" opacity="0.85" />

  <!-- BIG metric -->
  <text x="600" y="660" font-family="${FONT_SANS}" font-size="150" font-weight="900" fill="${COLORS.white}" text-anchor="middle">${escapeXml(metricLine)}</text>
  <text x="600" y="710" font-family="${FONT_SANS}" font-size="20" font-weight="700" letter-spacing="6" fill="${COLORS.gold}" text-anchor="middle" dy="20">${metricSub}</text>

  ${titleBlock}
  ${subtitleBlock}

  <!-- participant name pill -->
  <rect x="300" y="${900 + (subtitleBlock ? 70 : 0)}" width="600" height="76" rx="38" ry="38" fill="${COLORS.white}" opacity="0.15" />
  <text x="600" y="${950 + (subtitleBlock ? 70 : 0)}" font-family="${FONT_SANS}" font-size="34" font-weight="800" fill="${COLORS.white}" text-anchor="middle">${escapeXml(truncate(participantName, 44))}</text>

  ${qrTag}
  <text x="600" y="1140" font-family="${FONT_SANS}" font-size="16" font-weight="500" fill="#a7f3d0" text-anchor="middle">Powered by Engagio</text>
</svg>`
}

// ─── Template 5: conference — event-focused badge style ─────────────────────
async function renderConference(p: CardRenderParams): Promise<string> {
  const { type, title, subtitle, participantName, percentage, rank, score, totalScore } = p
  const { emoji, label } = typeLabel(type)

  const eventName = subtitle || p.achievementData?.eventTitle || title
  const activityTitle = p.achievementData?.activityTitle || title

  let metricLine = ""
  if (percentage != null && percentage >= 0) {
    metricLine = `${percentage}% SCORE`
  } else if (rank != null && rank > 0) {
    metricLine = `RANK #${rank}${p.totalParticipants ? ` OF ${p.totalParticipants}` : ""}`
  } else if (score != null && totalScore != null) {
    metricLine = `${score}/${totalScore} POINTS`
  } else if (score != null) {
    metricLine = `${score} POINTS`
  } else {
    metricLine = "ATTENDED"
  }

  const activityLines = wrapText(activityTitle, 32, 2)
  const activityBlock = activityLines
    .map((line, i) => `<text x="600" y="${640 + i * 50}" font-family="${FONT_SANS}" font-size="30" font-weight="500" fill="${COLORS.slateLight}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  const eventLines = wrapText(eventName, 24, 2)
  const eventBlock = eventLines
    .map((line, i) => `<text x="600" y="${520 + i * 56}" font-family="${FONT_SANS}" font-size="48" font-weight="800" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  const logoBlock = p.orgLogoUrl
    ? orgLogoTag(p.orgLogoUrl, 80, 80, 64)
    : ""

  const qrTag = p.shareUrl ? await buildQrImageTag(p.shareUrl, 80, 960, 160) : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>${sharedDefs("cnf")}</defs>
  <rect width="1200" height="1200" fill="${COLORS.white}" />

  <!-- header band -->
  <rect x="0" y="0" width="1200" height="320" fill="url(#cnf-dark-grad)" />
  <circle cx="1100" cy="60" r="140" fill="${COLORS.white}" opacity="0.06" />
  <circle cx="1180" cy="200" r="70" fill="${COLORS.white}" opacity="0.08" />

  <!-- ENGAGIO wordmark -->
  <text x="600" y="90" font-family="${FONT_SANS}" font-size="20" font-weight="700" letter-spacing="6" fill="${COLORS.white}" text-anchor="middle" opacity="0.95">ENGAGIO</text>

  <!-- type label -->
  <text x="600" y="160" font-family="${FONT_SANS}" font-size="20" font-weight="600" letter-spacing="4" fill="#a7f3d0" text-anchor="middle">${emoji}  ${label}</text>

  <!-- BIG attendee name -->
  <text x="600" y="240" font-family="${FONT_SANS}" font-size="44" font-weight="800" fill="${COLORS.white}" text-anchor="middle">ATTENDEE · ${escapeXml(truncate(participantName, 28))}</text>

  ${logoBlock}

  <!-- event name (hero) -->
  ${eventBlock}
  ${activityBlock}

  <!-- metric pill -->
  <rect x="380" y="${720 + activityLines.length * 50}" width="440" height="72" rx="36" ry="36" fill="#ecfdf5" />
  <text x="600" y="${768 + activityLines.length * 50}" font-family="${FONT_SANS}" font-size="26" font-weight="800" fill="${COLORS.emeraldDark}" text-anchor="middle">${escapeXml(metricLine)}</text>

  <!-- org name -->
  <text x="600" y="920" font-family="${FONT_SANS}" font-size="22" font-weight="500" fill="${COLORS.slateMuted}" text-anchor="middle">${escapeXml(truncate(p.achievementData?.orgName || "Engagio", 64))}</text>

  ${qrTag}
  ${poweredByFooter(1140)}
</svg>`
}

// ─── Main entry point: dispatch to the right template ──────────────────────

async function renderTemplate(p: CardRenderParams): Promise<string> {
  switch (p.templateId) {
    case "minimal":
      return renderMinimal(p)
    case "modern":
      return renderModern(p)
    case "professional":
      return renderProfessional(p)
    case "celebration":
      return renderCelebration(p)
    case "conference":
      return renderConference(p)
    default:
      return renderModern(p)
  }
}

/** Render only the SVG. */
export async function renderCardSvg(p: CardRenderParams): Promise<string> {
  return renderTemplate(p)
}

/**
 * Render the card and convert SVG → PNG via sharp.
 *
 * Returns both the PNG buffer and the original SVG string. If sharp fails
 * for any reason, the PNG buffer will be a UTF-8 encoding of the SVG itself
 * — callers that need a guaranteed image should fall back to using the SVG
 * string directly (e.g., via a data URL in an <img>).
 */
export async function renderCard(p: CardRenderParams): Promise<RenderedCard> {
  const svg = await renderTemplate(p)
  try {
    const png = await sharp(Buffer.from(svg), { density: 144 })
      .resize(1200, 1200, { fit: "cover" })
      .png()
      .toBuffer()

    if (png.length > 4 && png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47) {
      return { png, svg }
    }
    throw new Error("Invalid PNG output")
  } catch (e) {
    console.error("[card-renderer] sharp SVG→PNG failed; using SVG fallback:", e)
    return { png: Buffer.from(svg, "utf-8"), svg }
  }
}
