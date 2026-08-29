import type { Metadata } from "next"
import { db } from "@/lib/db"

/**
 * /org/[orgSlug] metadata.
 *
 * The page.tsx is a client component (uses useAppNavigate, useCurrentUser),
 * so we export metadata from this server-component layout. Uses
 * `generateMetadata` so the title reflects the actual organization name
 * (falls back to the slug if the org can't be loaded).
 *
 * This layout wraps every nested /org/[orgSlug] route (admin, event,
 * participant/dashboard, quiz). Child layouts override the title for
 * their own segment (e.g. event landing sets the event title).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}): Promise<Metadata> {
  const { orgSlug } = await params
  const org = await db.organization.findUnique({
    where: { slug: orgSlug },
    select: { name: true, description: true },
  })

  const name = org?.name ?? orgSlug

  return {
    title: `${name} — Engagio`,
    description:
      org?.description ??
      `Events, workshops, and assessments hosted by ${name} on Engagio.`,
    openGraph: {
      title: `${name} — Engagio`,
      description:
        org?.description ??
        `Events, workshops, and assessments hosted by ${name} on Engagio.`,
      siteName: "Engagio",
      type: "website",
    },
  }
}

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
