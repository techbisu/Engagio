import type { Metadata } from "next"
import { db } from "@/lib/db"
import { publicUrl } from "@/lib/seo"

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

  const cert = await db.certificate.findUnique({
    where: { verificationToken: token },
    include: {
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
        url: publicUrl(`/verify/${token}`),
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
  const ogImageUrl = publicUrl(`/api/og/cert/${token}`)
  const pageUrl = publicUrl(`/verify/${token}`)

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
