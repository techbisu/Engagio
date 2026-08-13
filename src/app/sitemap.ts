import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/seo";

/**
 * Next.js 16 dynamic sitemap — auto-generates `/sitemap.xml`.
 *
 * Reference: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 *
 * Engagio's public surface is intentionally narrow:
 *
 *   - The landing page (/) — fully public, indexed.
 *   - Marketing pages (/about, /privacy, /terms, /contact, /pricing) —
 *     fully public, indexed.
 *   - Event pages (/event/[slug]) — require auth to take the quiz, so they
 *     are not eligible for indexing (and the quiz deep-link itself is
 *     disallowed in robots.txt). We do not enumerate them here.
 *   - Certificate verification (/verify/[token]) — token-gated, noindex.
 *   - Public share pages (/share/[token]) — noindex per spec.
 *
 * As the platform grows to host truly public event landing pages (e.g.
 * public marketing pages per event), this file should be extended to
 * query `db.event.findMany({ where: { isActive: true, isPublic: true } })`
 * and append one entry per event.
 *
 * For now: emit entries for the landing page + marketing pages so crawlers
 * can discover the canonical origin and follow internal links.
 *
 * Updated during the Phase 1 routing migration to use the new file-based
 * routes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicOrigin();
  const now = new Date();

  const marketingPages = ["/about", "/privacy", "/terms", "/contact", "/pricing"];

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
  ];
}
