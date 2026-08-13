/**
 * Server-side card renderer using Satori + Resvg.
 *
 * --- Filled, celebration-style achievement card ----------------------------
 * NO blank space - content fills the entire card.
 *
 * Key design elements:
 *   - BIG trophy icon in the center (the visual anchor)
 *   - Paper burst/bumper vector radiating from behind the trophy
 *   - Content distributed top-to-bottom (no gaps)
 *   - Confetti concentrated around the trophy
 *   - All text scaled up to fill space
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

const fonts = [
  { name: "DejaVu Sans", data: Buffer.from(DEJAVU_SANS, 'base64'), weight: 400 as const, style: "normal" as const },
  { name: "DejaVu Sans", data: Buffer.from(DEJAVU_SANS_BOLD, 'base64'), weight: 700 as const, style: "normal" as const },
  { name: "DejaVu Sans Mono", data: Buffer.from(DEJAVU_SANS_MONO, 'base64'), weight: 400 as const, style: "normal" as const },
]

// --- 5 color palettes ------------------------------------------------------
interface CardTheme {
  bgFrom: string
  bgTo: string
  blobColor: string
  footerColor: string
  text: string
  textSecondary: string
  textMuted: string
  accent: string
  accentLight: string
  accentDark: string
  badgeBg: string
  badgeText: string
  burstColor: string // paper burst rays
  burstColor2: string
  confetti: string[]
}

const THEMES: Record<AchievementTemplateId, CardTheme> = {
  minimal: {
    bgFrom: "#e0f7f4", bgTo: "#a8d5da",
    blobColor: "#7bc4c9", footerColor: "#f5f9f8",
    text: "#1a3a3a", textSecondary: "#2c5f5f", textMuted: "#5a8585",
    accent: "#0d9488", accentLight: "#5eead4", accentDark: "#0f766e",
    badgeBg: "#8fb8b8", badgeText: "#1a4a4a",
    burstColor: "#fbbf24", burstColor2: "#34d399",
    confetti: ["#f4d03f", "#00ced1", "#48d1cc", "#7bc4c9", "#ffffff", "#fbbf24"],
  },
  modern: {
    bgFrom: "#d1fae5", bgTo: "#6ee7b7",
    blobColor: "#34d399", footerColor: "#f0fdf4",
    text: "#064e3b", textSecondary: "#047857", textMuted: "#059669",
    accent: "#059669", accentLight: "#6ee7b7", accentDark: "#047857",
    badgeBg: "#a7f3d0", badgeText: "#064e3b",
    burstColor: "#fbbf24", burstColor2: "#34d399",
    confetti: ["#fbbf24", "#10b981", "#34d399", "#6ee7b7", "#ffffff", "#f59e0b"],
  },
  professional: {
    bgFrom: "#fef3c7", bgTo: "#fcd34d",
    blobColor: "#fbbf24", footerColor: "#fffbeb",
    text: "#78350f", textSecondary: "#92400e", textMuted: "#b45309",
    accent: "#d97706", accentLight: "#fde68a", accentDark: "#92400e",
    badgeBg: "#fde68a", badgeText: "#78350f",
    burstColor: "#f59e0b", burstColor2: "#fbbf24",
    confetti: ["#f59e0b", "#fbbf24", "#fde68a", "#ffffff", "#d97706", "#fcd34d"],
  },
  celebration: {
    bgFrom: "#fce7f3", bgTo: "#f9a8d4",
    blobColor: "#f472b6", footerColor: "#fdf2f8",
    text: "#831843", textSecondary: "#9d174d", textMuted: "#be185d",
    accent: "#db2777", accentLight: "#fbcfe8", accentDark: "#9d174d",
    badgeBg: "#fbcfe8", badgeText: "#831843",
    burstColor: "#fbbf24", burstColor2: "#f472b6",
    confetti: ["#ec4899", "#f472b6", "#f9a8d4", "#ffffff", "#fbbf24", "#a78bfa"],
  },
  conference: {
    bgFrom: "#ccfbf1", bgTo: "#5eead4",
    blobColor: "#2dd4bf", footerColor: "#f0fdfa",
    text: "#134e4a", textSecondary: "#0f766e", textMuted: "#0d9488",
    accent: "#0d9488", accentLight: "#5eead4", accentDark: "#0f766e",
    badgeBg: "#99f6e4", badgeText: "#134e4a",
    burstColor: "#fbbf24", burstColor2: "#2dd4bf",
    confetti: ["#14b8a6", "#2dd4bf", "#5eead4", "#ffffff", "#0d9488", "#fbbf24"],
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

// --- Paper burst / bumper (radiating triangles using divs) -----------------
function buildPaperBurst(theme: CardTheme, centerX: number, centerY: number): SatoriNode[] {
  const rays: SatoriNode[] = []
  const rayCount = 24
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * 360
    const length = i % 2 === 0 ? 200 : 140
    const width = i % 2 === 0 ? 30 : 20
    const color = i % 2 === 0 ? theme.burstColor : theme.burstColor2
    const opacity = i % 2 === 0 ? 0.3 : 0.2

    rays.push(
      el("div", {
        display: "flex",
        position: "absolute",
        left: `${centerX}px`,
        top: `${centerY}px`,
        width: "0px",
        height: "0px",
        borderLeft: `${width / 2}px solid transparent`,
        borderRight: `${width / 2}px solid transparent`,
        borderBottom: `${length}px solid ${color}`,
        opacity: String(opacity),
        transform: `rotate(${angle}deg)`,
        transformOrigin: "top center",
        marginLeft: `-${width / 2}px`,
      }),
    )
  }
  return rays
}

// --- Confetti (concentrated around trophy) ---------------------------------
function buildConfetti(theme: CardTheme, count: number, centerX: number, centerY: number): SatoriNode[] {
  const confetti: SatoriNode[] = []
  let seed = 42
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2
    const distance = rand() * 350
    const x = centerX + Math.cos(angle) * distance
    const y = centerY + Math.sin(angle) * distance * 0.7
    const size = 10 + Math.floor(rand() * 18)
    const color = theme.confetti[i % theme.confetti.length]
    const opacity = 0.4 + rand() * 0.5
    const shape = rand()

    let shapeElement: SatoriNode
    if (shape > 0.66) {
      shapeElement = el("div", {
        display: "flex", position: "absolute",
        left: `${x}px`, top: `${y}px`,
        width: `${size}px`, height: `${size}px`,
        backgroundColor: color, borderRadius: "50%", opacity: String(opacity),
      })
    } else if (shape > 0.33) {
      shapeElement = el("div", {
        display: "flex", position: "absolute",
        left: `${x}px`, top: `${y}px`,
        width: `${size}px`, height: `${size}px`,
        backgroundColor: color, borderRadius: "2px", opacity: String(opacity),
        transform: `rotate(45deg)`,
      })
    } else {
      shapeElement = el("div", {
        display: "flex", position: "absolute",
        left: `${x}px`, top: `${y}px`,
        width: `${size * 0.6}px`, height: `${size * 0.6}px`,
        backgroundColor: color, borderRadius: "50%", opacity: String(opacity * 0.7),
      })
    }
    confetti.push(shapeElement)
  }
  return confetti
}

// --- Big trophy (built from divs) ------------------------------------------
function buildTrophy(theme: CardTheme, size: number): SatoriNode {
  const s = size / 100
  return el("div", {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: `${size}px`,
    height: `${size * 1.1}px`,
    position: "relative",
  }, [
    // Trophy cup
    el("div", {
      display: "flex",
      width: `${50 * s}px`,
      height: `${55 * s}px`,
      backgroundColor: theme.accent,
      borderTopLeftRadius: `${5 * s}px`,
      borderTopRightRadius: `${5 * s}px`,
      borderBottomLeftRadius: `${15 * s}px`,
      borderBottomRightRadius: `${15 * s}px`,
      border: `${2 * s}px solid ${theme.accentDark}`,
      position: "relative",
    }, [
      // Star on trophy
      el("div", {
        display: "flex",
        position: "absolute",
        top: `${15 * s}px`,
        left: "50%",
        width: `${20 * s}px`,
        height: `${20 * s}px`,
        backgroundColor: "#ffffff",
        opacity: "0.9",
        marginLeft: `-${10 * s}px`,
        clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
      }),
    ]),
    // Left handle
    el("div", {
      display: "flex",
      position: "absolute",
      top: `${10 * s}px`,
      left: `${5 * s}px`,
      width: `${15 * s}px`,
      height: `${25 * s}px`,
      borderLeft: `${4 * s}px solid ${theme.accent}`,
      borderBottom: `${4 * s}px solid ${theme.accent}`,
      borderRight: `${4 * s}px solid ${theme.accent}`,
      borderRadius: "0 0 50% 50%",
      borderTop: "none",
    }),
    // Right handle
    el("div", {
      display: "flex",
      position: "absolute",
      top: `${10 * s}px`,
      right: `${5 * s}px`,
      width: `${15 * s}px`,
      height: `${25 * s}px`,
      borderLeft: `${4 * s}px solid ${theme.accent}`,
      borderBottom: `${4 * s}px solid ${theme.accent}`,
      borderRight: `${4 * s}px solid ${theme.accent}`,
      borderRadius: "0 0 50% 50%",
      borderTop: "none",
    }),
    // Base
    el("div", {
      display: "flex",
      width: `${55 * s}px`,
      height: `${8 * s}px`,
      backgroundColor: theme.accentDark,
      borderRadius: `${2 * s}px`,
      marginTop: `${2 * s}px`,
    }),
    // Pedestal
    el("div", {
      display: "flex",
      width: `${35 * s}px`,
      height: `${5 * s}px`,
      backgroundColor: theme.accentDark,
      borderRadius: `${2 * s}px`,
      marginTop: `${1 * s}px`,
    }),
  ])
}

async function buildCardTree(p: CardRenderParams): Promise<SatoriNode> {
  const theme = THEMES[p.templateId] || THEMES.minimal
  const { title, subtitle, participantName, percentage, rank, score, totalScore, totalParticipants } = p

  const hasPercent = typeof percentage === "number" && percentage >= 0
  const hasRank = typeof rank === "number" && rank > 0
  const hasScore = typeof score === "number" && typeof totalScore === "number"
  const isCertificate = p.type === "CERTIFICATE_EARNED"

  // --- Build hero metric --
  let heroNode: SatoriNode
  let heroLabel = ""

  if (isCertificate) {
    heroNode = el("div", {
      display: "flex", alignItems: "baseline", justifyContent: "center",
    }, [
      el("span", { fontSize: "100px", fontWeight: "800", color: theme.text, lineHeight: "0.9" }, "COMPLETED"),
    ])
  } else if (hasPercent) {
    heroNode = el("div", {
      display: "flex", alignItems: "baseline", justifyContent: "center",
    }, [
      el("span", { fontSize: "160px", fontWeight: "800", color: theme.text, lineHeight: "0.85" }, String(percentage)),
      el("span", { fontSize: "70px", fontWeight: "700", color: theme.accent, marginLeft: "4px" }, "%"),
    ])
    heroLabel = "SCORE"
  } else if (hasRank) {
    heroNode = el("div", {
      display: "flex", flexDirection: "column", alignItems: "center",
    }, [
      el("div", { display: "flex", alignItems: "baseline" }, [
        el("span", { fontSize: "140px", fontWeight: "800", color: theme.text, lineHeight: "0.85" }, String(rank)),
        el("span", { fontSize: "60px", fontWeight: "700", color: theme.accent, marginLeft: "4px" }, rankSuffix(rank)),
      ]),
    ])
    heroLabel = totalParticipants ? `RANK OF ${totalParticipants}` : "RANK"
  } else if (hasScore) {
    heroNode = el("div", {
      display: "flex", alignItems: "baseline", justifyContent: "center",
    }, [
      el("span", { fontSize: "140px", fontWeight: "800", color: theme.text, lineHeight: "0.85" }, String(score)),
      el("span", { fontSize: "60px", fontWeight: "700", color: theme.accent, marginLeft: "8px" }, `/ ${totalScore}`),
    ])
    heroLabel = "POINTS"
  } else {
    heroNode = el("div", {
      display: "flex", alignItems: "baseline", justifyContent: "center",
    }, [
      el("span", { fontSize: "80px", fontWeight: "800", color: theme.text }, "COMPLETED"),
    ])
  }

  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  const serial = buildSerialNumber(p)
  const badgeLabel = isCertificate ? "CERTIFICATE OF COMPLETION" : typeLabel(p.type)
  const eventName = subtitle || p.achievementData?.eventTitle || title

  // --- QR code --
  let qrDataUrl = ""
  if (p.shareUrl) {
    try { qrDataUrl = await generateAchievementQr(p.shareUrl) } catch { /* ignore */ }
  }

  // Trophy position (center of card, slightly above middle)
  const trophyCenterX = W / 2
  const trophyCenterY = H * 0.42

  // --- Build the card --
  const card: SatoriNode = el("div", {
    display: "flex",
    flexDirection: "column",
    width: `${W}px`,
    height: `${H}px`,
    background: `linear-gradient(160deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)`,
    fontFamily: "DejaVu Sans",
  }, [
    // -- Decorative blob (top-right) --
    el("div", {
      display: "flex",
      position: "absolute",
      top: "-150px",
      right: "-150px",
      width: "600px",
      height: "600px",
      borderRadius: "50%",
      backgroundColor: theme.blobColor,
      opacity: "0.25",
    }),

    // -- Paper burst (radiating rays behind trophy) --
    ...buildPaperBurst(theme, trophyCenterX, trophyCenterY),

    // -- Confetti (concentrated around trophy) --
    ...buildConfetti(theme, 50, trophyCenterX, trophyCenterY),

    // -- Content (fills entire card, no blank space) --
    el("div", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      flex: "1",
      padding: "50px 70px",
      position: "relative",
    }, [
      // 1. Badge (pill) - top
      el("div", {
        display: "flex",
      }, [
        el("div", {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: "28px", paddingRight: "28px",
          paddingTop: "12px", paddingBottom: "12px",
          borderRadius: "40px",
          backgroundColor: theme.badgeBg,
        }, [
          el("span", { fontSize: "18px", fontWeight: "700", color: theme.badgeText, letterSpacing: "5px" }, badgeLabel),
        ]),
      ]),

      // 2. BIG TROPHY - (the visual anchor - fills the center)
      el("div", {
        display: "flex",
      }, [
        buildTrophy(theme, 220),
      ]),

      // 3. Hero metric (below trophy)
      el("div", {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }, [
        heroNode,
        // 4. Score label (inside the hero group)
        ...(heroLabel ? [
          el("div", {
            display: "flex",
            marginTop: "8px",
          }, [
            el("span", { fontSize: "22px", fontWeight: "700", color: theme.textSecondary, letterSpacing: "8px" }, heroLabel),
          ]),
        ] : []),
      ]),

      // 5. "AWARDED TO" + name + event + date (grouped at bottom)
      el("div", {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }, [
        el("span", { fontSize: "18px", fontWeight: "400", color: theme.textMuted, letterSpacing: "4px" }, "AWARDED TO"),
        el("div", {
          fontSize: "52px",
          fontWeight: "800",
          color: theme.text,
          textAlign: "center",
          maxWidth: "900px",
          lineHeight: "1.1",
          marginTop: "8px",
        }, truncate(participantName, 30)),
        el("div", {
          fontSize: "30px",
          fontWeight: "600",
          color: theme.textSecondary,
          textAlign: "center",
          maxWidth: "900px",
          marginTop: "12px",
        }, truncate(eventName, 45)),
        el("div", { fontSize: "22px", color: theme.textMuted, marginTop: "10px" }, dateStr),
      ]),
    ]),

    // -- Footer (curved, fills bottom) --
    el("div", {
      display: "flex",
      flexDirection: "column",
      position: "relative",
    }, [
      // Curved footer background
      el("div", {
        display: "flex",
        position: "absolute",
        top: "0", left: "0",
        width: "100%", height: "100%",
        backgroundColor: theme.footerColor,
        borderTopLeftRadius: "50px",
        borderTopRightRadius: "50px",
      }),
      // Footer content
      el("div", {
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        padding: "35px 70px",
        position: "relative",
      }, [
        // Left: serial + powered by
        el("div", { display: "flex", flexDirection: "column" }, [
          el("div", { fontSize: "13px", color: theme.textMuted, letterSpacing: "3px", marginBottom: "6px" }, "VERIFY AT"),
          el("div", { fontSize: "20px", fontWeight: "700", color: theme.text, fontFamily: "DejaVu Sans Mono", marginBottom: "14px" }, serial),
          el("div", { fontSize: "15px", color: theme.textMuted }, "Powered by Engagio"),
        ]),
        // Right: QR code
        ...(qrDataUrl ? [
          el("div", { display: "flex", flexDirection: "column", alignItems: "center" }, [
            el("div", {
              display: "flex", padding: "12px", borderRadius: "16px",
              backgroundColor: "#ffffff",
            }, [
              el("img", { width: "110px", height: "110px" }, undefined, { src: qrDataUrl }),
            ]),
            el("div", { fontSize: "12px", fontWeight: "600", color: theme.textMuted, letterSpacing: "2px", marginTop: "8px" }, "SCAN TO VERIFY"),
          ]),
        ] : []),
      ]),
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
    console.error("[card-renderer] Resvg SVG-PNG failed; using SVG fallback:", e)
    return { png: Buffer.from(svg, "utf-8"), svg }
  }
}
