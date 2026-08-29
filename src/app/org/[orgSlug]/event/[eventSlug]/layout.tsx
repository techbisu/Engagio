import type { Metadata } from "next"
import { db } from "@/lib/db"

/**
 * /org/[orgSlug]/event/[eventSlug] metadata.
 *
 * The page.tsx is a client component (uses useRouter, useAppNavigate),
 * so we export metadata from this server-component layout. Uses
 * `generateMetadata` to fetch the actual event title from the DB so
 * crawlers and link previews show the real event name.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>
}): Promise<Metadata> {
  const { eventSlug } = await params
  const event = await db.event.findUnique({
    where: { slug: eventSlug },
    select: { title: true, description: true, image: true },
  })

  const title = event?.title ?? "Event"
  const description =
    event?.description ?? "Event details and registration on Engagio."

  return {
    title: `${title} — Engagio`,
    description,
    openGraph: {
      title: `${title} — Engagio`,
      description,
      siteName: "Engagio",
      type: "website",
      ...(event?.image ? { images: [{ url: event.image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Engagio`,
      description,
      ...(event?.image ? { images: [event.image] } : {}),
    },
  }
}

export default function EventLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
