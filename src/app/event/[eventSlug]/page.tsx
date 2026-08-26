import { redirect } from "next/navigation"
import { EventRouteClient } from "@/components/public/event-route-client"
import { db } from "@/lib/db"

/**
 * /event/[eventSlug]
 *
 * LEGACY path — 301-redirects to the canonical org-scoped URL
 * /org/[orgSlug]/event/[eventSlug]. Kept for backward compatibility with
 * existing shared links, QR codes, and emails.
 *
 * Resilience: if the DB lookup fails for ANY reason (transient connection
 * error, migration gap, etc.), we fall back to rendering the client-side
 * event page instead of crashing — the client fetches via the public API,
 * so the visitor still gets a working page or a graceful "not found".
 */
export default async function EventLegacyRedirect({
  params,
}: {
  params: Promise<{ eventSlug: string }>
}) {
  const { eventSlug } = await params

  try {
    const event = await db.event.findUnique({
      where: { slug: eventSlug },
      select: {
        slug: true,
        organization: {
          select: { slug: true },
        },
      },
    })

    // Only redirect when both slugs are present and URL-safe.
    if (
      event?.slug &&
      event.organization?.slug &&
      /^[a-z0-9-]+$/i.test(event.organization.slug)
    ) {
      redirect(`/org/${event.organization.slug}/event/${event.slug}`)
    }
  } catch (e) {
    // redirect() throws NEXT_REDIRECT internally — rethrow it so the
    // redirect still happens; only swallow real errors.
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      typeof (e as { digest?: string }).digest === "string" &&
      (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw e
    }
    console.error("[/event/[eventSlug]] lookup failed, falling back to client page:", e)
  }

  // Fallback: render the original client-side event landing experience.
  return <EventRouteClient eventSlug={eventSlug} />
}
