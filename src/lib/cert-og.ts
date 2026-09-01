/**
 * Server-side certificate OG image renderer.
 *
 * Generates a PNG (1200×630) suitable for Open Graph / Twitter card previews
 * when a certificate verification URL is shared on LinkedIn, Facebook, X,
 * WhatsApp, etc.
 *
 * APPROACH: Build an SVG string manually (no Satori/JSX needed), then convert
 * to PNG using sharp (which IS in serverExternalPackages and works on Vercel).
 * This avoids the next/og + Satori runtime issues that were causing 500 errors
 * on Vercel's serverless environment.
 */

import sharp from "sharp"
import { db } from "@/lib/db"

const W = 1200
const H = 630

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
      return { bg: "#ffffff", border: "#065f46", accent: "#065f46", text: "#0f172a", muted: "#475569" }
    case "elegant":
      return { bg: "#fefce8", border: "#92400e", accent: "#92400e", text: "#1c1917", muted: "#78716c" }
    case "bold":
      return { bg: "#0f172a", border: "#10b981", accent: "#10b981", text: "#ffffff", muted: "#cbd5e1" }
    case "minimal":
      return { bg: "#ffffff", border: "#e2e8f0", accent: "#0f172a", text: "#0f172a", muted: "#94a3b8" }
    case "modern":
    default:
      return { bg: "#ffffff", border: "#065f46", accent: "#065f46", text: "#0f172a", muted: "#64748b" }
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  } catch {
    return new Date(iso).toDateString()
  }
}

/** Escape XML special characters for safe SVG text embedding. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** Truncate text to a max number of characters with ellipsis. */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + "…"
}

/**
 * Build the SVG string for the certificate OG image.
 * Layout (1200×630):
 *   - Outer border (4px) in the template accent color
 *   - Top-left: "🎓 CERTIFICATE OF PARTICIPATION"
 *   - Center: recipient name (large), event name (medium), event description (small, italic)
 *   - Bottom row: org name (left), certificate number + date (right)
 */
function buildSvg(params: CertOgParams): string {
  const p = paletteFor(params.templateName)
  const desc = (params.eventDescription || "").trim()
  const orgName = (params.orgName || "").trim()
  const shortDesc = truncate(desc, 160)

  const recipientName = escapeXml(params.recipientName)
  const eventName = escapeXml(truncate(params.eventName, 60))
  const safeDesc = escapeXml(shortDesc)
  const safeOrgName = escapeXml(orgName)
  const safeCertNumber = escapeXml(params.certificateNumber)
  const safeDate = escapeXml(fmtDate(params.issuedAt))

  // Calculate Y positions for the description (it may span 2 lines)
  let descY1 = 360
  let descY2 = 385
  const hasDesc = shortDesc.length > 0

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="${p.bg}"/>
  <!-- Outer border -->
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="${p.border}" stroke-width="4" rx="8"/>

  <!-- Top ribbon: 🎓 CERTIFICATE OF PARTICIPATION -->
  <text x="56" y="80" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="${p.accent}" letter-spacing="2">🎓 CERTIFICATE OF PARTICIPATION</text>

  <!-- Recipient name (hero) -->
  <text x="56" y="170" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="700" fill="${p.text}">${recipientName}</text>

  <!-- "has successfully completed" -->
  <text x="56" y="210" font-family="system-ui, -apple-system, sans-serif" font-size="22" fill="${p.muted}">has successfully completed</text>

  <!-- Event name -->
  <text x="56" y="265" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="700" fill="${p.accent}">${eventName}</text>

  <!-- Event description (italic, muted) -->
  ${hasDesc ? `<text x="56" y="${descY1}" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-style="italic" fill="${p.muted}">${safeDesc}</text>` : ""}

  <!-- Bottom separator line -->
  <line x1="56" y1="${H - 110}" x2="${W - 56}" y2="${H - 110}" stroke="${p.border}" stroke-width="1"/>

  <!-- Org name (bottom-left) -->
  ${orgName ? `<text x="56" y="${H - 75}" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" fill="${p.text}">${safeOrgName}</text>` : ""}
  ${orgName ? `<text x="56" y="${H - 52}" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="${p.muted}" letter-spacing="1">ORGANIZATION</text>` : ""}

  <!-- Certificate number + date (bottom-right) -->
  <text x="${W - 56}" y="${H - 75}" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="${p.muted}" letter-spacing="1">CERTIFICATE NO.</text>
  <text x="${W - 56}" y="${H - 50}" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" fill="${p.text}">${safeCertNumber}</text>
  <text x="${W - 56}" y="${H - 25}" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="${p.muted}">Issued on ${safeDate}</text>
</svg>`
}

/**
 * Render the certificate OG image as a PNG Buffer using sharp (SVG → PNG).
 * sharp is in serverExternalPackages and works on Vercel's serverless runtime.
 */
export async function renderCertOgPng(params: CertOgParams): Promise<Buffer> {
  const svg = buildSvg(params)
  const p = paletteFor(params.templateName)
  return sharp(Buffer.from(svg))
    .resize(W, H)
    .png()
    .toBuffer()
}

/**
 * Fetch the certificate + event + org data from the DB by verification token,
 * then render the OG PNG. Returns null if the cert doesn't exist.
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

  return renderCertOgPng({
    recipientName: cert.recipientName,
    eventName: cert.event?.title ?? "Assessment",
    eventDescription: cert.event?.description ?? null,
    orgName,
    certificateNumber: cert.certificateNumber,
    issuedAt: cert.issuedAt.toISOString(),
    templateName: cert.template,
  })
}
