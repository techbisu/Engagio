import type { Metadata } from "next"

/**
 * /pricing metadata.
 *
 * The page.tsx is a client component (uses useAppNavigate), so we export
 * metadata from this server-component layout sibling.
 */
export const metadata: Metadata = {
  title: "Pricing — Engagio",
  description:
    "Simple, transparent pricing for Engagio. Choose the plan that fits your events, workshops, and assessments — with registration, live activities, quizzes, results, and certificates included.",
  openGraph: {
    title: "Pricing — Engagio",
    description:
      "Plans for every organization hosting events, workshops, and assessments.",
    siteName: "Engagio",
    type: "website",
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
