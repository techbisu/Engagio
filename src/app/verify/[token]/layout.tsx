import type { Metadata } from "next"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { publicUrl as publicUrlFallback } from "@/lib/seo"

/**
 * Resolve the current request's origin from the `x-forwarded-host` (Vercel
 * proxy) or `host` headers. Falls back to the configured publicUrl() when
 * headers are unavailable (e.g. during static generation).
 *
 * IMPORTANT: social crawlers (LinkedIn, Facebook, X, WhatsApp) fetch the
 * og:image URL. If the URL points to a different domain than the site the
 * user is on (e.g. engagio.app instead of ips2026.dosedailynews.com), the
 * crawler can't fetch it and the preview shows nothing. We MUST build the
 * og:image URL from the actual request host so it's reachable.
 */
async function resolveOrigin(): Promise<string> {
  try {
    const h = await headers()
    const host =
      h.get("x-forwarded-host") ||
      h.get("host") ||
      ""
    const proto = h.get("x-forwarded-proto") || "https"
    if (host) return `${proto}://${host}`
  } catch {
    // headers() not available (build time) — fall through
  }
  return publicUrlFallback("")
}

/**
 * /verify/[token] metadata.
 *
 * The page.tsx is a client component (uses useRouter), so we export
 * generateMetadata from this server-component layout. Fetches the
 * certificate + event + recipient from the DB so social crawlers
 * (LinkedIn, Facebook, X, WhatsApp) see the correct og:title, og:description,
 * and og:image (rendered by /api/og/cert/[token]).
 *
 * This is what makes the shared link preview show the certificate image +
 * recipient name + event title instead of the generic Engagio brand card.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const origin = await resolveOrigin()

  const cert = await db.certificate.findUnique({
    where: { verificationToken: token },
    select: {
      id: true,
      recipientName: true,
      certificateNumber: true,
      verificationToken: true,
      certificateUrl: true,
      issuedAt: true,
      template: true,
      event: {
        select: {
          id: true,
          title: true,
          description: true,
          certOrgName: true,
          organizationId: true,
        },
      },
    },
  })

  // Fallback: cert not found → generic metadata (the page will show
  // "Certificate Not Found" client-side). Still return an OG card so the
  // social preview isn't the generic brand card.
  if (!cert) {
    return {
      title: "Certificate Verification — Engagio",
      description: "Verify the authenticity of a certificate issued on Engagio.",
      openGraph: {
        title: "Certificate Verification — Engagio",
        description: "Verify the authenticity of a certificate issued on Engagio.",
        siteName: "Engagio",
        type: "website",
        url: `${origin}/verify/${token}`,
      },
      twitter: {
        card: "summary",
        title: "Certificate Verification — Engagio",
        description: "Verify the authenticity of a certificate issued on Engagio.",
      },
    }
  }

  let orgName: string | null = cert.event?.certOrgName ?? null
  if (!orgName && cert.event?.organizationId) {
    const org = await db.organization.findUnique({
      where: { id: cert.event.organizationId },
      select: { name: true },
    })
    if (org) orgName = org.name
  }

  const eventName = cert.event?.title ?? "Assessment"
  const ogTitle = `${cert.recipientName} earned a Certificate of Participation`
  const ogDescription = `${cert.recipientName} successfully completed ${eventName}${orgName ? ` organized by ${orgName}` : ""}. Verify the authenticity of this certificate on Engagio.`

  // Use the Cloudinary URL (uploaded by the client after canvas rendering)
  // as the og:image. This is a real CDN URL that social crawlers can fetch.
  // Falls back to the server-side /api/og/cert/[token] endpoint if the cert
  // PNG hasn't been uploaded to Cloudinary yet (e.g., the participant hasn't
  // viewed the cert page yet).
  const ogImageUrl = cert.certificateUrl || `${origin}/api/og/cert/${token}`
  const pageUrl = `${origin}/verify/${token}`

  return {
    title: `${cert.recipientName}'s Certificate — Engagio`,
    description: ogDescription,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      siteName: "Engagio",
      type: "website",
      url: pageUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `Certificate for ${cert.recipientName}: ${eventName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [ogImageUrl],
    },
  }
}

export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
