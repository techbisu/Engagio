/**
 * Server-side certificate OG image renderer.
 *
 * Generates a PNG (1200×630) suitable for Open Graph / Twitter card previews
 * when a certificate verification URL is shared on LinkedIn, Facebook, X,
 * WhatsApp, etc. The social crawler fetches the URL, reads the og:image /
 * og:title / og:description meta tags (added by generateMetadata on the
 * verify page), and renders the preview card.
 *
 * This is a SIMPLIFIED version of the certificate — not the full canvas
 * template. The full certificate image is rendered client-side by
 * CertificateRenderer (which uses the <canvas> element). Social crawlers
 * can't run client JS, so we render a static PNG here with satori + resvg.
 */

import satori from "satori"
import { Resvg } from "@resvg/resvg-js"
import { db } from "@/lib/db"
import { DEJAVU_SANS, DEJAVU_SANS_BOLD } from "@/lib/font-data"

const W = 1200
const H = 630

const fonts = [
  { name: "DejaVu Sans", data: Buffer.from(DEJAVU_SANS, "base64"), weight: 400 as const, style: "normal" as const },
  { name: "DejaVu Sans", data: Buffer.from(DEJAVU_SANS_BOLD, "base64"), weight: 700 as const, style: "normal" as const },
]

export interface CertOgParams {
  recipientName: string
  eventName: string
  eventDescription?: string | null
  orgName?: string | null
  certificateNumber: string
  issuedAt: string // ISO
  templateName?: string // classic|modern|elegant|bold|minimal
}

/** Map a template name to a color palette for the OG card. */
function paletteFor(templateName?: string) {
  switch (templateName) {
    case "classic":
      return { bg: "#ffffff", border: "#065f46", accent: "#065f46", text: "#0f172a", muted: "#475569", ribbon: "#10b981" }
    case "elegant":
      return { bg: "#fefce8", border: "#92400e", accent: "#92400e", text: "#1c1917", muted: "#78716c", ribbon: "#d97706" }
    case "bold":
      return { bg: "#0f172a", border: "#10b981", accent: "#10b981", text: "#ffffff", muted: "#cbd5e1", ribbon: "#10b981" }
    case "minimal":
      return { bg: "#ffffff", border: "#e2e8f0", accent: "#0f172a", text: "#0f172a", muted: "#94a3b8", ribbon: "#0f172a" }
    case "modern":
    default:
      return { bg: "#ffffff", border: "#065f46", accent: "#065f46", text: "#0f172a", muted: "#64748b", ribbon: "#10b981" }
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  } catch {
    return new Date(iso).toDateString()
  }
}

/**
 * Render the certificate OG image as a PNG Buffer.
 *
 * Layout (1200×630):
 *   - Outer border (4px) in the template accent color
 *   - Top-left ribbon: "CERTIFICATE OF PARTICIPATION"
 *   - Center: recipient name (large), event name (medium), event description (small, italic)
 *   - Bottom row: org name (left), certificate number + date (right)
 */
export async function renderCertOgImage(params: CertOgParams): Promise<Buffer> {
  const p = paletteFor(params.templateName)
  const desc = (params.eventDescription || "").trim()
  const orgName = (params.orgName || "").trim()

  // Truncate long descriptions for the OG card (satori doesn't wrap text
  // automatically — we truncate to ~160 chars to keep the layout clean).
  const shortDesc = desc.length > 160 ? desc.slice(0, 157).trimEnd() + "…" : desc

  const svg = await satori(
    <div
      style={{
        width: W,
        height: H,
        background: p.bg,
        display: "flex",
        flexDirection: "column",
        padding: "48px 56px",
        fontFamily: "DejaVu Sans",
        color: p.text,
        position: "relative",
        border: `4px solid ${p.border}`,
        boxSizing: "border-box",
      }}
    >
      {/* Top ribbon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "16px",
          fontWeight: 700,
          color: p.accent,
          letterSpacing: "2px",
          textTransform: "uppercase",
        }}
      >
        <span style={{ fontSize: "24px" }}>🎓</span>
        <span>Certificate of Participation</span>
      </div>

      {/* Recipient name (hero) */}
      <div
        style={{
          marginTop: "28px",
          fontSize: "56px",
          fontWeight: 700,
          lineHeight: 1.1,
          color: p.text,
        }}
      >
        {params.recipientName}
      </div>

      {/* "has successfully completed" */}
      <div
        style={{
          marginTop: "12px",
          fontSize: "20px",
          color: p.muted,
        }}
      >
        has successfully completed
      </div>

      {/* Event name */}
      <div
        style={{
          marginTop: "8px",
          fontSize: "32px",
          fontWeight: 700,
          color: p.accent,
          lineHeight: 1.2,
        }}
      >
        {params.eventName}
      </div>

      {/* Event description (italic, muted) */}
      {shortDesc && (
        <div
          style={{
            marginTop: "12px",
            fontSize: "18px",
            fontStyle: "italic",
            color: p.muted,
            lineHeight: 1.4,
            maxWidth: "920px",
          }}
        >
          {shortDesc}
        </div>
      )}

      {/* Bottom row: org name (left) + cert number + date (right) */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderTop: `1px solid ${p.border}`,
          paddingTop: "20px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {orgName && (
            <div style={{ fontSize: "20px", fontWeight: 700, color: p.text }}>
              {orgName}
            </div>
          )}
          {orgName && (
            <div style={{ fontSize: "14px", color: p.muted, textTransform: "uppercase", letterSpacing: "1px" }}>
              Organization
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", textAlign: "right" }}>
          <div style={{ fontSize: "14px", color: p.muted, textTransform: "uppercase", letterSpacing: "1px" }}>
            Certificate No.
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: p.text, fontFamily: "DejaVu Sans Mono, monospace" }}>
            {params.certificateNumber}
          </div>
          <div style={{ fontSize: "14px", color: p.muted }}>
            Issued on {fmtDate(params.issuedAt)}
          </div>
        </div>
      </div>
    </div>,
    {
      width: W,
      height: H,
      fonts,
    }
  )

  // Convert SVG → PNG via resvg
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    background: p.bg,
  })
  return resvg.render().asPng()
}

/**
 * Fetch the certificate + event + org data from the DB by verification token,
 * then render the OG image. Returns null if the cert doesn't exist.
 */
export async function renderCertOgByToken(token: string): Promise<Buffer | null> {
  const cert = await db.certificate.findUnique({
    where: { verificationToken: token },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          description: true,
          certOrgName: true,
          certTemplate: true,
          organizationId: true,
        },
      },
    },
  })

  if (!cert) return null

  let orgName: string | null = cert.event?.certOrgName ?? null
  if (!orgName && cert.event?.organizationId) {
    const org = await db.organization.findUnique({
      where: { id: cert.event.organizationId },
      select: { name: true },
    })
    if (org) orgName = org.name
  }

  return renderCertOgImage({
    recipientName: cert.recipientName,
    eventName: cert.event?.title ?? "Assessment",
    eventDescription: cert.event?.description ?? null,
    orgName,
    certificateNumber: cert.certificateNumber,
    issuedAt: cert.issuedAt.toISOString(),
    templateName: cert.template,
  })
}
