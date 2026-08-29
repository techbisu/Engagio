import type { Metadata } from "next"

/**
 * /about metadata.
 *
 * The page.tsx is a client component (uses useAppNavigate), so we export
 * metadata from this server-component layout sibling.
 */
export const metadata: Metadata = {
  title: "About Engagio — Interactive Event & Learning Platform",
  description:
    "Engagio is the all-in-one platform for hosting engaging events, workshops, conferences, training programs, and assessments — with registration, live activities, quizzes, results, and certificates.",
  openGraph: {
    title: "About Engagio — Interactive Event & Learning Platform",
    description:
      "Engage participants, run interactive activities, assess learning, and issue certificates from one platform.",
    siteName: "Engagio",
    type: "website",
  },
}

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
