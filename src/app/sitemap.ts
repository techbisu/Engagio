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
 *   - Event pages (?quiz=SLUG) — require auth to take the quiz, so they
 *     are not eligible for indexing (and the quiz deep-link itself is
 *     disallowed in robots.txt). We do not enumerate them here.
 *   - Certificate verification (?verify=TOKEN) — token-gated, noindex.
 *   - Public share pages (?share=TOKEN) — noindex per spec.
 *
 * As the platform grows to host truly public event landing pages (e.g.
 * public marketing pages per event), this file should be extended to
 * query `db.event.findMany({ where: { isActive: true, isPublic: true } })`
 * and append one entry per event.
 *
 * For now: emit a single entry — the landing page — so crawlers can still
 * discover the canonical origin and follow internal links.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = publicOrigin();
  const now = new Date();

  return [
    {
      url: `${origin}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];
}
