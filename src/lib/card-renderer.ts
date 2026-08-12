/**
 * Server-side card renderer using Satori + Resvg.
 *
 * ─── Reference-matched achievement card design ─────────────────────────────
 * Mint/aqua gradient background, trophy watermark, confetti, clean layout.
 * Inspired by the user's reference image (Gemini_Generated_Image).
 *
 * Layout (top to bottom):
 *   1. Pill badge with type label
 *   2. Big score number + "SCORE" label
 *   3. Trophy watermark (large, behind text)
 *   4. "AWARDED TO" + participant name
 *   5. Event name + date
 *   6. Footer: serial + QR + "Powered by Engagio"
 *
 * 5 color palettes (all light backgrounds):
 *   1. minimal      — Mint/aqua (reference match)
 *   2. modern       — Emerald/mint
 *   3. professional — Amber/cream
 *   4. celebration  — Pink/rose
 *   5. conference   — Teal/sky
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

// ─── 5 light color palettes ────────────────────────────────────────────────
interface CardTheme {
  bgFrom: string // top of gradient (lighter)
  bgTo: string // bottom of gradient (slightly darker)
  blobColor: string // large decorative blob
  footerColor: string // footer curve color
  text: string // primary text (dark)
  textSecondary: string // secondary text
  textMuted: string // muted text
  accent: string // accent color (for score, badge)
  accentDark: string // darker accent
  badgeBg: string // badge background
  badgeText: string // badge text
  confetti: string[] // confetti colors
}

const THEMES: Record<AchievementTemplateId, CardTheme> = {
  // 1. Mint/aqua (reference match)
  minimal: {
    bgFrom: "#e0f7f4", bgTo: "#a8d5da",
    blobColor: "#7bc4c9",
    footerColor: "#f5f9f8",
    text: "#1a3a3a", textSecondary: "#2c5f5f", textMuted: "#5a8585",
    accent: "#0d9488", accentDark: "#0f766e",
    badgeBg: "#8fb8b8", badgeText: "#1a4a4a",
    confetti: ["#f4d03f", "#00ced1", "#48d1cc", "#7bc4c9", "#ffffff"],
  },
  // 2. Emerald/mint
  modern: {
    bgFrom: "#d1fae5", bgTo: "#6ee7b7",
    blobColor: "#34d399",
    footerColor: "#f0fdf4",
    text: "#064e3b", textSecondary: "#047857", textMuted: "#059669",
    accent: "#059669", accentDark: "#047857",
    badgeBg: "#a7f3d0", badgeText: "#064e3b",
    confetti: ["#fbbf24", "#10b981", "#34d399", "#6ee7b7", "#ffffff"],
  },
  // 3. Amber/cream
  professional: {
    bgFrom: "#fef3c7", bgTo: "#fcd34d",
    blobColor: "#fbbf24",
    footerColor: "#fffbeb",
    text: "#78350f", textSecondary: "#92400e", textMuted: "#b45309",
    accent: "#d97706", accentDark: "#92400e",
    badgeBg: "#fde68a", badgeText: "#78350f",
    confetti: ["#f59e0b", "#fbbf24", "#fde68a", "#ffffff", "#d97706"],
  },
  // 4. Pink/rose
  celebration: {
    bgFrom: "#fce7f3", bgTo: "#f9a8d4",
    blobColor: "#f472b6",
    footerColor: "#fdf2f8",
    text: "#831843", textSecondary: "#9d174d", textMuted: "#be185d",
    accent: "#db2777", accentDark: "#9d174d",
    badgeBg: "#fbcfe8", badgeText: "#831843",
    confetti: ["#ec4899", "#f472b6", "#f9a8d4", "#ffffff", "#fbbf24"],
  },
  // 5. Teal/sky
  conference: {
    bgFrom: "#ccfbf1", bgTo: "#5eead4",
    blobColor: "#2dd4bf",
    footerColor: "#f0fdfa",
    text: "#134e4a", textSecondary: "#0f766e", textMuted: "#0d9488",
    accent: "#0d9488", accentDark: "#0f766e",
    badgeBg: "#99f6e4", badgeText: "#134e4a",
    confetti: ["#14b8a6", "#2dd4bf", "#5eead4", "#ffffff", "#0d9488"],
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

// ─── Confetti (scattered across entire card) ───────────────────────────────
function buildConfetti(theme: CardTheme, count: number): SatoriNode[] {
  const confetti: SatoriNode[] = []
  let seed = 42
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * 100)
    const y = Math.floor(rand() * 70) // concentrate in top 70%
    const size = 6 + Math.floor(rand() * 12)
    const color = theme.confetti[i % theme.confetti.length]
    const opacity = 0.3 + rand() * 0.5
    const rotation = Math.floor(rand() * 360)
    const shape = rand()

    let shapeElement: SatoriNode
    if (shape > 0.66) {
      // Circle
      shapeElement = el("div", {
        display: "flex",
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        borderRadius: "50%",
        opacity: String(opacity),
      })
    } else if (shape > 0.33) {
      // Square (rotated as diamond)
      shapeElement = el("div", {
        display: "flex",
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        borderRadius: "2px",
        opacity: String(opacity),
        transform: `rotate(45deg)`,
      })
    } else {
      // Small sparkle dot
      shapeElement = el("div", {
        display: "flex",
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: `${size * 0.6}px`,
        height: `${size * 0.6}px`,
        backgroundColor: color,
        borderRadius: "50%",
        opacity: String(opacity * 0.8),
      })
    }
    confetti.push(shapeElement)
  }
  return confetti
}

// ─── Trophy watermark (large, behind text) ─────────────────────────────────
function buildTrophyWatermark(theme: CardTheme): SatoriNode {
  return el("div", {
    display: "flex",
    position: "absolute",
    top: "35%",
    left: "50%",
    width: "500px",
    height: "500px",
    opacity: "0.08",
    transform: "translateX(-50%)",
  }, [
    // Simple trophy shape using SVG path
    el("svg", {
      width: "500px",
      height: "500px",
      viewBox: "0 0 100 100",
    }, [
      el("path", {
        d: "M30 15 L70 15 L68 45 Q68 55 60 58 L58 70 L72 70 L72 78 L28 78 L28 70 L42 70 L40 58 Q32 55 32 45 Z M20 20 L30 20 L30 30 Q30 38 24 38 Q18 38 18 30 Z M70 20 L80 20 L82 30 Q82 38 76 38 Q70 38 70 30 Z",
        fill: theme.text,
      }),
    ]),
  ])
}

async function buildCardTree(p: CardRenderParams): Promise<SatoriNode> {
  const theme = THEMES[p.templateId] || THEMES.minimal
  const { title, subtitle, participantName, percentage, rank, score, totalScore, totalParticipants } = p

  const hasPercent = typeof percentage === "number" && percentage >= 0
  const hasRank = typeof rank === "number" && rank > 0
  const hasScore = typeof score === "number" && typeof totalScore === "number"
  const isCertificate = p.type === "CERTIFICATE_EARNED"

  // ─── Build hero metric ──
  let heroNode: SatoriNode
  let heroLabel = ""

  if (isCertificate) {
    heroNode = el("div", {
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "80px", height: "80px", borderRadius: "50%",
      backgroundColor: theme.accent, fontSize: "40px",
    }, "★")
  } else if (hasPercent) {
    heroNode = el("div", {
      display: "flex", alignItems: "baseline", justifyContent: "center",
    }, [
      el("span", { fontSize: "140px", fontWeight: "800", color: theme.text, lineHeight: "0.9" }, String(percentage)),
      el("span", { fontSize: "60px", fontWeight: "700", color: theme.accent, marginLeft: "4px" }, "%"),
    ])
    heroLabel = "SCORE"
  } else if (hasRank) {
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏆"
    heroNode = el("div", {
      display: "flex", flexDirection: "column", alignItems: "center",
    }, [
      el("div", { fontSize: "56px", marginBottom: "8px" }, medal),
      el("div", { display: "flex", alignItems: "baseline" }, [
        el("span", { fontSize: "120px", fontWeight: "800", color: theme.text, lineHeight: "0.9" }, String(rank)),
        el("span", { fontSize: "50px", fontWeight: "700", color: theme.accent, marginLeft: "4px" }, rankSuffix(rank)),
      ]),
    ])
    heroLabel = totalParticipants ? `RANK OF ${totalParticipants}` : "RANK"
  } else if (hasScore) {
    heroNode = el("div", {
      display: "flex", alignItems: "baseline", justifyContent: "center",
    }, [
      el("span", { fontSize: "120px", fontWeight: "800", color: theme.text, lineHeight: "0.9" }, String(score)),
      el("span", { fontSize: "50px", fontWeight: "700", color: theme.accent, marginLeft: "8px" }, `/ ${totalScore}`),
    ])
    heroLabel = "POINTS"
  } else {
    heroNode = el("div", {
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "80px", height: "80px", borderRadius: "50%",
      backgroundColor: theme.accent, fontSize: "40px",
    }, "✓")
  }

  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  const serial = buildSerialNumber(p)
  const badgeLabel = isCertificate ? "CERTIFICATE OF COMPLETION" : typeLabel(p.type)
  const eventName = subtitle || p.achievementData?.eventTitle || title

  // ─── QR code ──
  let qrDataUrl = ""
  if (p.shareUrl) {
    try { qrDataUrl = await generateAchievementQr(p.shareUrl) } catch { /* ignore */ }
  }

  // ─── Build the card ──
  const card: SatoriNode = el("div", {
    display: "flex",
    flexDirection: "column",
    width: `${W}px`,
    height: `${H}px`,
    background: `linear-gradient(160deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)`,
    fontFamily: "DejaVu Sans",
  }, [
    // ── Decorative blob (top-right) ──
    el("div", {
      display: "flex",
      position: "absolute",
      top: "-100px",
      right: "-100px",
      width: "500px",
      height: "500px",
      borderRadius: "50%",
      backgroundColor: theme.blobColor,
      opacity: "0.3",
    }),

    // ── Trophy watermark (behind text) ──
    buildTrophyWatermark(theme),

    // ── Confetti ──
    ...buildConfetti(theme, 35),

    // ── Content ──
    el("div", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      flex: "1",
      padding: "70px",
      position: "relative",
    }, [
      // 1. Badge (pill)
      el("div", {
        display: "flex",
        marginTop: "20px",
      }, [
        el("div", {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: "24px", paddingRight: "24px",
          paddingTop: "10px", paddingBottom: "10px",
          borderRadius: "30px",
          backgroundColor: theme.badgeBg,
        }, [
          el("span", { fontSize: "16px", fontWeight: "700", color: theme.badgeText, letterSpacing: "4px" }, badgeLabel),
        ]),
      ]),

      // 2. Hero metric
      el("div", {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "40px",
      }, [heroNode]),

      // 3. Score label
      ...(heroLabel ? [
        el("div", {
          display: "flex",
          marginTop: "12px",
        }, [
          el("span", { fontSize: "20px", fontWeight: "700", color: theme.textSecondary, letterSpacing: "6px" }, heroLabel),
        ]),
      ] : []),

      // 4. "AWARDED TO"
      el("div", {
        display: "flex",
        marginTop: "50px",
      }, [
        el("span", { fontSize: "16px", fontWeight: "400", color: theme.textMuted, letterSpacing: "3px" }, "AWARDED TO"),
      ]),

      // 5. Participant name (BIG)
      el("div", {
        display: "flex",
        marginTop: "8px",
      }, [
        el("div", {
          fontSize: "48px",
          fontWeight: "800",
          color: theme.text,
          textAlign: "center",
          maxWidth: "900px",
          lineHeight: "1.1",
        }, truncate(participantName, 30)),
      ]),

      // 6. Event name
      el("div", {
        display: "flex",
        marginTop: "16px",
      }, [
        el("div", {
          fontSize: "28px",
          fontWeight: "600",
          color: theme.textSecondary,
          textAlign: "center",
          maxWidth: "900px",
        }, truncate(eventName, 45)),
      ]),

      // 7. Date
      el("div", {
        display: "flex",
        marginTop: "12px",
      }, [
        el("div", { fontSize: "20px", color: theme.textMuted }, dateStr),
      ]),
    ]),

    // ── Footer (with curved background) ──
    el("div", {
      display: "flex",
      flexDirection: "column",
      position: "relative",
    }, [
      // Curved footer background
      el("div", {
        display: "flex",
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        backgroundColor: theme.footerColor,
        borderTopLeftRadius: "60px",
        borderTopRightRadius: "60px",
      }),
      // Footer content
      el("div", {
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        padding: "40px 70px",
        position: "relative",
      }, [
        // Left: serial + powered by
        el("div", { display: "flex", flexDirection: "column" }, [
          el("div", { fontSize: "12px", color: theme.textMuted, letterSpacing: "3px", marginBottom: "6px" }, "VERIFY AT"),
          el("div", { fontSize: "18px", fontWeight: "700", color: theme.text, fontFamily: "DejaVu Sans Mono", marginBottom: "16px" }, serial),
          el("div", { fontSize: "14px", color: theme.textMuted }, "Powered by Engagio"),
        ]),
        // Right: QR code
        ...(qrDataUrl ? [
          el("div", { display: "flex", flexDirection: "column", alignItems: "center" }, [
            el("div", {
              display: "flex",
              padding: "12px",
              borderRadius: "16px",
              backgroundColor: "#ffffff",
            }, [
              el("img", { width: "120px", height: "120px" }, undefined, { src: qrDataUrl }),
            ]),
            el("div", { fontSize: "11px", fontWeight: "600", color: theme.textMuted, letterSpacing: "2px", marginTop: "8px" }, "SCAN TO VERIFY"),
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
    console.error("[card-renderer] Resvg SVG→PNG failed; using SVG fallback:", e)
    return { png: Buffer.from(svg, "utf-8"), svg }
  }
}
