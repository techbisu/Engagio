import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/seo";

/**
 * Next.js 16 dynamic robots.txt — auto-generates `/robots.txt`.
 *
 * Reference: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 *
 * Engagio's only truly public surface is the landing page (`/`). Every
 * other URL is either:
 *
 *   - An API route (/api/...) — never index.
 *   - A query-string "view" route (?view=admin|student|login|verify) —
 *     requires auth or is a private workflow.
 *   - A deep link to a private resource (?quiz=, ?activity=, ?share=) —
 *     token-gated, noindex.
 *
 * We allow the bare landing page so crawlers can follow internal links,
 * and disallow everything else.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = publicOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/?view=admin",
        "/?view=student",
        "/?view=login",
        "/?view=verify",
        "/?share=",
        "/?activity=",
        "/?quiz=",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
