/**
 * Server-side card renderer using Satori + Resvg.
 *
 * ─── Design: Eye-catching social media shareable card ──────────────────────
 * Beautiful gradient backgrounds, BIG typography, decorative elements.
 * Optimized for social media sharing (LinkedIn, WhatsApp, Twitter, etc.).
 *
 * NOTE: Satori requires ALL container divs to have explicit display:flex
 * when they have multiple children. This is enforced throughout.
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

interface TemplateTheme {
  bgFrom: string
  bgTo: string
  accent: string
  accentLight: string
  accentGlow: string
  badgeBg: string
  badgeText: string
}

const THEMES: Record<AchievementTemplateId, TemplateTheme> = {
  minimal: {
    bgFrom: "#0f172a", bgTo: "#1e293b", accent: "#14b8a6", accentLight: "#2dd4bf",
    accentGlow: "rgba(20,184,166,0.4)", badgeBg: "rgba(20,184,166,0.2)", badgeText: "#5eead4",
  },
  modern: {
    bgFrom: "#064e3b", bgTo: "#0f172a", accent: "#10b981", accentLight: "#34d399",
    accentGlow: "rgba(16,185,129,0.4)", badgeBg: "rgba(16,185,129,0.2)", badgeText: "#6ee7b7",
  },
  professional: {
    bgFrom: "#78350f", bgTo: "#0f172a", accent: "#f59e0b", accentLight: "#fbbf24",
    accentGlow: "rgba(245,158,11,0.4)", badgeBg: "rgba(245,158,11,0.2)", badgeText: "#fcd34d",
  },
  celebration: {
    bgFrom: "#7c2d12", bgTo: "#0f172a", accent: "#fbbf24", accentLight: "#fde68a",
    accentGlow: "rgba(251,191,36,0.5)", badgeBg: "rgba(251,191,36,0.2)", badgeText: "#fef3c7",
  },
  conference: {
    bgFrom: "#134e4a", bgTo: "#0f172a", accent: "#14b8a6", accentLight: "#2dd4bf",
    accentGlow: "rgba(20,184,166,0.4)", badgeBg: "rgba(20,184,166,0.2)", badgeText: "#5eead4",
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

async function buildCardTree(p: CardRenderParams): Promise<SatoriNode> {
  const theme = THEMES[p.templateId] || THEMES.modern
  const { title, subtitle, participantName, percentage, rank, score, totalScore, totalParticipants } = p

  const hasPercent = typeof percentage === "number" && percentage >= 0
  const hasRank = typeof rank === "number" && rank > 0
  const hasScore = typeof score === "number" && typeof totalScore === "number"
  const isCertificate = p.type === "CERTIFICATE_EARNED"

  // ─── Build hero metric ──
  let heroNode: SatoriNode
  let scoreLabel = ""

  if (isCertificate) {
    heroNode = el("div", {
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "100px", height: "100px", borderRadius: "50%",
      backgroundColor: theme.accent, fontSize: "48px",
    }, "★")
  } else if (hasPercent) {
    heroNode = el("div", {
      display: "flex", alignItems: "baseline", justifyContent: "center",
    }, [
      el("span", { fontSize: "160px", fontWeight: "800", color: "#ffffff", lineHeight: "1" }, String(percentage)),
      el("span", { fontSize: "70px", fontWeight: "700", color: theme.accentLight, marginLeft: "4px" }, "%"),
    ])
    scoreLabel = "SCORE"
  } else if (hasRank) {
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏆"
    heroNode = el("div", {
      display: "flex", flexDirection: "column", alignItems: "center",
    }, [
      el("div", { fontSize: "64px", marginBottom: "8px" }, medal),
      el("div", { display: "flex", alignItems: "baseline" }, [
        el("span", { fontSize: "140px", fontWeight: "800", color: "#ffffff", lineHeight: "1" }, String(rank)),
        el("span", { fontSize: "60px", fontWeight: "700", color: theme.accentLight, marginLeft: "4px" }, rankSuffix(rank)),
      ]),
    ])
    scoreLabel = totalParticipants ? `RANK OF ${totalParticipants}` : "RANK"
  } else if (hasScore) {
    heroNode = el("div", {
      display: "flex", alignItems: "baseline", justifyContent: "center",
    }, [
      el("span", { fontSize: "130px", fontWeight: "800", color: "#ffffff", lineHeight: "1" }, String(score)),
      el("span", { fontSize: "50px", fontWeight: "700", color: theme.accentLight, marginLeft: "8px" }, `/ ${totalScore}`),
    ])
    scoreLabel = "POINTS"
  } else {
    heroNode = el("div", {
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "100px", height: "100px", borderRadius: "50%",
      backgroundColor: theme.accent, fontSize: "48px",
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
      el("div", { fontSize: "12px", color: "rgba(255,255,255,0.4)", letterSpacing: "3px", marginBottom: "6px" }, "VERIFY AT"),
      el("div", { fontSize: "16px", fontWeight: "700", color: "rgba(255,255,255,0.8)", fontFamily: "DejaVu Sans Mono", marginBottom: "16px" }, serial),
      el("div", { fontSize: "14px", color: "rgba(255,255,255,0.4)" }, "Powered by Engagio"),
    ]),
  ]

  if (qrDataUrl) {
    footerChildren.push(
      el("div", { display: "flex", flexDirection: "column", alignItems: "center" }, [
        el("div", {
          display: "flex", padding: "12px", borderRadius: "16px",
          backgroundColor: "rgba(255,255,255,0.1)", border: `1px solid ${theme.accent}40`,
        }, [
          el("img", { width: "120px", height: "120px" }, undefined, { src: qrDataUrl }),
        ]),
        el("div", { fontSize: "11px", fontWeight: "600", color: "rgba(255,255,255,0.5)", letterSpacing: "2px", marginTop: "8px" }, "SCAN TO VERIFY"),
      ]),
    )
  }

  // ─── Build content children ──
  const contentChildren: SatoriNode[] = []

  // Badge
  contentChildren.push(
    el("div", { display: "flex", justifyContent: "center", marginBottom: "40px" }, [
      el("div", {
        display: "flex", alignItems: "center", justifyContent: "center",
        paddingLeft: "20px", paddingRight: "20px", paddingTop: "10px", paddingBottom: "10px",
        borderRadius: "30px", backgroundColor: theme.badgeBg, border: `1px solid ${theme.accent}60`,
      }, [
        el("span", { fontSize: "16px", fontWeight: "700", color: theme.badgeText, letterSpacing: "4px" }, badgeLabel),
      ]),
    ]),
  )

  // Hero metric
  contentChildren.push(
    el("div", { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "16px" }, [heroNode]),
  )

  // Score label
  if (scoreLabel) {
    contentChildren.push(
      el("div", {
        display: "flex", justifyContent: "center", marginBottom: "40px",
      }, [
        el("span", { fontSize: "24px", fontWeight: "700", color: theme.accent, letterSpacing: "8px" }, scoreLabel),
      ]),
    )
  }

  // Participant name
  contentChildren.push(
    el("div", { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }, [
      el("div", { fontSize: "18px", color: "rgba(255,255,255,0.5)", marginBottom: "8px", letterSpacing: "2px" }, isCertificate ? "THIS CERTIFIES THAT" : "AWARDED TO"),
      el("div", { fontSize: "48px", fontWeight: "800", color: "#ffffff", textAlign: "center", maxWidth: "900px", lineHeight: "1.1" }, participantName),
    ]),
  )

  // Event name (BIG, beautiful)
  contentChildren.push(
    el("div", { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "16px" }, [
      el("div", { display: "flex", width: "80px", height: "3px", backgroundColor: theme.accent, borderRadius: "2px", marginBottom: "20px" }),
      el("div", { fontSize: "42px", fontWeight: "800", color: "#ffffff", textAlign: "center", maxWidth: "900px", lineHeight: "1.15" }, truncate(eventName, 50)),
    ]),
  )

  // Achievement title (quiz/test name)
  if (title && title !== eventName) {
    contentChildren.push(
      el("div", { display: "flex", justifyContent: "center", marginBottom: "24px" }, [
        el("div", { fontSize: "24px", color: "rgba(255,255,255,0.7)", textAlign: "center", maxWidth: "900px" }, truncate(title, 60)),
      ]),
    )
  }

  // Date
  contentChildren.push(
    el("div", { display: "flex", justifyContent: "center", marginBottom: "8px" }, [
      el("div", { fontSize: "20px", color: "rgba(255,255,255,0.5)" }, dateStr),
    ]),
  )

  // Org name
  if (p.achievementData?.orgName) {
    contentChildren.push(
      el("div", { display: "flex", justifyContent: "center" }, [
        el("div", { fontSize: "22px", fontWeight: "600", color: "rgba(255,255,255,0.8)" }, truncate(p.achievementData.orgName, 50)),
      ]),
    )
  }

  // Footer
  contentChildren.push(
    el("div", { display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: "40px" }, footerChildren),
  )

  // ─── Build the full card ──
  const card: SatoriNode = el("div", {
    display: "flex",
    flexDirection: "column",
    width: `${W}px`,
    height: `${H}px`,
    background: `linear-gradient(135deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)`,
    fontFamily: "DejaVu Sans",
  }, [
    // Decorative: large glowing circle top-right
    el("div", {
      display: "flex",
      position: "absolute",
      top: "-200px",
      right: "-200px",
      width: "600px",
      height: "600px",
      borderRadius: "50%",
      background: theme.accentGlow,
    }),
    // Decorative: large glowing circle bottom-left
    el("div", {
      display: "flex",
      position: "absolute",
      bottom: "-150px",
      left: "-150px",
      width: "500px",
      height: "500px",
      borderRadius: "50%",
      background: theme.accentGlow,
    }),
    // Content
    el("div", {
      display: "flex",
      flexDirection: "column",
      flex: "1",
      padding: "60px",
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
