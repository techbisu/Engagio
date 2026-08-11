/**
 * Server-side card renderer for shareable achievement cards.
 *
 * ─── Design: Ticket-style digital card ─────────────────────────────────────
 * All templates now use a unified "ticket" aesthetic inspired by digital
 * wallet passes and event tickets:
 *   - Dark navy background (#0b1120) with a subtle radial glow
 *   - Thin glowing teal border (rounded corners)
 *   - Header: Engagio logo + "Verified" badge
 *   - Hero: Big metric (score/rank) OR recipient name
 *   - Body: Event/quiz title + date + type label
 *   - Footer: Serial number (mono font) + QR code
 *   - Portrait 1200×1500 (4:5) — optimized for mobile sharing
 *
 * Templates control the ACCENT COLOR and small decorative variations:
 *   1. minimal       — teal accent, no decorations
 *   2. modern        — teal→emerald gradient accent
 *   3. professional  — amber accent (formal)
 *   4. celebration   — gold accent + subtle confetti dots
 *   5. conference    — slate→teal accent
 *
 * ─── Font availability note ────────────────────────────────────────────────
 * Uses `DejaVu Sans` (pre-installed on Vercel/Amazon Linux) to avoid the
 * "tofu" boxes (□□□□) caused by missing Inter font. Mono uses DejaVu Sans Mono.
 */

import sharp from "sharp"
import { generateAchievementQr } from "./achievement"
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
  shareUrl?: string
}

export interface RenderedCard {
  png: Buffer
  svg: string
}

// ─── Dimensions (portrait 4:5 ticket) ───────────────────────────────────────
const W = 1200
const H = 1500

// ─── Font stacks (Linux/Vercel-safe) ────────────────────────────────────────
const FONT_SANS = "DejaVu Sans, Liberation Sans, Arial, sans-serif"
const FONT_MONO = "DejaVu Sans Mono, Liberation Mono, Courier New, monospace"

// ─── Colors ────────────────────────────────────────────────────────────────
const C = {
  bg: "#0b1120",
  bgGlow: "#0f172a",
  surface: "#1e293b",
  surfaceLight: "#334155",
  white: "#ffffff",
  slate100: "#f1f5f9",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  emerald: "#10b981",
  emeraldLight: "#34d399",
  emeraldDark: "#059669",
  teal: "#14b8a6",
  tealLight: "#2dd4bf",
  amber: "#f59e0b",
  amberLight: "#fbbf24",
  gold: "#fbbf24",
  rose: "#f43f5e",
}

// ─── Per-template accent colors ─────────────────────────────────────────────
interface TemplateTheme {
  accent: string
  accentLight: string
  accentDark: string
  glow: string
  label: string
}

const THEMES: Record<AchievementTemplateId, TemplateTheme> = {
  minimal: {
    accent: C.teal,
    accentLight: C.tealLight,
    accentDark: "#0f766e",
    glow: "rgba(20,184,166,0.35)",
    label: "ACHIEVEMENT",
  },
  modern: {
    accent: C.emerald,
    accentLight: C.emeraldLight,
    accentDark: C.emeraldDark,
    glow: "rgba(16,185,129,0.35)",
    label: "ACHIEVEMENT",
  },
  professional: {
    accent: C.amber,
    accentLight: C.amberLight,
    accentDark: "#d97706",
    glow: "rgba(245,158,11,0.30)",
    label: "CERTIFICATE",
  },
  celebration: {
    accent: C.gold,
    accentLight: "#fde68a",
    accentDark: "#d97706",
    glow: "rgba(251,191,36,0.35)",
    label: "ACHIEVEMENT",
  },
  conference: {
    accent: C.teal,
    accentLight: C.tealLight,
    accentDark: "#0f766e",
    glow: "rgba(20,184,166,0.30)",
    label: "ATTENDEE PASS",
  },
}

// ─── Type label ────────────────────────────────────────────────────────────
function typeInfo(type: AchievementType): { emoji: string; label: string } {
  switch (type) {
    case "QUIZ_RESULT":
    case "KNOWLEDGE_CHECK_RESULT":
      return { emoji: "🧠", label: "QUIZ RESULT" }
    case "LIVE_QUIZ_RESULT":
      return { emoji: "⚡", label: "LIVE QUIZ" }
    case "PRE_POST_RESULT":
      return { emoji: "📈", label: "LEARNING PROGRESS" }
    case "CERTIFICATE_EARNED":
      return { emoji: "🎓", label: "CERTIFICATE OF COMPLETION" }
    case "ACTIVITY_COMPLETED":
    case "EVENT_PARTICIPATION":
      return { emoji: "💬", label: "PARTICIPATION" }
    case "LEADERBOARD_ACHIEVEMENT":
      return { emoji: "🏆", label: "LEADERBOARD" }
    default:
      return { emoji: "🏆", label: "ACHIEVEMENT" }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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

/** Generate a ticket-style serial number from the achievement data. */
function buildSerialNumber(p: CardRenderParams): string {
  const orgCode = (p.achievementData?.orgName || "ENG")
    .replace(/[^A-Z]/gi, "")
    .toUpperCase()
    .slice(0, 3) || "ENG"
  const year = new Date().getFullYear()
  const hash = (p.title + p.participantName)
    .split("")
    .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffffff, 7)
    .toString(36)
    .toUpperCase()
    .padStart(6, "0")
    .slice(0, 6)
  return `${orgCode}-${year}-${hash}`
}

// ─── QR code ───────────────────────────────────────────────────────────────

async function buildQrImageTag(shareUrl: string, x: number, y: number, size = 200): Promise<string> {
  try {
    const dataUrl = await generateAchievementQr(shareUrl)
    return `<image href="${dataUrl}" x="${x}" y="${y}" width="${size}" height="${size}" />`
  } catch {
    return ""
  }
}

function orgLogoTag(url: string, x: number, y: number, size = 56): string {
  return `<image href="${escapeXml(url)}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" />`
}

// ─── Main ticket renderer ──────────────────────────────────────────────────

async function renderTicket(p: CardRenderParams): Promise<string> {
  const theme = THEMES[p.templateId] || THEMES.modern
  const info = typeInfo(p.type)
  const { title, subtitle, participantName, percentage, rank, score, totalScore, totalParticipants } = p

  // ─── Determine the hero metric ───────────────────────────────────────────
  // For quiz results: show the score/percentage as the hero.
  // For certificates: show the participant name as the hero.
  // For participation/leaderboard: show the rank or a checkmark.
  let heroLine = ""
  let heroSub = ""
  let heroSuffix = ""

  const hasPercent = typeof percentage === "number" && percentage >= 0
  const hasRank = typeof rank === "number" && rank > 0
  const hasScore = typeof score === "number" && typeof totalScore === "number"
  const isCertificate = p.type === "CERTIFICATE_EARNED"

  if (isCertificate) {
    // Certificate: no metric hero — the name IS the hero.
    heroLine = ""
  } else if (hasPercent) {
    heroLine = String(percentage)
    heroSuffix = "%"
    heroSub = "SCORE"
  } else if (hasRank) {
    heroLine = String(rank)
    heroSuffix = rankSuffix(rank)
    heroSub = totalParticipants ? `RANK OF ${totalParticipants}` : "RANK"
  } else if (hasScore) {
    heroLine = `${score}/${totalScore}`
    heroSub = "POINTS"
  } else {
    heroLine = "✓"
    heroSub = "COMPLETED"
  }

  // ─── Date ────────────────────────────────────────────────────────────────
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // ─── Serial number ───────────────────────────────────────────────────────
  const serial = buildSerialNumber(p)

  // ─── Title wrapping ──────────────────────────────────────────────────────
  const titleLines = wrapText(title, 28, 2)
  const titleBlock = titleLines
    .map((line, i) => `<text x="${W / 2}" y="${870 + i * 52}" font-family="${FONT_SANS}" font-size="38" font-weight="700" fill="${C.white}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  // ─── Subtitle (event/activity name) ──────────────────────────────────────
  const subtitleText = subtitle || p.achievementData?.eventTitle || ""
  const subtitleLines = subtitleText ? wrapText(subtitleText, 32, 2) : []
  const subtitleBlock = subtitleLines
    .map((line, i) => `<text x="${W / 2}" y="${870 + titleLines.length * 52 + 24 + i * 40}" font-family="${FONT_SANS}" font-size="26" font-weight="400" fill="${C.slate300}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  // ─── Participant name wrapping ───────────────────────────────────────────
  const nameLines = wrapText(participantName, 24, 2)
  const nameBlock = nameLines
    .map((line, i) => `<text x="${W / 2}" y="${isCertificate ? 680 : 620 + i * 60}" font-family="${FONT_SANS}" font-size="${isCertificate ? 52 : 44}" font-weight="800" fill="${C.white}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  // ─── QR code ─────────────────────────────────────────────────────────────
  const qrSize = 180
  const qrX = W - 80 - qrSize
  const qrY = H - 80 - qrSize
  const qrTag = p.shareUrl ? await buildQrImageTag(p.shareUrl, qrX, qrY, qrSize) : ""

  // ─── Org logo (small, in header) ─────────────────────────────────────────
  const logoBlock = p.orgLogoUrl ? orgLogoTag(p.orgLogoUrl, 80, 82, 48) : ""

  // ─── Subtle confetti dots for celebration template ───────────────────────
  let decorations = ""
  if (p.templateId === "celebration") {
    let s = 12345
    const rand = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    const dotColors = [theme.accent, theme.accentLight, C.rose, C.emerald]
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(rand() * W)
      const y = Math.floor(rand() * 500)
      const r = 3 + Math.floor(rand() * 6)
      const c = dotColors[i % dotColors.length]
      const op = 0.15 + rand() * 0.25
      decorations += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${op.toFixed(2)}" />`
    }
  }

  // ─── Hero metric block (only for non-certificate types) ──────────────────
  const heroBlock = isCertificate ? "" : `
    <!-- Hero metric -->
    <text x="${W / 2}" y="530" font-family="${FONT_SANS}" font-size="130" font-weight="900" fill="${C.white}" text-anchor="middle">${escapeXml(heroLine)}<tspan font-size="60" font-weight="700" fill="${theme.accentLight}" dx="4">${heroSuffix}</tspan></text>
    <text x="${W / 2}" y="575" font-family="${FONT_SANS}" font-size="20" font-weight="700" letter-spacing="6" fill="${theme.accent}" text-anchor="middle" dy="20">${heroSub}</text>
  `

  // ─── "has successfully completed" text (for certificates) ────────────────
  const completedText = isCertificate
    ? `<text x="${W / 2}" y="560" font-family="${FONT_SANS}" font-size="24" font-style="italic" fill="${C.slate400}" text-anchor="middle">has successfully completed</text>`
    : ""

  // ─── Assemble the SVG ────────────────────────────────────────────────────
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <!-- Background gradient -->
    <radialGradient id="bg-glow" cx="50%" cy="35%" r="60%">
      <stop offset="0%" stop-color="${C.bgGlow}" />
      <stop offset="100%" stop-color="${C.bg}" />
    </radialGradient>
    <!-- Accent glow for border -->
    <filter id="border-glow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <!-- Verified badge gradient -->
    <linearGradient id="verified-bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.2" />
      <stop offset="100%" stop-color="${theme.accentLight}" stop-opacity="0.15" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg-glow)" />
  ${decorations}

  <!-- Ticket card with glowing border -->
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="32" ry="32"
        fill="${C.bgGlow}" stroke="${theme.accent}" stroke-width="2" opacity="0.98" />
  <!-- Inner subtle border glow -->
  <rect x="44" y="44" width="${W - 88}" height="${H - 88}" rx="28" ry="28"
        fill="none" stroke="${theme.accent}" stroke-width="1" opacity="0.3" />

  <!-- ═══ HEADER ═══════════════════════════════════════════════════════════ -->
  <!-- Engagio logo (teal rounded square with star) -->
  <rect x="80" y="82" width="48" height="48" rx="12" ry="12" fill="${theme.accent}" />
  <path d="M 104 94 L 109 107 L 122 108 L 112 117 L 116 130 L 104 122 L 92 130 L 96 117 L 86 108 L 99 107 Z" fill="${C.white}" />
  <text x="140" y="116" font-family="${FONT_SANS}" font-size="24" font-weight="800" fill="${C.white}" letter-spacing="2">Engagio</text>
  ${logoBlock}

  <!-- Verified badge (top-right) -->
  <rect x="${W - 250}" y="82" width="170" height="48" rx="24" ry="24" fill="url(#verified-bg)" stroke="${theme.accent}" stroke-width="1" opacity="0.9" />
  <path d="M ${W - 225} 106 L ${W - 218} 113 L ${W - 205} 100" stroke="${theme.accent}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  <text x="${W - 190}" y="113" font-family="${FONT_SANS}" font-size="16" font-weight="700" fill="${theme.accentLight}" letter-spacing="1">Verified</text>

  <!-- Header divider -->
  <line x1="80" y1="160" x2="${W - 80}" y2="160" stroke="${C.slate600}" stroke-width="1" opacity="0.5" />

  <!-- ═══ TYPE LABEL ══════════════════════════════════════════════════════ -->
  <text x="${W / 2}" y="230" font-family="${FONT_SANS}" font-size="18" font-weight="700" letter-spacing="8" fill="${theme.accent}" text-anchor="middle">${info.emoji}  ${info.label}</text>

  <!-- ═══ HERO METRIC (non-certificate) ═══════════════════════════════════ -->
  ${heroBlock}

  <!-- ═══ PARTICIPANT NAME ═════════════════════════════════════════════════ -->
  ${isCertificate ? `<text x="${W / 2}" y="530" font-family="${FONT_SANS}" font-size="22" font-weight="400" fill="${C.slate400}" text-anchor="middle">This certifies that</text>` : ""}
  ${completedText}
  ${nameBlock}

  <!-- ═══ TITLE / EVENT NAME ═══════════════════════════════════════════════ -->
  ${!isCertificate && !hasPercent && !hasRank && !hasScore ? "" : `<text x="${W / 2}" y="${isCertificate ? 780 : 810}" font-family="${FONT_SANS}" font-size="18" font-weight="400" fill="${C.slate400}" text-anchor="middle">${isCertificate ? "has successfully completed" : ""}</text>`}
  ${titleBlock}
  ${subtitleBlock}

  <!-- ═══ DATE ═════════════════════════════════════════════════════════════ -->
  <text x="${W / 2}" y="${960 + (titleLines.length - 1) * 52 + (subtitleLines.length * 40)}" font-family="${FONT_SANS}" font-size="22" font-weight="400" fill="${C.slate400}" text-anchor="middle">Issued on ${dateStr}</text>

  <!-- ═══ ORG NAME (centered, subtle) ══════════════════════════════════════ -->
  ${p.achievementData?.orgName ? `<text x="${W / 2}" y="${1020 + (titleLines.length - 1) * 52 + (subtitleLines.length * 40)}" font-family="${FONT_SANS}" font-size="20" font-weight="600" fill="${C.slate300}" text-anchor="middle">${escapeXml(truncate(p.achievementData.orgName, 50))}</text>` : ""}

  <!-- ═══ FOOTER DIVIDER ═══════════════════════════════════════════════════ -->
  <line x1="80" y1="${H - 300}" x2="${W - 80}" y2="${H - 300}" stroke="${C.slate600}" stroke-width="1" opacity="0.5" stroke-dasharray="4 8" />

  <!-- ═══ FOOTER: SERIAL + QR ══════════════════════════════════════════════ -->
  <!-- Serial number (left) -->
  <text x="80" y="${H - 240}" font-family="${FONT_SANS}" font-size="12" font-weight="700" letter-spacing="3" fill="${C.slate500}">${theme.label} NO.</text>
  <text x="80" y="${H - 200}" font-family="${FONT_MONO}" font-size="28" font-weight="700" fill="${C.white}">${escapeXml(serial)}</text>

  <!-- Share URL (left, small) -->
  ${p.shareUrl ? `<text x="80" y="${H - 150}" font-family="${FONT_MONO}" font-size="14" font-weight="400" fill="${C.slate500}">engagio.app/s/${escapeXml(serial.split("-").pop() || "")}</text>` : ""}

  <!-- QR code (right) -->
  ${qrTag ? `<rect x="${qrX - 12}" y="${qrY - 12}" width="${qrSize + 24}" height="${qrSize + 24}" rx="16" ry="16" fill="${C.surface}" />` : ""}
  ${qrTag}
  <text x="${qrX + qrSize / 2}" y="${qrY + qrSize + 35}" font-family="${FONT_SANS}" font-size="12" font-weight="600" letter-spacing="2" fill="${C.slate500}" text-anchor="middle">SCAN TO VERIFY</text>

  <!-- Powered by Engagio (bottom center) -->
  <text x="${W / 2}" y="${H - 70}" font-family="${FONT_SANS}" font-size="14" font-weight="500" fill="${C.slate500}" text-anchor="middle">Powered by Engagio · Engage. Learn. Connect.</text>
</svg>`
}

/** Render only the SVG. */
export async function renderCardSvg(p: CardRenderParams): Promise<string> {
  return renderTicket(p)
}

/**
 * Render the card and convert SVG → PNG via sharp.
 * Falls back to returning the SVG buffer if sharp fails.
 */
export async function renderCard(p: CardRenderParams): Promise<RenderedCard> {
  const svg = await renderTicket(p)
  try {
    const png = await sharp(Buffer.from(svg), { density: 144 })
      .resize(W, H, { fit: "cover" })
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
