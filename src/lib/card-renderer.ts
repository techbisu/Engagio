/**
 * Server-side card renderer using Satori + Resvg.
 *
 * ─── 5 Eye-catching social media shareable card styles ────────────────────
 * Mix of light and dark themes with confetti/paper blast effects.
 * Bigger typography, better vertical distribution, no blank space.
 *
 * Styles:
 *   1. minimal       — DARK: slate gradient, teal accents, minimal confetti
 *   2. modern        — DARK: emerald→navy gradient, green accents, confetti
 *   3. professional  — LIGHT: white bg, amber accents, elegant border
 *   4. celebration   — DARK: dark bg, gold accents, LOTS of confetti
 *   5. conference    — LIGHT: white bg, teal accents, clean corporate
 */

import satori from "satori"
import { Resvg } from "@resvg/resvg-js"
import { generateAchievementQr } from "./achievement"
import { DEJAVU_SANS, DEJAVU_SANS_BOLD, DEJAVU_SANS_MONO } from "./font-data"
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

const W = 1200
const H = 1500

function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64")
}

const fonts = [
  { name: "DejaVu Sans", data: base64ToBuffer(DEJAVU_SANS), weight: 400 as const, style: "normal" as const },
  { name: "DejaVu Sans", data: base64ToBuffer(DEJAVU_SANS_BOLD), weight: 700 as const, style: "normal" as const },
  { name: "DejaVu Sans Mono", data: base64ToBuffer(DEJAVU_SANS_MONO), weight: 400 as const, style: "normal" as const },
]

// ─── 5 Style themes ────────────────────────────────────────────────────────
interface CardTheme {
  isDark: boolean
  bg: string // CSS background value (gradient or solid)
  bgFrom: string
  bgTo: string
  surface: string // card surface color (for light themes)
  text: string // primary text
  textSecondary: string // secondary text
  textMuted: string // muted text
  accent: string // accent color
  accentLight: string
  accentDark: string
  accentGlow: string // rgba glow for decorative circles
  badgeBg: string
  badgeText: string
  badgeBorder: string
  divider: string
  confettiColors: string[]
  confettiCount: number
  typeLabel: string
}

const THEMES: Record<AchievementTemplateId, CardTheme> = {
  // 1. DARK — minimal slate
  minimal: {
    isDark: true,
    bg: "linear-gradient(160deg, #1e293b 0%, #0f172a 100%)",
    bgFrom: "#1e293b", bgTo: "#0f172a",
    surface: "#1e293b",
    text: "#ffffff", textSecondary: "#cbd5e1", textMuted: "#64748b",
    accent: "#14b8a6", accentLight: "#2dd4bf", accentDark: "#0f766e",
    accentGlow: "rgba(20,184,166,0.35)",
    badgeBg: "rgba(20,184,166,0.15)", badgeText: "#5eead4", badgeBorder: "rgba(20,184,166,0.4)",
    divider: "rgba(255,255,255,0.1)",
    confettiColors: ["#14b8a6", "#2dd4bf", "#64748b"], confettiCount: 20,
    typeLabel: "ACHIEVEMENT",
  },
  // 2. DARK — modern emerald
  modern: {
    isDark: true,
    bg: "linear-gradient(160deg, #064e3b 0%, #0f172a 70%)",
    bgFrom: "#064e3b", bgTo: "#0f172a",
    surface: "#0f172a",
    text: "#ffffff", textSecondary: "#d1fae5", textMuted: "#6b7280",
    accent: "#10b981", accentLight: "#34d399", accentDark: "#059669",
    accentGlow: "rgba(16,185,129,0.4)",
    badgeBg: "rgba(16,185,129,0.15)", badgeText: "#6ee7b7", badgeBorder: "rgba(16,185,129,0.4)",
    divider: "rgba(255,255,255,0.1)",
    confettiColors: ["#10b981", "#34d399", "#fbbf24", "#ffffff"], confettiCount: 35,
    typeLabel: "ACHIEVEMENT",
  },
  // 3. LIGHT — professional amber
  professional: {
    isDark: false,
    bg: "linear-gradient(160deg, #fffbeb 0%, #ffffff 50%)",
    bgFrom: "#fffbeb", bgTo: "#ffffff",
    surface: "#ffffff",
    text: "#1f2937", textSecondary: "#4b5563", textMuted: "#9ca3af",
    accent: "#f59e0b", accentLight: "#fbbf24", accentDark: "#d97706",
    accentGlow: "rgba(245,158,11,0.2)",
    badgeBg: "rgba(245,158,11,0.1)", badgeText: "#92400e", badgeBorder: "rgba(245,158,11,0.3)",
    divider: "#e5e7eb",
    confettiColors: ["#f59e0b", "#fbbf24", "#fde68a", "#d97706"], confettiCount: 25,
    typeLabel: "CERTIFICATE",
  },
  // 4. DARK — celebration gold (lots of confetti)
  celebration: {
    isDark: true,
    bg: "linear-gradient(160deg, #7c2d12 0%, #0f172a 60%)",
    bgFrom: "#7c2d12", bgTo: "#0f172a",
    surface: "#0f172a",
    text: "#ffffff", textSecondary: "#fef3c7", textMuted: "#92856a",
    accent: "#fbbf24", accentLight: "#fde68a", accentDark: "#d97706",
    accentGlow: "rgba(251,191,36,0.45)",
    badgeBg: "rgba(251,191,36,0.15)", badgeText: "#fef3c7", badgeBorder: "rgba(251,191,36,0.4)",
    divider: "rgba(255,255,255,0.1)",
    confettiColors: ["#fbbf24", "#fde68a", "#f43f5e", "#10b981", "#ffffff", "#f59e0b"], confettiCount: 50,
    typeLabel: "ACHIEVEMENT",
  },
  // 5. LIGHT — conference teal
  conference: {
    isDark: false,
    bg: "linear-gradient(160deg, #f0fdfa 0%, #ffffff 50%)",
    bgFrom: "#f0fdfa", bgTo: "#ffffff",
    surface: "#ffffff",
    text: "#0f172a", textSecondary: "#334155", textMuted: "#94a3b8",
    accent: "#14b8a6", accentLight: "#2dd4bf", accentDark: "#0f766e",
    accentGlow: "rgba(20,184,166,0.2)",
    badgeBg: "rgba(20,184,166,0.1)", badgeText: "#0f766e", badgeBorder: "rgba(20,184,166,0.3)",
    divider: "#e2e8f0",
    confettiColors: ["#14b8a6", "#2dd4bf", "#0f766e"], confettiCount: 15,
    typeLabel: "ATTENDEE PASS",
  },
}

function typeLabel(type: AchievementType): string {
  switch (type) {
    case "QUIZ_RESULT":
    case "KNOWLEDGE_CHECK_RESULT":
      return "QUIZ RESULT"
    case "LIVE_QUIZ_RESULT":
      return "LIVE QUIZ"
    case "PRE_POST_RESULT":
      return "LEARNING PROGRESS"
    case "CERTIFICATE_EARNED":
      return "CERTIFICATE OF COMPLETION"
    case "ACTIVITY_COMPLETED":
    case "EVENT_PARTICIPATION":
      return "PARTICIPATION"
    case "LEADERBOARD_ACHIEVEMENT":
      return "LEADERBOARD"
    default:
      return "ACHIEVEMENT"
  }
}

function rankSuffix(rank: number): string {
  if (rank === 1) return "st"
  if (rank === 2) return "nd"
  if (rank === 3) return "rd"
  return "th"
}

function buildSerialNumber(p: CardRenderParams): string {
  const orgCode = (p.achievementData?.orgName || "ENG").replace(/[^A-Z]/gi, "").toUpperCase().slice(0, 3) || "ENG"
  const year = new Date().getFullYear()
  const hash = (p.title + p.participantName).split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffffff, 7).toString(36).toUpperCase().padStart(6, "0").slice(0, 6)
  return `${orgCode}-${year}-${hash}`
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + "..."
}

type SatoriNode = {
  type: string
  props: {
    style?: Record<string, string | number>
    children?: SatoriNode | SatoriNode[] | string
    [key: string]: unknown
  }
}

function el(
  type: string,
  style: Record<string, string | number>,
  children?: SatoriNode | SatoriNode[] | string,
  extra?: Record<string, unknown>,
): SatoriNode {
  return { type, props: { style, children, ...extra } }
}

// ─── Generate confetti elements (deterministic positions) ──────────────────
function buildConfetti(theme: CardTheme): SatoriNode[] {
  const confetti: SatoriNode[] = []
  let seed = 42
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let i = 0; i < theme.confettiCount; i++) {
    const x = Math.floor(rand() * 100)
    const y = Math.floor(rand() * 100)
    const size = 6 + Math.floor(rand() * 14)
    const color = theme.confettiColors[i % theme.confettiColors.length]
    const opacity = 0.3 + rand() * 0.5
    const rotation = Math.floor(rand() * 360)
    const isCircle = rand() > 0.5

    confetti.push(
      el("div", {
        display: "flex",
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        borderRadius: isCircle ? "50%" : "2px",
        opacity: String(opacity),
        transform: `rotate(${rotation}deg)`,
      }),
    )
  }
  return confetti
}

async function buildCardTree(p: CardRenderParams): Promise<SatoriNode> {
  const theme = THEMES[p.templateId] || THEMES.modern
  const { title, subtitle, participantName, percentage, rank, score, totalScore, totalParticipants } = p

  const hasPercent = typeof percentage === "number" && percentage >= 0
  const hasRank = typeof rank === "number" && rank > 0
  const hasScore = typeof score === "number" && typeof totalScore === "number"
  const isCertificate = p.type === "CERTIFICATE_EARNED"

  // ─── Build hero metric (BIGGER fonts) ──
  let heroNode: SatoriNode
  let scoreLabel = ""

  if (isCertificate) {
    heroNode = el("div", {
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "120px", height: "120px", borderRadius: "50%",
      backgroundColor: theme.accent, fontSize: "60px",
    }, "★")
  } else if (hasPercent) {
    heroNode = el("div", {
      display: "flex", alignItems: "baseline", justifyContent: "center",
    }, [
      el("span", { fontSize: "200px", fontWeight: "800", color: theme.text, lineHeight: "0.9" }, String(percentage)),
      el("span", { fontSize: "90px", fontWeight: "700", color: theme.accent, marginLeft: "4px" }, "%"),
    ])
    scoreLabel = "SCORE"
  } else if (hasRank) {
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏆"
    heroNode = el("div", {
      display: "flex", flexDirection: "column", alignItems: "center",
    }, [
      el("div", { fontSize: "80px", marginBottom: "8px" }, medal),
      el("div", { display: "flex", alignItems: "baseline" }, [
        el("span", { fontSize: "170px", fontWeight: "800", color: theme.text, lineHeight: "0.9" }, String(rank)),
        el("span", { fontSize: "70px", fontWeight: "700", color: theme.accent, marginLeft: "4px" }, rankSuffix(rank)),
      ]),
    ])
    scoreLabel = totalParticipants ? `RANK OF ${totalParticipants}` : "RANK"
  } else if (hasScore) {
    heroNode = el("div", {
      display: "flex", alignItems: "baseline", justifyContent: "center",
    }, [
      el("span", { fontSize: "160px", fontWeight: "800", color: theme.text, lineHeight: "0.9" }, String(score)),
      el("span", { fontSize: "60px", fontWeight: "700", color: theme.accent, marginLeft: "8px" }, `/ ${totalScore}`),
    ])
    scoreLabel = "POINTS"
  } else {
    heroNode = el("div", {
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "120px", height: "120px", borderRadius: "50%",
      backgroundColor: theme.accent, fontSize: "60px",
    }, "✓")
  }

  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  const serial = buildSerialNumber(p)

  let qrDataUrl = ""
  if (p.shareUrl) {
    try { qrDataUrl = await generateAchievementQr(p.shareUrl) } catch { /* ignore */ }
  }

  const eventName = subtitle || p.achievementData?.eventTitle || title
  const badgeLabel = isCertificate ? "CERTIFICATE OF COMPLETION" : typeLabel(p.type)

  // ─── Build footer children ──
  const footerChildren: SatoriNode[] = [
    el("div", { display: "flex", flexDirection: "column" }, [
      el("div", { fontSize: "14px", color: theme.textMuted, letterSpacing: "3px", marginBottom: "8px" }, "VERIFY AT"),
      el("div", { fontSize: "20px", fontWeight: "700", color: theme.textSecondary, fontFamily: "DejaVu Sans Mono", marginBottom: "20px" }, serial),
      el("div", { fontSize: "16px", color: theme.textMuted }, "Powered by Engagio"),
    ]),
  ]

  if (qrDataUrl) {
    footerChildren.push(
      el("div", { display: "flex", flexDirection: "column", alignItems: "center" }, [
        el("div", {
          display: "flex", padding: "14px", borderRadius: "20px",
          backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : theme.surface,
          border: `1px solid ${theme.badgeBorder}`,
        }, [
          el("img", { width: "140px", height: "140px" }, undefined, { src: qrDataUrl }),
        ]),
        el("div", { fontSize: "13px", fontWeight: "600", color: theme.textMuted, letterSpacing: "2px", marginTop: "10px" }, "SCAN TO VERIFY"),
      ]),
    )
  }

  // ─── Build content children (vertically distributed) ──
  const contentChildren: SatoriNode[] = []

  // 1. Badge (top)
  contentChildren.push(
    el("div", { display: "flex", justifyContent: "center", marginTop: "20px" }, [
      el("div", {
        display: "flex", alignItems: "center", justifyContent: "center",
        paddingLeft: "24px", paddingRight: "24px", paddingTop: "12px", paddingBottom: "12px",
        borderRadius: "40px", backgroundColor: theme.badgeBg, border: `1px solid ${theme.badgeBorder}`,
      }, [
        el("span", { fontSize: "18px", fontWeight: "700", color: theme.badgeText, letterSpacing: "5px" }, badgeLabel),
      ]),
    ]),
  )

  // 2. Hero metric (BIG, centered) — takes up significant vertical space
  contentChildren.push(
    el("div", { display: "flex", flexDirection: "column", alignItems: "center", marginTop: "50px" }, [heroNode]),
  )

  // 3. Score label
  if (scoreLabel) {
    contentChildren.push(
      el("div", {
        display: "flex", justifyContent: "center", marginTop: "16px",
      }, [
        el("span", { fontSize: "28px", fontWeight: "700", color: theme.accent, letterSpacing: "10px" }, scoreLabel),
      ]),
    )
  }

  // 4. Participant name (BIG) — takes up vertical space
  contentChildren.push(
    el("div", { display: "flex", flexDirection: "column", alignItems: "center", marginTop: "50px" }, [
      el("div", { fontSize: "20px", color: theme.textMuted, marginBottom: "12px", letterSpacing: "3px" }, isCertificate ? "THIS CERTIFIES THAT" : "AWARDED TO"),
      el("div", { fontSize: "64px", fontWeight: "800", color: theme.text, textAlign: "center", maxWidth: "900px", lineHeight: "1.05" }, participantName),
    ]),
  )

  // 5. Event name (BIG, beautiful) — with decorative lines above and below
  contentChildren.push(
    el("div", { display: "flex", flexDirection: "column", alignItems: "center", marginTop: "40px" }, [
      el("div", { display: "flex", width: "100px", height: "4px", backgroundColor: theme.accent, borderRadius: "2px", marginBottom: "24px" }),
      el("div", { fontSize: "52px", fontWeight: "800", color: theme.text, textAlign: "center", maxWidth: "950px", lineHeight: "1.1" }, truncate(eventName, 45)),
    ]),
  )

  // 6. Achievement title (quiz/test name)
  if (title && title !== eventName) {
    contentChildren.push(
      el("div", { display: "flex", justifyContent: "center", marginTop: "16px" }, [
        el("div", { fontSize: "28px", color: theme.textSecondary, textAlign: "center", maxWidth: "950px" }, truncate(title, 60)),
      ]),
    )
  }

  // 7. Date + Org (with divider)
  contentChildren.push(
    el("div", { display: "flex", flexDirection: "column", alignItems: "center", marginTop: "30px" }, [
      el("div", { display: "flex", width: "60px", height: "2px", backgroundColor: theme.divider, borderRadius: "1px", marginBottom: "20px" }),
      el("div", { fontSize: "24px", color: theme.textMuted, marginBottom: "8px" }, dateStr),
      ...(p.achievementData?.orgName ? [
        el("div", { fontSize: "26px", fontWeight: "600", color: theme.textSecondary }, truncate(p.achievementData.orgName, 50)),
      ] : []),
    ]),
  )

  // 8. Footer (bottom, with spacer pushing it down)
  contentChildren.push(
    el("div", { display: "flex", flexDirection: "column", flex: "1", justifyContent: "flex-end" }, [
      el("div", { display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingTop: "40px" }, footerChildren),
    ]),
  )

  // ─── Build the full card ──
  const card: SatoriNode = el("div", {
    display: "flex",
    flexDirection: "column",
    width: `${W}px`,
    height: `${H}px`,
    background: theme.bg,
    fontFamily: "DejaVu Sans",
  }, [
    // Decorative: glowing circle top-right
    el("div", {
      display: "flex",
      position: "absolute",
      top: "-250px",
      right: "-250px",
      width: "700px",
      height: "700px",
      borderRadius: "50%",
      background: theme.accentGlow,
    }),
    // Decorative: glowing circle bottom-left
    el("div", {
      display: "flex",
      position: "absolute",
      bottom: "-200px",
      left: "-200px",
      width: "600px",
      height: "600px",
      borderRadius: "50%",
      background: theme.accentGlow,
    }),
    // Confetti / paper blast
    ...buildConfetti(theme),
    // Content
    el("div", {
      display: "flex",
      flexDirection: "column",
      flex: "1",
      padding: "70px",
    }, contentChildren),
  ])

  return card
}

export async function renderCardSvg(p: CardRenderParams): Promise<string> {
  const tree = await buildCardTree(p)
  const svg = await satori(tree, { width: W, height: H, fonts })
  return svg
}

export async function renderCard(p: CardRenderParams): Promise<RenderedCard> {
  const svg = await renderCardSvg(p)
  try {
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W }, dpi: 144 })
    const png = resvg.render().asPng()
    return { png: Buffer.from(png), svg }
  } catch (e) {
    console.error("[card-renderer] Resvg SVG→PNG failed; using SVG fallback:", e)
    return { png: Buffer.from(svg, "utf-8"), svg }
  }
}
