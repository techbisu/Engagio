import type { Metadata } from "next"

/**
 * /privacy metadata.
 *
 * The page.tsx is a client component, so we export metadata from this
 * server-component layout sibling.
 */
export const metadata: Metadata = {
  title: "Privacy Policy — Engagio",
  description:
    "How Engagio collects, uses, and protects your personal information. Read our full privacy policy covering account data, event registrations, payments, and analytics.",
  openGraph: {
    title: "Privacy Policy — Engagio",
    description:
      "How Engagio collects, uses, and protects your personal information.",
    siteName: "Engagio",
    type: "website",
  },
}

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
