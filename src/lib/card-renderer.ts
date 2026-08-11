/**
 * Server-side card renderer using Satori + Resvg.
 *
 * Satori (by Vercel) converts React-like elements to SVG with proper font
 * support. It accepts font data as ArrayBuffer, so there's no dependency
 * on system-installed fonts. This fixes the "tofu boxes" (□□□□) issue
 * that occurred with sharp/librsvg on Vercel.
 *
 * Resvg converts the Satori SVG to PNG.
 *
 * Design: Clean white certificate-style card with emerald accents.
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

// ─── Dimensions ─────────────────────────────────────────────────────────────
const W = 1200
const H = 1500

// ─── Font data (base64 → Buffer) ────────────────────────────────────────────
function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64")
}

const fonts = [
  {
    name: "DejaVu Sans",
    data: base64ToBuffer(DEJAVU_SANS),
    weight: 400 as const,
    style: "normal" as const,
  },
  {
    name: "DejaVu Sans",
    data: base64ToBuffer(DEJAVU_SANS_BOLD),
    weight: 700 as const,
    style: "normal" as const,
  },
  {
    name: "DejaVu Sans Mono",
    data: base64ToBuffer(DEJAVU_SANS_MONO),
    weight: 400 as const,
    style: "normal" as const,
  },
]

// ─── Colors ────────────────────────────────────────────────────────────────
const C = {
  white: "#ffffff",
  bgLight: "#f8fafc",
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
  minimal: { accent: C.teal, accentDark: C.tealDark, accentLight: C.teal, accentBg: C.emerald50, label: "ACHIEVEMENT" },
  modern: { accent: C.emerald, accentDark: C.emeraldDark, accentLight: C.emeraldLight, accentBg: C.emerald50, label: "ACHIEVEMENT" },
  professional: { accent: C.amber, accentDark: C.amberDark, accentLight: C.amberLight, accentBg: "#fffbeb", label: "CERTIFICATE" },
  celebration: { accent: C.amber, accentDark: C.amberDark, accentLight: C.amberLight, accentBg: "#fffbeb", label: "ACHIEVEMENT" },
  conference: { accent: C.teal, accentDark: C.tealDark, accentLight: C.teal, accentBg: C.emerald50, label: "ATTENDEE PASS" },
}

// ─── Type info ─────────────────────────────────────────────────────────────
function typeInfo(type: AchievementType): { label: string } {
  switch (type) {
    case "QUIZ_RESULT":
    case "KNOWLEDGE_CHECK_RESULT":
      return { label: "QUIZ RESULT" }
    case "LIVE_QUIZ_RESULT":
      return { label: "LIVE QUIZ RESULT" }
    case "PRE_POST_RESULT":
      return { label: "LEARNING PROGRESS" }
    case "CERTIFICATE_EARNED":
      return { label: "CERTIFICATE OF COMPLETION" }
    case "ACTIVITY_COMPLETED":
    case "EVENT_PARTICIPATION":
      return { label: "PARTICIPATION" }
    case "LEADERBOARD_ACHIEVEMENT":
      return { label: "LEADERBOARD ACHIEVEMENT" }
    default:
      return { label: "ACHIEVEMENT" }
  }
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

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + "..."
}

// ─── Build the Satori JSX tree ─────────────────────────────────────────────

// Satori uses a subset of React's createElement. We use inline objects.
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
  const info = typeInfo(p.type)
  const { title, subtitle, participantName, percentage, rank, score, totalScore, totalParticipants } = p

  const hasPercent = typeof percentage === "number" && percentage >= 0
  const hasRank = typeof rank === "number" && rank > 0
  const hasScore = typeof score === "number" && typeof totalScore === "number"
  const isCertificate = p.type === "CERTIFICATE_EARNED"

  // Hero metric
  let heroLine = ""
  let heroSuffix = ""
  let heroSub = ""

  if (!isCertificate) {
    if (hasPercent) {
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
      heroSub = "COMPLETED"
    }
  }

  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const serial = buildSerialNumber(p)

  // QR code as data URL
  let qrDataUrl = ""
  if (p.shareUrl) {
    try {
      qrDataUrl = await generateAchievementQr(p.shareUrl)
    } catch {
      // ignore
    }
  }

  // Build hero section
  const heroSection: SatoriNode[] = []

  if (isCertificate) {
    heroSection.push(
      el("div", { display: "flex", flexDirection: "column", alignItems: "center" }, [
        el("div", { fontSize: "22px", color: C.slate400, marginBottom: "8px" }, "This certifies that"),
        el("div", {
          fontSize: "52px",
          fontWeight: "800",
          color: C.slate900,
          textAlign: "center",
          maxWidth: "900px",
        }, participantName),
        el("div", { fontSize: "24px", fontStyle: "italic", color: C.slate500, marginTop: "8px" }, "has successfully completed"),
      ]),
    )
  } else if (heroLine) {
    heroSection.push(
      el("div", { display: "flex", flexDirection: "column", alignItems: "center" }, [
        el("div", { display: "flex", alignItems: "baseline", justifyContent: "center" }, [
          el("span", { fontSize: "130px", fontWeight: "800", color: C.slate900, lineHeight: "1" }, heroLine),
          el("span", { fontSize: "60px", fontWeight: "700", color: theme.accent, marginLeft: "4px" }, heroSuffix),
        ]),
        el("div", { fontSize: "20px", fontWeight: "700", color: theme.accent, letterSpacing: "6px", marginTop: "8px" }, heroSub),
        el("div", { fontSize: "16px", color: C.slate400, marginTop: "16px" }, "Awarded to"),
        el("div", { fontSize: "40px", fontWeight: "800", color: C.slate900, textAlign: "center", maxWidth: "900px" }, participantName),
      ]),
    )
  } else {
    heroSection.push(
      el("div", { display: "flex", flexDirection: "column", alignItems: "center" }, [
        el("div", {
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          backgroundColor: theme.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }, "✓"),
        el("div", { fontSize: "20px", fontWeight: "700", color: theme.accent, letterSpacing: "6px", marginTop: "12px" }, "COMPLETED"),
        el("div", { fontSize: "16px", color: C.slate400, marginTop: "16px" }, "Awarded to"),
        el("div", { fontSize: "40px", fontWeight: "800", color: C.slate900, textAlign: "center", maxWidth: "900px" }, participantName),
      ]),
    )
  }

  // Build the full card
  const card: SatoriNode = el("div", {
    display: "flex",
    flexDirection: "column",
    width: `${W}px`,
    height: `${H}px`,
    backgroundColor: C.bgLight,
    fontFamily: "DejaVu Sans",
    padding: "40px",
  }, [
    // Card container
    el("div", {
      display: "flex",
      flexDirection: "column",
      flex: "1",
      backgroundColor: C.white,
      borderRadius: "24px",
      border: `1px solid ${C.slate200}`,
      overflow: "hidden",
    }, [
      // Top accent bar
      el("div", {
        height: "6px",
        backgroundColor: theme.accent,
      }),

      // Content padding
      el("div", {
        display: "flex",
        flexDirection: "column",
        flex: "1",
        padding: "40px",
      }, [
        // ═══ HEADER ═══
        el("div", {
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }, [
          // Logo
          el("div", { display: "flex", flexDirection: "row", alignItems: "center" }, [
            el("div", {
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: theme.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "12px",
            }, "★"),
            el("span", { fontSize: "24px", fontWeight: "800", color: C.slate900 }, "Engagio"),
          ]),
          // Verified badge
          el("div", {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: "16px",
            paddingRight: "16px",
            paddingTop: "10px",
            paddingBottom: "10px",
            borderRadius: "24px",
            backgroundColor: theme.accentBg,
            border: `1.5px solid ${theme.accent}`,
          }, [
            el("span", { fontSize: "16px", fontWeight: "700", color: theme.accentDark }, "✓ Verified"),
          ]),
        ]),

        // Header divider
        el("div", { height: "1px", backgroundColor: C.slate200, marginBottom: "40px" }),

        // ═══ TYPE LABEL ═══
        el("div", {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: "30px",
        }, [
          el("div", {
            fontSize: "18px",
            fontWeight: "700",
            color: theme.accent,
            letterSpacing: "8px",
          }, info.label),
          el("div", {
            width: "60px",
            height: "2px",
            backgroundColor: theme.accent,
            marginTop: "12px",
          }),
        ]),

        // ═══ HERO SECTION ═══
        el("div", {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: "1",
        }, heroSection),

        // ═══ TITLE ═══
        el("div", {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: "20px",
        }, [
          el("div", {
            fontSize: "36px",
            fontWeight: "700",
            color: C.slate900,
            textAlign: "center",
            maxWidth: "900px",
          }, truncate(title, 60)),
          ...(subtitle ?
            [el("div", {
              fontSize: "24px",
              color: C.slate500,
              textAlign: "center",
              marginTop: "8px",
              maxWidth: "900px",
            }, truncate(subtitle, 70))]
            : []
          ),
          el("div", { fontSize: "22px", color: C.slate500, marginTop: "16px" }, `Issued on ${dateStr}`),
          ...(p.achievementData?.orgName ?
            [el("div", { fontSize: "20px", fontWeight: "600", color: C.slate700, marginTop: "8px" }, truncate(p.achievementData.orgName, 50))]
            : []
          ),
        ]),

        // ═══ FOOTER ═══
        el("div", {
          display: "flex",
          flexDirection: "column",
          marginTop: "30px",
        }, [
          // Dashed divider
          el("div", {
            height: "1px",
            borderTop: `1px dashed ${C.slate300}`,
            marginBottom: "20px",
          }),
          // Serial + QR row
          el("div", {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }, [
            // Serial number
            el("div", { display: "flex", flexDirection: "column" }, [
              el("div", { fontSize: "12px", fontWeight: "700", color: C.slate400, letterSpacing: "3px" }, `${theme.label} NO.`),
              el("div", {
                fontSize: "26px",
                fontWeight: "700",
                color: C.slate900,
                fontFamily: "DejaVu Sans Mono",
                marginTop: "4px",
              }, serial),
              el("div", {
                fontSize: "14px",
                color: C.slate400,
                fontFamily: "DejaVu Sans Mono",
                marginTop: "4px",
              }, `engagio.app/s/${serial.split("-").pop()}`),
            ]),
            // QR code
            ...(qrDataUrl ? [
              el("div", { display: "flex", flexDirection: "column", alignItems: "center" }, [
                el("img", {
                  width: "170px",
                  height: "170px",
                }, undefined, { src: qrDataUrl }),
                el("div", { fontSize: "12px", fontWeight: "600", color: C.slate400, letterSpacing: "2px", marginTop: "8px" }, "SCAN TO VERIFY"),
              ]),
            ] : []),
          ]),
          // Powered by
          el("div", {
            fontSize: "14px",
            color: C.slate400,
            textAlign: "center",
            marginTop: "20px",
          }, "Powered by Engagio"),
        ]),
      ]),
    ]),
  ])

  return card
}

/** Render only the SVG (via Satori). */
export async function renderCardSvg(p: CardRenderParams): Promise<string> {
  const tree = await buildCardTree(p)
  const svg = await satori(tree, {
    width: W,
    height: H,
    fonts,
  })
  return svg
}

/**
 * Render the card and convert SVG → PNG via Resvg.
 * Falls back to returning the SVG buffer if Resvg fails.
 */
export async function renderCard(p: CardRenderParams): Promise<RenderedCard> {
  const svg = await renderCardSvg(p)
  try {
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: W },
      dpi: 144,
    })
    const png = resvg.render().asPng()
    const pngBuffer = Buffer.from(png)
    return { png: pngBuffer, svg }
  } catch (e) {
    console.error("[card-renderer] Resvg SVG→PNG failed; using SVG fallback:", e)
    return { png: Buffer.from(svg, "utf-8"), svg }
  }
}
