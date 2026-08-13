import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/seo";

/**
 * Next.js 16 dynamic robots.txt — auto-generates `/robots.txt`.
 *
 * Reference: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 *
 * Engagio's only truly public surface is the landing page (`/`) and the
 * marketing pages (/about, /pricing, etc.). Every other URL is either:
 *
 *   - An API route (/api/...) — never index.
 *   - An auth-gated dashboard (/dashboard, /admin, /superadmin/login) —
 *     requires auth, noindex.
 *   - A token-gated deep link (/verify/[token], /share/[token],
 *     /invite/[token]) — private per-resource, noindex.
 *   - A deep link to a private resource (/quiz/[slug], /event/[slug],
 *     /org/[slug]) — auth-gated for participation, noindex.
 *
 * We allow the bare landing page + marketing pages so crawlers can follow
 * internal links, and disallow everything else.
 *
 * Updated during the Phase 1 routing migration to use the new file-based
 * routes.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = publicOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/admin",
        "/superadmin/",
        "/login",
        "/org-register",
        "/no-org",
        "/verify/",
        "/share/",
        "/invite/",
        "/quiz/",
        "/event/",
        "/org/",
        "/live/",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
