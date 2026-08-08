/**
 * Server-side card renderer for shareable achievement cards.
 *
 * Strategy: build an SVG string (1200×1200 square) for one of 5 templates,
 * then convert to PNG via `sharp`. Sharp is already installed and handles
 * SVG → PNG conversion without native canvas dependencies.
 *
 * If sharp fails for any reason, the renderer still returns the SVG string
 * — the frontend can render it via `<img src="data:image/svg+xml;base64,...">`
 * or directly inline.
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

// ─── Color palette (emerald/teal — matches Engagio brand) ────────────────────
const COLORS = {
  emerald: "#10b981",
  emeraldDark: "#047857",
  teal: "#14b8a6",
  tealDark: "#0f766e",
  slate: "#0f172a",
  slateLight: "#475569",
  slateMuted: "#94a3b8",
  slateFaint: "#e2e8f0",
  white: "#ffffff",
  amber: "#f59e0b",
  gold: "#fbbf24",
  rose: "#f43f5e",
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

/** Split a string into lines that each fit within a max-width (rough estimate at given font size). */
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
  // Truncate last line if we ran out of lines
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length + 3) {
    lines[maxLines - 1] = truncate(lines[maxLines - 1], maxCharsPerLine)
  }
  return lines.slice(0, maxLines)
}

function rankMedal(rank: number): string {
  if (rank === 1) return "🥇"
  if (rank === 2) return "🥈"
  if (rank === 3) return "🥉"
  return "🏆"
}

function rankSuffix(rank: number): string {
  if (rank === 1) return "st"
  if (rank === 2) return "nd"
  if (rank === 3) return "rd"
  return "th"
}

// ─── QR code (async, only when shareUrl provided) ──────────────────────────

async function buildQrImageTag(shareUrl: string, x: number, y: number, size = 150): Promise<string> {
  try {
    const dataUrl = await generateAchievementQr(shareUrl)
    // dataUrl looks like "data:image/png;base64,...."
    return `<image href="${dataUrl}" x="${x}" y="${y}" width="${size}" height="${size}" />`
  } catch {
    return ""
  }
}

function orgLogoTag(url: string, x: number, y: number, height = 64): string {
  // Compute width as square by default (logos are usually squarish)
  const width = height * 2.2 // give horizontal logos some room
  return `<image href="${escapeXml(url)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMinYMid meet" />`
}

// ─── Common header / footer pieces ────────────────────────────────────────

function engagioWordmark(y: number, size = 16, color = COLORS.slateMuted): string {
  return `<text x="600" y="${y}" font-family="Inter, system-ui, sans-serif" font-size="${size}" font-weight="700" letter-spacing="4" fill="${color}" text-anchor="middle">ENGAGIO</text>`
}

function poweredByFooter(y: number): string {
  return `<text x="600" y="${y}" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="500" fill="${COLORS.slateMuted}" text-anchor="middle">Powered by Engagio</text>`
}

// ─── Template 1: minimal ──────────────────────────────────────────────────
async function renderMinimal(p: CardRenderParams): Promise<string> {
  const { type, title, subtitle, participantName, percentage, rank, score, totalScore } = p
  const { emoji, label } = typeLabel(type)

  // Main metric
  let metricLine = ""
  let metricSub = ""
  if (percentage != null && percentage >= 0) {
    metricLine = `${percentage}%`
    metricSub = "SCORE"
  } else if (rank != null && rank > 0) {
    metricLine = `#${rank}`
    metricSub = `RANK${p.totalParticipants ? ` OF ${p.totalParticipants}` : ""}`
  } else if (score != null && totalScore != null) {
    metricLine = `${score}/${totalScore}`
    metricSub = "SCORE"
  } else if (score != null) {
    metricLine = `${score}`
    metricSub = "SCORE"
  } else {
    metricLine = "✓"
    metricSub = "COMPLETED"
  }

  const titleLines = wrapText(title, 32, 2)
  const titleBlock = titleLines
    .map((line, i) => `<text x="600" y="${540 + i * 56}" font-family="Inter, system-ui, sans-serif" font-size="40" font-weight="600" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  const subtitleBlock = subtitle
    ? `<text x="600" y="${540 + titleLines.length * 56 + 30}" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="400" fill="${COLORS.slateLight}" text-anchor="middle">${escapeXml(truncate(subtitle, 60))}</text>`
    : ""

  // Optional org logo (small, top-right)
  const logoBlock = p.orgLogoUrl
    ? orgLogoTag(p.orgLogoUrl, 1040, 70, 48)
    : ""

  const qrTag = p.shareUrl ? await buildQrImageTag(p.shareUrl, 80, 970, 130) : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="${COLORS.white}" />
  <!-- thin emerald accent line at top -->
  <rect x="0" y="0" width="1200" height="6" fill="${COLORS.emerald}" />
  ${engagioWordmark(120, 16, COLORS.slateMuted)}
  ${logoBlock}
  <!-- type label -->
  <text x="600" y="380" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="600" letter-spacing="3" fill="${COLORS.emeraldDark}" text-anchor="middle">${emoji}  ${label}</text>
  <!-- main metric -->
  <text x="600" y="480" font-family="Inter, system-ui, sans-serif" font-size="200" font-weight="800" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(metricLine)}</text>
  <text x="600" y="520" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="600" letter-spacing="4" fill="${COLORS.slateMuted}" text-anchor="middle" dy="20">${metricSub}</text>
  ${titleBlock}
  ${subtitleBlock}
  <!-- participant name -->
  <text x="600" y="${780 + (subtitleBlock ? 60 : 0)}" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="700" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(truncate(participantName, 40))}</text>
  <!-- subtle divider -->
  <line x1="540" y1="${830 + (subtitleBlock ? 60 : 0)}" x2="660" y2="${830 + (subtitleBlock ? 60 : 0)}" stroke="${COLORS.emerald}" stroke-width="2" />
  ${qrTag}
  ${poweredByFooter(1130)}
</svg>`
}

// ─── Template 2: modern ────────────────────────────────────────────────────
async function renderModern(p: CardRenderParams): Promise<string> {
  const { type, title, subtitle, participantName, percentage, rank, score, totalScore } = p
  const { emoji, label } = typeLabel(type)

  // Main metric
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

  const titleLines = wrapText(title, 28, 2)
  const titleBlock = titleLines
    .map((line, i) => `<text x="600" y="${690 + i * 50}" font-family="Inter, system-ui, sans-serif" font-size="36" font-weight="700" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  const subtitleBlock = subtitle
    ? `<text x="600" y="${690 + titleLines.length * 50 + 28}" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="400" fill="${COLORS.slateLight}" text-anchor="middle">${escapeXml(truncate(subtitle, 50))}</text>`
    : ""

  const logoBlock = p.orgLogoUrl
    ? orgLogoTag(p.orgLogoUrl, 70, 70, 56)
    : ""

  const qrTag = p.shareUrl ? await buildQrImageTag(p.shareUrl, 80, 970, 130) : ""

  // Geometric shapes background
  const shapes = `
    <circle cx="980" cy="180" r="220" fill="${COLORS.emerald}" opacity="0.08" />
    <circle cx="1090" cy="320" r="90" fill="${COLORS.teal}" opacity="0.12" />
    <circle cx="180" cy="1000" r="160" fill="${COLORS.emerald}" opacity="0.06" />
    <circle cx="80" cy="850" r="60" fill="${COLORS.teal}" opacity="0.1" />
    <rect x="0" y="0" width="1200" height="6" fill="url(#modern-grad)" />
  `

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="modern-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${COLORS.emerald}" />
      <stop offset="100%" stop-color="${COLORS.teal}" />
    </linearGradient>
    <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="20" flood-color="${COLORS.slate}" flood-opacity="0.12" />
    </filter>
  </defs>
  <rect width="1200" height="1200" fill="#f8fafc" />
  ${shapes}
  ${engagioWordmark(120, 16, COLORS.slateMuted)}
  ${logoBlock}
  <!-- type label -->
  <text x="600" y="220" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" letter-spacing="3" fill="${COLORS.emeraldDark}" text-anchor="middle">${emoji}  ${label}</text>
  <!-- rounded score card -->
  <rect x="350" y="280" width="500" height="320" rx="32" ry="32" fill="${COLORS.white}" filter="url(#card-shadow)" />
  <text x="600" y="460" font-family="Inter, system-ui, sans-serif" font-size="120" font-weight="800" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(metricLine)}</text>
  <text x="600" y="540" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="600" letter-spacing="4" fill="${COLORS.slateMuted}" text-anchor="middle">${metricSub}</text>
  ${titleBlock}
  ${subtitleBlock}
  <!-- participant name -->
  <text x="600" y="${830 + (subtitleBlock ? 60 : 0)}" font-family="Inter, system-ui, sans-serif" font-size="30" font-weight="700" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(truncate(participantName, 40))}</text>
  <!-- accent badge under name -->
  <rect x="540" y="${870 + (subtitleBlock ? 60 : 0)}" width="120" height="4" rx="2" fill="${COLORS.emerald}" />
  ${qrTag}
  ${poweredByFooter(1130)}
</svg>`
}

// ─── Template 3: professional ─────────────────────────────────────────────
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

  const titleLines = wrapText(title, 34, 2)
  const titleBlock = titleLines
    .map((line, i) => `<text x="600" y="${690 + i * 52}" font-family="Georgia, 'Times New Roman', serif" font-size="38" font-weight="700" font-style="italic" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  const subtitleBlock = subtitle
    ? `<text x="600" y="${690 + titleLines.length * 52 + 30}" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-weight="400" font-style="italic" fill="${COLORS.slateLight}" text-anchor="middle">${escapeXml(truncate(subtitle, 60))}</text>`
    : ""

  // Org logo top-left (professional template emphasizes the org)
  const logoBlock = p.orgLogoUrl
    ? orgLogoTag(p.orgLogoUrl, 80, 100, 72)
    : ""

  const qrTag = p.shareUrl ? await buildQrImageTag(p.shareUrl, 80, 970, 130) : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="${COLORS.white}" />
  <!-- certificate-style border -->
  <rect x="40" y="40" width="1120" height="1120" fill="none" stroke="${COLORS.emeraldDark}" stroke-width="3" />
  <rect x="56" y="56" width="1088" height="1088" fill="none" stroke="${COLORS.emerald}" stroke-width="1" />
  <!-- corner flourishes -->
  <rect x="40" y="40" width="120" height="6" fill="${COLORS.emeraldDark}" />
  <rect x="40" y="40" width="6" height="120" fill="${COLORS.emeraldDark}" />
  <rect x="1040" y="40" width="120" height="6" fill="${COLORS.emeraldDark}" />
  <rect x="1154" y="40" width="6" height="120" fill="${COLORS.emeraldDark}" />
  <rect x="40" y="1154" width="120" height="6" fill="${COLORS.emeraldDark}" />
  <rect x="40" y="1040" width="6" height="120" fill="${COLORS.emeraldDark}" />
  <rect x="1040" y="1154" width="120" height="6" fill="${COLORS.emeraldDark}" />
  <rect x="1154" y="1040" width="6" height="120" fill="${COLORS.emeraldDark}" />

  ${engagioWordmark(140, 14, COLORS.slateMuted)}
  ${logoBlock}

  <!-- "CERTIFICATE OF ACHIEVEMENT" header -->
  <text x="600" y="260" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-weight="400" letter-spacing="6" fill="${COLORS.slateMuted}" text-anchor="middle">${label}</text>
  <text x="600" y="330" font-family="Georgia, 'Times New Roman', serif" font-size="56" font-weight="700" fill="${COLORS.slate}" text-anchor="middle">Certificate of Achievement</text>
  <!-- divider -->
  <line x1="450" y1="370" x2="750" y2="370" stroke="${COLORS.emerald}" stroke-width="2" />
  <circle cx="600" cy="370" r="5" fill="${COLORS.emerald}" />

  <!-- "This is to certify that" -->
  <text x="600" y="450" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-style="italic" fill="${COLORS.slateLight}" text-anchor="middle">This is to certify that</text>
  <text x="600" y="540" font-family="Georgia, 'Times New Roman', serif" font-size="48" font-weight="700" fill="${COLORS.emeraldDark}" text-anchor="middle">${escapeXml(truncate(participantName, 40))}</text>
  <text x="600" y="600" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-style="italic" fill="${COLORS.slateLight}" text-anchor="middle">has successfully completed</text>

  ${titleBlock}
  ${subtitleBlock}

  <!-- metric -->
  <text x="600" y="${780 + (subtitleBlock ? 80 : 20)}" font-family="Georgia, 'Times New Roman', serif" font-size="80" font-weight="700" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(metricLine)}</text>
  <text x="600" y="${820 + (subtitleBlock ? 80 : 20)}" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" letter-spacing="4" fill="${COLORS.slateMuted}" text-anchor="middle" dy="20">${metricSub}</text>

  ${qrTag}
  ${poweredByFooter(1130)}
</svg>`
}

// ─── Template 4: celebration ───────────────────────────────────────────────
async function renderCelebration(p: CardRenderParams): Promise<string> {
  const { type, title, subtitle, participantName, percentage, rank, score, totalScore } = p
  const { emoji, label } = typeLabel(type)

  // For celebration: prefer rank medal, then percentage
  let metricLine = ""
  let metricSub = ""
  let medal = ""
  if (rank != null && rank > 0) {
    medal = rankMedal(rank)
    metricLine = `${rank}${rankSuffix(rank)}`
    metricSub = `RANK${p.totalParticipants ? ` · OF ${p.totalParticipants}` : ""}`
  } else if (percentage != null && percentage >= 0) {
    metricLine = `${percentage}%`
    metricSub = "SCORE"
    medal = "🎉"
  } else if (score != null && totalScore != null) {
    metricLine = `${score}/${totalScore}`
    metricSub = "POINTS"
    medal = "🎉"
  } else {
    metricLine = "🎉"
    metricSub = "COMPLETED"
  }

  const titleLines = wrapText(title, 28, 2)
  const titleBlock = titleLines
    .map((line, i) => `<text x="600" y="${720 + i * 50}" font-family="Inter, system-ui, sans-serif" font-size="36" font-weight="800" fill="${COLORS.white}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  const subtitleBlock = subtitle
    ? `<text x="600" y="${720 + titleLines.length * 50 + 32}" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="500" fill="${COLORS.slateFaint}" text-anchor="middle">${escapeXml(truncate(subtitle, 50))}</text>`
    : ""

  const logoBlock = p.orgLogoUrl
    ? `<g opacity="0.9">${orgLogoTag(p.orgLogoUrl, 70, 70, 56)}</g>`
    : ""

  const qrTag = p.shareUrl ? await buildQrImageTag(p.shareUrl, 80, 970, 130) : ""

  // Confetti dots (deterministic positions, varying sizes/colors)
  const confettiColors = [COLORS.emerald, COLORS.teal, COLORS.gold, COLORS.amber, COLORS.rose]
  let confetti = ""
  const seed = 12345
  let s = seed
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rand() * 1200)
    const y = Math.floor(rand() * 600)
    const r = 4 + Math.floor(rand() * 8)
    const c = confettiColors[i % confettiColors.length]
    const op = 0.4 + rand() * 0.5
    confetti += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${op.toFixed(2)}" />`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="celeb-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064e3b" />
      <stop offset="50%" stop-color="#047857" />
      <stop offset="100%" stop-color="#0f766e" />
    </linearGradient>
    <linearGradient id="medal-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${COLORS.gold}" />
      <stop offset="100%" stop-color="${COLORS.amber}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#celeb-bg)" />
  ${confetti}
  ${engagioWordmark(120, 16, "#a7f3d0")}
  ${logoBlock}
  <!-- type label -->
  <text x="600" y="220" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" letter-spacing="3" fill="${COLORS.gold}" text-anchor="middle">${emoji}  ${label}</text>
  <!-- medal -->
  <circle cx="600" cy="380" r="90" fill="url(#medal-grad)" />
  <circle cx="600" cy="380" r="90" fill="none" stroke="${COLORS.white}" stroke-width="3" opacity="0.5" />
  <text x="600" y="400" font-size="80" text-anchor="middle">${medal}</text>
  <!-- ribbon -->
  <path d="M 540 460 L 540 540 L 580 510 L 600 540 L 620 510 L 660 540 L 660 460 Z" fill="${COLORS.gold}" opacity="0.8" />

  <!-- metric -->
  <text x="600" y="620" font-family="Inter, system-ui, sans-serif" font-size="130" font-weight="900" fill="${COLORS.white}" text-anchor="middle">${escapeXml(metricLine)}</text>
  <text x="600" y="660" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="700" letter-spacing="4" fill="${COLORS.gold}" text-anchor="middle" dy="20">${metricSub}</text>

  ${titleBlock}
  ${subtitleBlock}

  <!-- participant name pill -->
  <rect x="350" y="${830 + (subtitleBlock ? 60 : 0)}" width="500" height="60" rx="30" ry="30" fill="${COLORS.white}" opacity="0.15" />
  <text x="600" y="${870 + (subtitleBlock ? 60 : 0)}" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="800" fill="${COLORS.white}" text-anchor="middle">${escapeXml(truncate(participantName, 40))}</text>

  ${qrTag}
  ${poweredByFooter(1130)}
</svg>`
}

// ─── Template 5: conference ────────────────────────────────────────────────
async function renderConference(p: CardRenderParams): Promise<string> {
  const { type, title, subtitle, participantName, percentage, rank, score, totalScore } = p
  const { emoji, label } = typeLabel(type)

  // For conference template, event name (subtitle) is prominent
  const eventName = subtitle || p.achievementData?.eventTitle || title

  // Metric line (smaller — event is the hero here)
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

  // Title here = activity title, shown smaller below event
  const activityTitle = p.achievementData?.activityTitle || title
  const activityLines = wrapText(activityTitle, 30, 2)
  const activityBlock = activityLines
    .map((line, i) => `<text x="600" y="${620 + i * 44}" font-family="Inter, system-ui, sans-serif" font-size="26" font-weight="500" fill="${COLORS.slateLight}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  const eventLines = wrapText(eventName, 26, 2)
  const eventBlock = eventLines
    .map((line, i) => `<text x="600" y="${500 + i * 50}" font-family="Inter, system-ui, sans-serif" font-size="42" font-weight="800" fill="${COLORS.slate}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  const logoBlock = p.orgLogoUrl
    ? orgLogoTag(p.orgLogoUrl, 70, 70, 56)
    : ""

  const qrTag = p.shareUrl ? await buildQrImageTag(p.shareUrl, 80, 970, 130) : ""

  // conference badge background
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="conf-header" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${COLORS.emeraldDark}" />
      <stop offset="100%" stop-color="${COLORS.tealDark}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="${COLORS.white}" />
  <!-- header band -->
  <rect x="0" y="0" width="1200" height="280" fill="url(#conf-header)" />
  <!-- header decorative circles -->
  <circle cx="1100" cy="60" r="120" fill="${COLORS.white}" opacity="0.06" />
  <circle cx="1180" cy="180" r="60" fill="${COLORS.white}" opacity="0.08" />

  <!-- ENGAGIO wordmark in header (white) -->
  <text x="600" y="80" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="700" letter-spacing="4" fill="${COLORS.white}" text-anchor="middle" opacity="0.9">ENGAGIO</text>

  <!-- type label in header -->
  <text x="600" y="140" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="600" letter-spacing="3" fill="#a7f3d0" text-anchor="middle">${emoji}  ${label}</text>

  <!-- "ATTENDEE" -->
  <text x="600" y="200" font-family="Inter, system-ui, sans-serif" font-size="38" font-weight="800" fill="${COLORS.white}" text-anchor="middle">ATTENDEE · ${escapeXml(truncate(participantName, 30))}</text>

  ${logoBlock}

  <!-- event name -->
  ${eventBlock}
  ${activityBlock}

  <!-- metric -->
  <rect x="430" y="${680 + activityLines.length * 44}" width="340" height="60" rx="30" ry="30" fill="#ecfdf5" />
  <text x="600" y="${720 + activityLines.length * 44}" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="700" fill="${COLORS.emeraldDark}" text-anchor="middle">${escapeXml(metricLine)}</text>

  <!-- date / org -->
  <text x="600" y="880" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="500" fill="${COLORS.slateMuted}" text-anchor="middle">${escapeXml(truncate(p.achievementData?.orgName || "Engagio", 60))}</text>

  ${qrTag}
  ${poweredByFooter(1130)}
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

/** Render only the SVG (synchronous-ish, but QR generation is async). */
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
    return { png, svg }
  } catch (e) {
    console.error("[card-renderer] sharp SVG→PNG failed; returning SVG buffer:", e)
    // Fall back to encoding the SVG as UTF-8 bytes — callers can detect via
    // the content type or by inspecting the first bytes ("<svg" vs PNG magic).
    return { png: Buffer.from(svg, "utf-8"), svg }
  }
}
