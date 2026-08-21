/**
 * Gate Pass ID Card renderer — generates a downloadable PNG ID card.
 *
 * Uses Satori + Resvg (same as achievement cards) with embedded DejaVu Sans fonts.
 * The card includes: event name, participant name, pass number, QR code,
 * org logo, and event dates.
 */

import satori from "satori"
import { Resvg } from "@resvg/resvg-js"
import { generateAchievementQr } from "./achievement"
import { DEJAVU_SANS, DEJAVU_SANS_BOLD, DEJAVU_SANS_MONO } from "./font-data"

export interface GatePassCardParams {
  passNumber: string
  participantName: string
  participantEmail: string
  eventTitle: string
  eventStartDate: string
  eventEndDate: string
  eventImage: string | null
  orgName: string
  orgLogoUrl: string | null
  orgPrimaryColor: string
  verifyToken: string
  shareUrl: string
}

const W = 800
const H = 1200 // portrait ID card aspect ratio (2:3)

function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64")
}

const fonts = [
  { name: "DejaVu Sans", data: base64ToBuffer(DEJAVU_SANS), weight: 400 as const, style: "normal" as const },
  { name: "DejaVu Sans", data: base64ToBuffer(DEJAVU_SANS_BOLD), weight: 700 as const, style: "normal" as const },
  { name: "DejaVu Sans Mono", data: base64ToBuffer(DEJAVU_SANS_MONO), weight: 400 as const, style: "normal" as const },
]

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

export async function renderGatePassCard(p: GatePassCardParams): Promise<{ png: Buffer; svg: string }> {
  // Generate QR code
  let qrDataUrl = ""
  try {
    qrDataUrl = await generateAchievementQr(p.shareUrl)
  } catch {
    // ignore
  }

  const startDateStr = new Date(p.eventStartDate).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  })
  const endDateStr = new Date(p.eventEndDate).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  })

  const accent = p.orgPrimaryColor || "#10b981"

  const card: SatoriNode = el("div", {
    display: "flex",
    flexDirection: "column",
    width: `${W}px`,
    height: `${H}px`,
    background: `linear-gradient(160deg, #ffffff 0%, #f8fafc 100%)`,
    fontFamily: "DejaVu Sans",
    border: `8px solid ${accent}`,
    borderRadius: "24px",
  }, [
    // Top accent bar
    el("div", {
      display: "flex",
      height: "8px",
      backgroundColor: accent,
    }),

    // Content
    el("div", {
      display: "flex",
      flexDirection: "column",
      flex: "1",
      padding: "40px",
    }, [
      // ── Header: Event name + org ──
      el("div", {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "30px",
      }, [
        el("div", {
          fontSize: "28px",
          fontWeight: "800",
          color: "#0f172a",
          textAlign: "center",
        }, p.eventTitle),
        el("div", {
          fontSize: "16px",
          color: "#64748b",
          marginTop: "6px",
        }, p.orgName || "Event Gate Pass"),
      ]),

      // ── Divider ──
      el("div", {
        display: "flex",
        height: "2px",
        backgroundColor: "#e2e8f0",
        marginBottom: "30px",
      }),

      // ── Pass number badge ──
      el("div", {
        display: "flex",
        justifyContent: "center",
        marginBottom: "30px",
      }, [
        el("div", {
          display: "flex",
          backgroundColor: accent + "20",
          border: `2px solid ${accent}`,
          borderRadius: "12px",
          paddingLeft: "20px",
          paddingRight: "20px",
          paddingTop: "8px",
          paddingBottom: "8px",
        }, [
          el("span", {
            fontSize: "16px",
            fontWeight: "700",
            color: accent,
            fontFamily: "DejaVu Sans Mono",
          }, p.passNumber),
        ]),
      ]),

      // ── Participant info ──
      el("div", {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "30px",
      }, [
        el("div", {
          fontSize: "14px",
          color: "#94a3b8",
          marginBottom: "6px",
        }, "PARTICIPANT"),
        el("div", {
          fontSize: "32px",
          fontWeight: "800",
          color: "#0f172a",
          textAlign: "center",
        }, p.participantName),
        el("div", {
          fontSize: "16px",
          color: "#64748b",
          marginTop: "6px",
        }, p.participantEmail),
      ]),

      // ── Event dates ──
      el("div", {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "30px",
      }, [
        el("div", {
          fontSize: "14px",
          color: "#94a3b8",
          marginBottom: "6px",
        }, "EVENT DATES"),
        el("div", {
          fontSize: "20px",
          fontWeight: "600",
          color: "#334155",
        }, `${startDateStr} - ${endDateStr}`),
      ]),

      // ── QR code + verify info ──
      el("div", {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        marginTop: "20px",
      }, [
        // QR code
        ...(qrDataUrl ? [
          el("img", {
            width: "140px",
            height: "140px",
            backgroundColor: "#ffffff",
            padding: "8px",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
          }, undefined, { src: qrDataUrl }),
        ] : []),
        // Verify text
        el("div", {
          display: "flex",
          flexDirection: "column",
        }, [
          el("div", {
            fontSize: "12px",
            fontWeight: "700",
            color: "#94a3b8",
          }, "SCAN TO VERIFY"),
          el("div", {
            fontSize: "12px",
            color: "#94a3b8",
            marginTop: "4px",
          }, "at engagio.app/gate/..."),
        ]),
      ]),
    ]),

    // ── Footer ──
    el("div", {
      display: "flex",
      justifyContent: "center",
      padding: "20px",
    }, [
      el("div", {
        fontSize: "12px",
        color: "#94a3b8",
      }, "Powered by Engagio"),
    ]),
  ])

  const svg = await satori(card, { width: W, height: H, fonts })
  try {
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: W }, dpi: 144 })
    const png = resvg.render().asPng()
    return { png: Buffer.from(png), svg }
  } catch (e) {
    console.error("[gate-pass-renderer] Resvg failed:", e)
    return { png: Buffer.from(svg, "utf-8"), svg }
  }
}
