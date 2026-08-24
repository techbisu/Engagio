/**
 * Canonical URL resolver — the single source of truth for public URLs.
 *
 * Every public-facing URL (event links, registration, activity, certificate
 * verification, share links, QR codes, emails) must go through this module
 * so that custom domains are respected.
 *
 * If the org has an ACTIVE custom domain:
 *   getPublicBaseUrl(org) → "https://events.abcmedical.org"
 *
 * Otherwise:
 *   getPublicBaseUrl(org) → "https://abc-medical.engagio.app"
 *
 * (The base domain is configurable via BASE_DOMAIN env var.)
 */

import { randomBytes } from "crypto"
import { db } from "./db"

const BASE_DOMAIN = process.env.BASE_DOMAIN || "engagio.app"
const USE_HTTPS = process.env.NODE_ENV === "production"

export function protocol(): string {
  return USE_HTTPS ? "https" : "http"
}

/**
 * Get the primary public base URL for an organization.
 * Checks for an active custom domain first, falls back to subdomain.
 *
 *   const url = await getPublicBaseUrl(orgId)
 *   // → "https://events.abcmedical.org" or "https://abc-medical.engagio.app"
 */
export async function getPublicBaseUrl(orgId: string): Promise<string> {
  // Check for active custom domain
  const customDomain = await db.organizationDomain.findFirst({
    where: {
      organizationId: orgId,
      type: "CUSTOM_DOMAIN",
      status: "ACTIVE",
    },
    orderBy: { isPrimary: "desc" },
  })

  if (customDomain) {
    return `${protocol()}://${customDomain.domain}`
  }

  // Fall back to subdomain
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { slug: true },
  })

  if (org) {
    return `${protocol()}://${org.slug}.${BASE_DOMAIN}`
  }

  // Final fallback: the base app URL
  return `${protocol()}://${BASE_DOMAIN}`
}

/**
 * Build a full public URL for a path, respecting the org's custom domain.
 *
 *   await buildPublicUrl(orgId, `/event/medical-summit`)
 *   // → "https://events.abcmedical.org/event/medical-summit"
 */
export async function buildPublicUrl(
  orgId: string,
  path: string
): Promise<string> {
  const base = await getPublicBaseUrl(orgId)
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  return `${base}${cleanPath}`
}

/**
 * Resolve an organization from a hostname.
 * Used by middleware for subdomain/custom-domain routing.
 *
 *   resolveOrgFromHost("abc-medical.engagio.app")
 *   // → { organizationId, slug, isCustomDomain }
 *
 *   resolveOrgFromHost("events.abcmedical.org")
 *   // → { organizationId, slug, isCustomDomain: true }
 *
 *   resolveOrgFromHost("engagio.app")
 *   // → null (no org — this is the platform host)
 */
export async function resolveOrgFromHost(
  hostname: string
): Promise<{
  organizationId: string
  slug: string
  isCustomDomain: boolean
} | null> {
  const host = hostname.toLowerCase().replace(/^www\./, "")

  // Case 1: base domain → no org (platform host)
  if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) {
    return null
  }

  // Case 2: subdomain ({slug}.engagio.app)
  if (host.endsWith(`.${BASE_DOMAIN}`)) {
    const slug = host.slice(0, -(`.${BASE_DOMAIN}`.length))
    if (!slug || slug === "www") return null

    const org = await db.organization.findUnique({
      where: { slug },
      select: { id: true, slug: true, status: true },
    })

    if (org && org.status === "ACTIVE") {
      return { organizationId: org.id, slug: org.slug, isCustomDomain: false }
    }
    return null
  }

  // Case 3: custom domain — look up in OrganizationDomain table
  const domain = await db.organizationDomain.findUnique({
    where: { domain: host },
    include: {
      organization: {
        select: { id: true, slug: true, status: true },
      },
    },
  })

  if (
    domain &&
    domain.status === "ACTIVE" &&
    domain.organization.status === "ACTIVE"
  ) {
    return {
      organizationId: domain.organization.id,
      slug: domain.organization.slug,
      isCustomDomain: true,
    }
  }

  return null
}

/**
 * Generate the DNS verification token for a custom domain.
 * Format: "engagio-verify-{random}"
 * Security: Uses crypto.randomBytes() (not Math.random).
 */
export function generateDomainVerificationToken(): string {
  const random = randomBytes(8).toString("hex")
  return `engagio-verify-${random}`
}

/**
 * DNS instructions for a custom domain.
 * Returns the CNAME record the customer needs to add.
 */
export function getDnsInstructions(
  domain: string,
  verificationToken: string
): {
  recordType: "CNAME" | "TXT"
  name: string
  value: string
  instructions: string
} {
  // For the root domain verification, use a TXT record.
  // For the actual CNAME, the customer points their domain to cname.vercel-dns.com
  // (Vercel's wildcard CNAME target).

  // Extract the subdomain part if it's a subdomain (e.g. "events" from "events.abcmedical.org")
  const parts = domain.split(".")
  const isSubdomain = parts.length > 2
  const subdomainPart = isSubdomain ? parts[0] : ""

  return {
    recordType: "CNAME",
    name: subdomainPart || "@",
    value: `cname.vercel-dns.com`,
    instructions: `Add a CNAME record in your DNS provider:\n  Name: ${subdomainPart || "@"}\n  Target: cname.vercel-dns.com\n\nThen add a TXT record for verification:\n  Name: _engagio-verify.${subdomainPart || "@"}\n  Value: ${verificationToken}`,
  }
}
