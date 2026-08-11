/**
 * Server-side card renderer for shareable achievement cards.
 *
 * ─── Design: Clean white certificate-style card ─────────────────────────────
 * White background, emerald/teal accents, clean typography.
 * Inspired by digital credentials (Credly, Accredible).
 *
 * Layout:
 *   - Header: Engagio logo + "Verified" badge
 *   - Type label (QUIZ RESULT / CERTIFICATE OF COMPLETION / etc.)
 *   - Hero metric (score/rank) OR recipient name (for certificates)
 *   - Event/quiz title + subtitle
 *   - Date + org name
 *   - Footer: Serial number (mono) + QR code
 *   - Portrait 1200×1500 (4:5)
 *
 * ─── Font embedding (fixes tofu boxes on Vercel) ───────────────────────────
 * The SVG embeds DejaVu Sans as a base64 @font-face. This guarantees text
 * renders correctly on ANY server (Vercel, local, etc.) without depending on
 * system-installed fonts. The font is subsetted to ~13KB (Latin + numbers +
 * punctuation only) so it doesn't bloat the SVG.
 */

import sharp from "sharp"
import { readFileSync } from "fs"
import { join } from "path"
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

// ─── Dimensions ─────────────────────────────────────────────────────────────
const W = 1200
const H = 1500

// ─── Font stacks ────────────────────────────────────────────────────────────
const FONT_SANS = "DejaVu Sans, sans-serif"
const FONT_MONO = "DejaVu Sans Mono, monospace"

// ─── Load embedded fonts (subsetted, ~13KB each) ────────────────────────────
let fontSansB64: string | null = null
let fontSansBoldB64: string | null = null
let fontMonoB64: string | null = null

function loadFonts(): void {
  if (fontSansB64) return
  try {
    const fontsDir = join(process.cwd(), "public", "fonts")
    fontSansB64 = readFileSync(join(fontsDir, "DejaVuSans.ttf")).toString("base64")
    fontSansBoldB64 = readFileSync(join(fontsDir, "DejaVuSans-Bold.ttf")).toString("base64")
    fontMonoB64 = readFileSync(join(fontsDir, "DejaVuSansMono.ttf")).toString("base64")
  } catch {
    // Fallback: fonts not found — SVG will use generic sans-serif
    fontSansB64 = ""
    fontSansBoldB64 = ""
    fontMonoB64 = ""
  }
}

/** Build the @font-face CSS block with embedded base64 fonts. */
function fontFaceCss(): string {
  loadFonts()
  if (!fontSansB64) return ""
  return `
    <style type="text/css">
      @font-face {
        font-family: "DejaVu Sans";
        src: url("data:font/ttf;base64,${fontSansB64}") format("truetype");
        font-weight: normal;
        font-style: normal;
      }
      @font-face {
        font-family: "DejaVu Sans";
        src: url("data:font/ttf;base64,${fontSansBoldB64}") format("truetype");
        font-weight: bold;
        font-style: normal;
      }
      @font-face {
        font-family: "DejaVu Sans Mono";
        src: url("data:font/ttf;base64,${fontMonoB64}") format("truetype");
        font-weight: normal;
        font-style: normal;
      }
    </style>
  `
}

// ─── Colors ────────────────────────────────────────────────────────────────
const C = {
  white: "#ffffff",
  bgLight: "#f8fafc",
  bgCard: "#ffffff",
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate300: "#cbd5e1",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  emerald: "#10b981",
  emeraldDark: "#059669",
  emeraldLight: "#34d399",
  emerald50: "#ecfdf5",
  emerald100: "#d1fae5",
  teal: "#14b8a6",
  tealDark: "#0f766e",
  amber: "#f59e0b",
  amberDark: "#d97706",
  amberLight: "#fbbf24",
  gold: "#fbbf24",
  goldLight: "#fde68a",
  rose: "#f43f5e",
}

// ─── Per-template accent colors ─────────────────────────────────────────────
interface TemplateTheme {
  accent: string
  accentDark: string
  accentLight: string
  accentBg: string
  label: string
}

const THEMES: Record<AchievementTemplateId, TemplateTheme> = {
  minimal: {
    accent: C.teal,
    accentDark: C.tealDark,
    accentLight: C.teal,
    accentBg: C.emerald50,
    label: "ACHIEVEMENT",
  },
  modern: {
    accent: C.emerald,
    accentDark: C.emeraldDark,
    accentLight: C.emeraldLight,
    accentBg: C.emerald50,
    label: "ACHIEVEMENT",
  },
  professional: {
    accent: C.amber,
    accentDark: C.amberDark,
    accentLight: C.amberLight,
    accentBg: "#fffbeb",
    label: "CERTIFICATE",
  },
  celebration: {
    accent: C.amber,
    accentDark: C.amberDark,
    accentLight: C.gold,
    accentBg: "#fffbeb",
    label: "ACHIEVEMENT",
  },
  conference: {
    accent: C.teal,
    accentDark: C.tealDark,
    accentLight: C.teal,
    accentBg: C.emerald50,
    label: "ATTENDEE PASS",
  },
}

// ─── Type info ─────────────────────────────────────────────────────────────
function typeInfo(type: AchievementType): { emoji: string; label: string } {
  switch (type) {
    case "QUIZ_RESULT":
    case "KNOWLEDGE_CHECK_RESULT":
      return { emoji: "", label: "QUIZ RESULT" }
    case "LIVE_QUIZ_RESULT":
      return { emoji: "", label: "LIVE QUIZ RESULT" }
    case "PRE_POST_RESULT":
      return { emoji: "", label: "LEARNING PROGRESS" }
    case "CERTIFICATE_EARNED":
      return { emoji: "", label: "CERTIFICATE OF COMPLETION" }
    case "ACTIVITY_COMPLETED":
    case "EVENT_PARTICIPATION":
      return { emoji: "", label: "PARTICIPATION" }
    case "LEADERBOARD_ACHIEVEMENT":
      return { emoji: "", label: "LEADERBOARD ACHIEVEMENT" }
    default:
      return { emoji: "", label: "ACHIEVEMENT" }
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
  return s.slice(0, max - 1).trimEnd() + "..."
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

async function buildQrImageTag(shareUrl: string, x: number, y: number, size = 180): Promise<string> {
  try {
    const dataUrl = await generateAchievementQr(shareUrl)
    return `<image href="${dataUrl}" x="${x}" y="${y}" width="${size}" height="${size}" />`
  } catch {
    return ""
  }
}

function orgLogoTag(url: string, x: number, y: number, size = 48): string {
  return `<image href="${escapeXml(url)}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" />`
}

// ─── Checkmark SVG path (for "Verified" badge) ─────────────────────────────
const CHECKMARK_PATH = "M 20 6 L 9 17 L 4 12"

// ─── Main card renderer (builds the SVG string) ────────────────────────────

async function renderCardSvgInternal(p: CardRenderParams): Promise<string> {
  const theme = THEMES[p.templateId] || THEMES.modern
  const info = typeInfo(p.type)
  const { title, subtitle, participantName, percentage, rank, score, totalScore, totalParticipants } = p

  // ─── Determine the hero metric ───────────────────────────────────────────
  let heroLine = ""
  let heroSub = ""
  let heroSuffix = ""

  const hasPercent = typeof percentage === "number" && percentage >= 0
  const hasRank = typeof rank === "number" && rank > 0
  const hasScore = typeof score === "number" && typeof totalScore === "number"
  const isCertificate = p.type === "CERTIFICATE_EARNED"

  if (isCertificate) {
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
    heroLine = ""
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
  const titleLines = wrapText(title, 30, 2)
  const titleBlock = titleLines
    .map((line, i) => `<text x="${W / 2}" y="${920 + i * 52}" font-family="${FONT_SANS}" font-size="36" font-weight="700" fill="${C.slate900}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  // ─── Subtitle ────────────────────────────────────────────────────────────
  const subtitleText = subtitle || p.achievementData?.eventTitle || ""
  const subtitleLines = subtitleText ? wrapText(subtitleText, 36, 2) : []
  const subtitleBlock = subtitleLines
    .map((line, i) => `<text x="${W / 2}" y="${920 + titleLines.length * 52 + 30 + i * 40}" font-family="${FONT_SANS}" font-size="24" font-weight="400" fill="${C.slate500}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  // ─── Participant name wrapping ───────────────────────────────────────────
  const nameLines = wrapText(participantName, 26, 2)
  const nameY = isCertificate ? 680 : 620
  const nameBlock = nameLines
    .map((line, i) => `<text x="${W / 2}" y="${nameY + i * 60}" font-family="${FONT_SANS}" font-size="${isCertificate ? 52 : 44}" font-weight="800" fill="${C.slate900}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("")

  // ─── QR code ─────────────────────────────────────────────────────────────
  const qrSize = 170
  const qrX = W - 80 - qrSize
  const qrY = H - 80 - qrSize
  const qrTag = p.shareUrl ? await buildQrImageTag(p.shareUrl, qrX, qrY, qrSize) : ""

  // ─── Org logo (small, in header) ─────────────────────────────────────────
  const logoBlock = p.orgLogoUrl ? orgLogoTag(p.orgLogoUrl, W - 80 - 48, 82, 48) : ""

  // ─── Hero metric block (only for non-certificate types) ──────────────────
  const heroBlock = isCertificate ? "" : `
    <text x="${W / 2}" y="530" font-family="${FONT_SANS}" font-size="130" font-weight="800" fill="${C.slate900}" text-anchor="middle">${escapeXml(heroLine)}<tspan font-size="60" font-weight="700" fill="${theme.accent}" dx="4">${heroSuffix}</tspan></text>
    <text x="${W / 2}" y="575" font-family="${FONT_SANS}" font-size="20" font-weight="700" letter-spacing="6" fill="${theme.accent}" text-anchor="middle" dy="20">${heroSub}</text>
  `

  // ─── "has successfully completed" text (for certificates) ────────────────
  const completedText = isCertificate
    ? `<text x="${W / 2}" y="560" font-family="${FONT_SANS}" font-size="24" font-style="italic" fill="${C.slate500}" text-anchor="middle">has successfully completed</text>`
    : ""

  // ─── "This certifies that" (for certificates) ────────────────────────────
  const certifiesText = isCertificate
    ? `<text x="${W / 2}" y="530" font-family="${FONT_SANS}" font-size="22" font-weight="400" fill="${C.slate400}" text-anchor="middle">This certifies that</text>`
    : ""

  // ─── "Awarded to" (for non-certificates) ─────────────────────────────────
  const awardedToText = !isCertificate
    ? `<text x="${W / 2}" y="${nameY - 30}" font-family="${FONT_SANS}" font-size="20" font-weight="400" fill="${C.slate400}" text-anchor="middle">Awarded to</text>`
    : ""

  // ─── Assemble the SVG ────────────────────────────────────────────────────
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${fontFaceCss()}

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="${C.bgLight}" />

  <!-- Card with subtle shadow -->
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="24" ry="24" fill="${C.white}" stroke="${C.slate200}" stroke-width="1" />

  <!-- Top accent bar -->
  <rect x="40" y="40" width="${W - 80}" height="6" rx="3" ry="3" fill="${theme.accent}" />

  <!-- ═══ HEADER ═══════════════════════════════════════════════════════════ -->
  <!-- Engagio logo (green rounded square with star) -->
  <rect x="80" y="82" width="48" height="48" rx="12" ry="12" fill="${theme.accent}" />
  <path d="M 104 94 L 109 107 L 122 108 L 112 117 L 116 130 L 104 122 L 92 130 L 96 117 L 86 108 L 99 107 Z" fill="${C.white}" />
  <text x="140" y="116" font-family="${FONT_SANS}" font-size="24" font-weight="800" fill="${C.slate900}" letter-spacing="1">Engagio</text>
  ${logoBlock}

  <!-- Verified badge (top-right) -->
  <rect x="${W - 240}" y="82" width="160" height="48" rx="24" ry="24" fill="${theme.accentBg}" stroke="${theme.accent}" stroke-width="1.5" />
  <circle cx="${W - 210}" cy="106" r="10" fill="${theme.accent}" />
  <polyline points="${W - 215},106 ${W - 211},110 ${W - 204},102" stroke="${C.white}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  <text x="${W - 190}" y="113" font-family="${FONT_SANS}" font-size="16" font-weight="700" fill="${theme.accentDark}">Verified</text>

  <!-- Header divider -->
  <line x1="80" y1="160" x2="${W - 80}" y2="160" stroke="${C.slate200}" stroke-width="1" />

  <!-- ═══ TYPE LABEL ══════════════════════════════════════════════════════ -->
  <text x="${W / 2}" y="230" font-family="${FONT_SANS}" font-size="18" font-weight="700" letter-spacing="8" fill="${theme.accent}" text-anchor="middle">${info.label}</text>

  <!-- Decorative line under label -->
  <line x1="${W / 2 - 40}" y1="250" x2="${W / 2 + 40}" y2="250" stroke="${theme.accent}" stroke-width="2" />

  <!-- ═══ HERO METRIC (non-certificate) ═══════════════════════════════════ -->
  ${heroBlock}

  <!-- ═══ CERTIFICATE TEXT ═════════════════════════════════════════════════ -->
  ${certifiesText}
  ${completedText}

  <!-- ═══ AWARDED TO (non-certificate) ═════════════════════════════════════ -->
  ${awardedToText}

  <!-- ═══ PARTICIPANT NAME ═════════════════════════════════════════════════ -->
  ${nameBlock}

  <!-- ═══ TITLE / EVENT NAME ═══════════════════════════════════════════════ -->
  ${!isCertificate && !heroLine ? `<text x="${W / 2}" y="${nameY + nameLines.length * 60 + 30}" font-family="${FONT_SANS}" font-size="20" font-weight="400" fill="${C.slate400}" text-anchor="middle">for</text>` : ""}
  ${titleBlock}
  ${subtitleBlock}

  <!-- ═══ DATE ═════════════════════════════════════════════════════════════ -->
  <text x="${W / 2}" y="${990 + (titleLines.length - 1) * 52 + (subtitleLines.length * 40)}" font-family="${FONT_SANS}" font-size="22" font-weight="400" fill="${C.slate500}" text-anchor="middle">Issued on ${dateStr}</text>

  <!-- ═══ ORG NAME ════════════════════════════════════════════════════════ -->
  ${p.achievementData?.orgName ? `<text x="${W / 2}" y="${1040 + (titleLines.length - 1) * 52 + (subtitleLines.length * 40)}" font-family="${FONT_SANS}" font-size="20" font-weight="600" fill="${C.slate700}" text-anchor="middle">${escapeXml(truncate(p.achievementData.orgName, 50))}</text>` : ""}

  <!-- ═══ FOOTER DIVIDER ═══════════════════════════════════════════════════ -->
  <line x1="80" y1="${H - 300}" x2="${W - 80}" y2="${H - 300}" stroke="${C.slate200}" stroke-width="1" stroke-dasharray="6 6" />

  <!-- ═══ FOOTER: SERIAL + QR ══════════════════════════════════════════════ -->
  <!-- Serial number (left) -->
  <text x="80" y="${H - 240}" font-family="${FONT_SANS}" font-size="12" font-weight="700" letter-spacing="3" fill="${C.slate400}">${theme.label} NO.</text>
  <text x="80" y="${H - 200}" font-family="${FONT_MONO}" font-size="26" font-weight="700" fill="${C.slate900}">${escapeXml(serial)}</text>

  <!-- Share URL (left, small) -->
  ${p.shareUrl ? `<text x="80" y="${H - 155}" font-family="${FONT_MONO}" font-size="14" font-weight="400" fill="${C.slate400}">engagio.app/s/${escapeXml(serial.split("-").pop() || "")}</text>` : ""}

  <!-- QR code (right) -->
  ${qrTag ? `<rect x="${qrX - 12}" y="${qrY - 12}" width="${qrSize + 24}" height="${qrSize + 24}" rx="16" ry="16" fill="${C.slate50}" stroke="${C.slate200}" stroke-width="1" />` : ""}
  ${qrTag}
  <text x="${qrX + qrSize / 2}" y="${qrY + qrSize + 35}" font-family="${FONT_SANS}" font-size="12" font-weight="600" letter-spacing="2" fill="${C.slate400}" text-anchor="middle">SCAN TO VERIFY</text>

  <!-- Powered by Engagio (bottom center) -->
  <text x="${W / 2}" y="${H - 70}" font-family="${FONT_SANS}" font-size="14" font-weight="500" fill="${C.slate400}" text-anchor="middle">Powered by Engagio</text>
</svg>`
}

/** Render only the SVG. */
export async function renderCardSvg(p: CardRenderParams): Promise<string> {
  return renderCardSvgInternal(p)
}

/**
 * Render the card and convert SVG → PNG via sharp.
 * Falls back to returning the SVG buffer if sharp fails.
 */
export async function renderCard(p: CardRenderParams): Promise<RenderedCard> {
  const svg = await renderCardSvgInternal(p)
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
