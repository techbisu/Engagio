import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/seo";
import { db } from "@/lib/db";

/**
 * Next.js 16 dynamic sitemap — auto-generates `/sitemap.xml`.
 *
 * Includes:
 *   - Landing page (/) + marketing pages
 *   - Public org landing pages (/org/[slug]) — for active organizations
 *   - Public event landing pages (/org/[slug]/event/[eventSlug]) — for active events with slugs
 *
 * Token-gated routes (quiz, verify, share, gate) are excluded (noindex).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicOrigin();
  const now = new Date();

  const marketingPages = ["/about", "/privacy", "/terms", "/contact", "/pricing"];

  // Fetch all active organizations with their slug for public org landing pages.
  let orgEntries: MetadataRoute.Sitemap = [];
  let eventEntries: MetadataRoute.Sitemap = [];
  try {
    const orgs = await db.organization.findMany({
      where: { status: "ACTIVE", slug: { not: "default" } },
      select: { slug: true, updatedAt: true },
    });
    orgEntries = orgs.map((org) => ({
      url: `${origin}/org/${org.slug}`,
      lastModified: org.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    // Fetch all active events with slugs + their org slug for public event landing pages.
    const events = await db.event.findMany({
      where: { isActive: true, slug: { not: null } },
      select: {
        slug: true,
        updatedAt: true,
        organization: { select: { slug: true } },
      },
    });
    eventEntries = events
      .filter((e) => e.slug && e.organization?.slug)
      .map((e) => ({
        url: `${origin}/org/${e.organization!.slug}/event/${e.slug}`,
        lastModified: e.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
  } catch {
    // If DB is unavailable during build, skip org/event entries.
  }

  return [
    {
      url: `${origin}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...marketingPages.map((path) => ({
      url: `${origin}${path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...orgEntries,
    ...eventEntries,
  ];
}
