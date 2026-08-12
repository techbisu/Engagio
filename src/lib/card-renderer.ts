/**
 * Server-side card renderer using Satori + Resvg.
 *
 * ─── Scroll-stopping social media card ─────────────────────────────────────
 * Inspired by Spotify Wrapped, Duolingo, and gaming achievement unlocks.
 *
 * Design principles:
 *   - MINIMAL data: only score, name, event name
 *   - MASSIVE hero number (250px+) that grabs attention in a feed
 *   - Vibrant full-bleed gradients (no card border, no wasted space)
 *   - Confetti EXPLOSION concentrated around the score
 *   - Glow/halo effect behind the hero number
 *   - Tiny footer: QR + "Powered by Engagio"
 *   - No serial numbers, no dates, no org names, no labels cluttering the view
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

// ─── 5 vibrant gradient themes ─────────────────────────────────────────────
interface CardTheme {
  bgFrom: string
  bgTo: string
  accent: string
  accentLight: string
  glow: string
  confetti: string[]
}

const THEMES: Record<AchievementTemplateId, CardTheme> = {
  // 1. Emerald fire — dark green → black, green glow
  minimal: {
    bgFrom: "#022c22", bgTo: "#000000",
    accent: "#34d399", accentLight: "#a7f3d0",
    glow: "rgba(16,185,129,0.6)",
    confetti: ["#34d399", "#a7f3d0", "#6ee7b7", "#ffffff"],
  },
  // 2. Ocean deep — dark teal → navy, cyan glow
  modern: {
    bgFrom: "#042f2e", bgTo: "#020617",
    accent: "#22d3ee", accentLight: "#67e8f9",
    glow: "rgba(34,211,238,0.6)",
    confetti: ["#22d3ee", "#67e8f9", "#a5f3fc", "#ffffff"],
  },
  // 3. Golden hour — dark amber → black, gold glow
  professional: {
    bgFrom: "#451a03", bgTo: "#000000",
    accent: "#fbbf24", accentLight: "#fde68a",
    glow: "rgba(251,191,36,0.6)",
    confetti: ["#fbbf24", "#fde68a", "#f59e0b", "#ffffff"],
  },
  // 4. Royal purple — dark purple → black, pink/purple glow
  celebration: {
    bgFrom: "#2e1065", bgTo: "#000000",
    accent: "#f472b6", accentLight: "#fbcfe8",
    glow: "rgba(244,114,182,0.6)",
    confetti: ["#f472b6", "#fbcfe8", "#a78bfa", "#ffffff", "#fbbf24"],
  },
  // 5. Sunset — dark rose → black, orange glow
  conference: {
    bgFrom: "#7f1d1d", bgTo: "#000000",
    accent: "#fb923c", accentLight: "#fed7aa",
    glow: "rgba(251,146,60,0.6)",
    confetti: ["#fb923c", "#fed7aa", "#f87171", "#ffffff", "#fbbf24"],
  },
}

function rankSuffix(rank: number): string {
  if (rank === 1) return "st"
  if (rank === 2) return "nd"
  if (rank === 3) return "rd"
  return "th"
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

// ─── Confetti explosion (concentrated around center) ───────────────────────
function buildConfetti(theme: CardTheme, count: number): SatoriNode[] {
  const confetti: SatoriNode[] = []
  let seed = 42
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let i = 0; i < count; i++) {
    // Concentrate confetti around the center (where the hero number is)
    const angle = rand() * Math.PI * 2
    const distance = rand() * 45 // % from center
    const centerX = 50
    const centerY = 42 // slightly above center where the number sits
    const x = centerX + Math.cos(angle) * distance
    const y = centerY + Math.sin(angle) * distance * 0.8 // squish vertically

    const size = 8 + Math.floor(rand() * 20)
    const color = theme.confetti[i % theme.confetti.length]
    const opacity = 0.4 + rand() * 0.5
    const rotation = Math.floor(rand() * 360)
    const isCircle = rand() > 0.4

    confetti.push(
      el("div", {
        display: "flex",
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        borderRadius: isCircle ? "50%" : "3px",
        opacity: String(opacity),
        transform: `rotate(${rotation}deg)`,
      }),
    )
  }
  return confetti
}

async function buildCardTree(p: CardRenderParams): Promise<SatoriNode> {
  const theme = THEMES[p.templateId] || THEMES.modern
  const { participantName, percentage, rank, score, totalScore, totalParticipants } = p

  const hasPercent = typeof percentage === "number" && percentage >= 0
  const hasRank = typeof rank === "number" && rank > 0
  const hasScore = typeof score === "number" && typeof totalScore === "number"
  const isCertificate = p.type === "CERTIFICATE_EARNED"

  // ─── Build the HERO element ──
  let heroNode: SatoriNode

  if (isCertificate) {
    heroNode = el("div", {
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "140px", height: "140px", borderRadius: "50%",
      backgroundColor: theme.accent, fontSize: "72px",
    }, "★")
  } else if (hasPercent) {
    heroNode = el("div", {
      display: "flex", alignItems: "baseline", justifyContent: "center",
    }, [
      el("span", { fontSize: "280px", fontWeight: "800", color: "#ffffff", lineHeight: "0.85" }, String(percentage)),
      el("span", { fontSize: "120px", fontWeight: "700", color: theme.accent, marginLeft: "4px" }, "%"),
    ])
  } else if (hasRank) {
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏆"
    heroNode = el("div", {
      display: "flex", flexDirection: "column", alignItems: "center",
    }, [
      el("div", { fontSize: "100px", marginBottom: "8px" }, medal),
      el("div", { display: "flex", alignItems: "baseline" }, [
        el("span", { fontSize: "220px", fontWeight: "800", color: "#ffffff", lineHeight: "0.85" }, String(rank)),
        el("span", { fontSize: "90px", fontWeight: "700", color: theme.accent, marginLeft: "4px" }, rankSuffix(rank)),
      ]),
    ])
  } else if (hasScore) {
    heroNode = el("div", {
      display: "flex", alignItems: "baseline", justifyContent: "center",
    }, [
      el("span", { fontSize: "220px", fontWeight: "800", color: "#ffffff", lineHeight: "0.85" }, String(score)),
      el("span", { fontSize: "80px", fontWeight: "700", color: theme.accent, marginLeft: "8px" }, `/ ${totalScore}`),
    ])
  } else {
    heroNode = el("div", {
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "140px", height: "140px", borderRadius: "50%",
      backgroundColor: theme.accent, fontSize: "72px",
    }, "✓")
  }

  // ─── Event name ──
  const eventName = p.subtitle || p.achievementData?.eventTitle || p.title

  // ─── QR code ──
  let qrDataUrl = ""
  if (p.shareUrl) {
    try { qrDataUrl = await generateAchievementQr(p.shareUrl) } catch { /* ignore */ }
  }

  // ─── Build the card ──
  const card: SatoriNode = el("div", {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: `${W}px`,
    height: `${H}px`,
    background: `linear-gradient(160deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)`,
    fontFamily: "DejaVu Sans",
  }, [
    // ── Background glow behind hero number ──
    el("div", {
      display: "flex",
      position: "absolute",
      top: "15%",
      left: "50%",
      width: "800px",
      height: "800px",
      borderRadius: "50%",
      background: `radial-gradient(circle, ${theme.glow} 0%, transparent 60%)`,
      transform: "translateX(-50%)",
    }),

    // ── Confetti explosion (concentrated around hero) ──
    ...buildConfetti(theme, 40),

    // ── Content (centered vertically) ──
    el("div", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      flex: "1",
      padding: "80px",
      position: "relative",
    }, [
      // Hero number (MASSIVE)
      heroNode,

      // Participant name (medium, below hero)
      el("div", {
        display: "flex",
        marginTop: "60px",
      }, [
        el("div", {
          fontSize: "56px",
          fontWeight: "800",
          color: "#ffffff",
          textAlign: "center",
          maxWidth: "900px",
          lineHeight: "1.1",
        }, truncate(participantName, 30)),
      ]),

      // Event name (accent color, below name)
      el("div", {
        display: "flex",
        marginTop: "16px",
      }, [
        el("div", {
          fontSize: "36px",
          fontWeight: "600",
          color: theme.accentLight,
          textAlign: "center",
          maxWidth: "900px",
        }, truncate(eventName, 40)),
      ]),
    ]),

    // ── Footer: QR + Powered by (minimal, bottom) ──
    el("div", {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px",
      position: "relative",
    }, [
      // QR code (small)
      ...(qrDataUrl ? [
        el("div", {
          display: "flex",
          padding: "8px",
          borderRadius: "12px",
          backgroundColor: "rgba(255,255,255,0.1)",
          marginRight: "16px",
        }, [
          el("img", { width: "80px", height: "80px" }, undefined, { src: qrDataUrl }),
        ]),
      ] : []),
      // Powered by
      el("div", {
        fontSize: "18px",
        color: "rgba(255,255,255,0.4)",
        fontWeight: "500",
      }, "Powered by Engagio"),
    ]),
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
