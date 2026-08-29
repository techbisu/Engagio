import type { Metadata } from "next"

/**
 * /contact metadata.
 *
 * The page.tsx is a client component (uses useAppNavigate), so we export
 * metadata from this server-component layout sibling.
 */
export const metadata: Metadata = {
  title: "Contact — Engagio",
  description:
    "Get in touch with the Engagio team for sales, support, partnerships, or product questions. We typically respond within one business day.",
  openGraph: {
    title: "Contact — Engagio",
    description:
      "Sales, support, partnerships, and product questions — reach the Engagio team here.",
    siteName: "Engagio",
    type: "website",
  },
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
