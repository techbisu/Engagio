import type { Metadata } from "next"

/**
 * /terms metadata.
 *
 * The page.tsx is a client component, so we export metadata from this
 * server-component layout sibling.
 */
export const metadata: Metadata = {
  title: "Terms of Service — Engagio",
  description:
    "The terms governing your use of Engagio — accounts, event hosting, participant conduct, payments, and acceptable use. Read our full Terms of Service.",
  openGraph: {
    title: "Terms of Service — Engagio",
    description:
      "The terms governing your use of Engagio — accounts, hosting, conduct, and payments.",
    siteName: "Engagio",
    type: "website",
  },
}

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
