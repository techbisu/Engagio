import { NextResponse, type NextRequest } from "next/server"

/**
 * Engagio middleware — hostname-based organization resolution, security
 * headers, and Phase 1 legacy URL redirects.
 *
 * Responsibilities:
 *  1. 301-redirect legacy query-param URLs to their new file-based routes.
 *  2. Subdomain → org resolution: when a subdomain (slug.engagio.app) is
 *     detected, rewrite the root path to /org/{slug} so the org landing
 *     page renders without query params.
 *  3. Pass the hostname downstream via x-engagio-org-host header so API
 *     routes and server components can resolve the org.
 *  4. Add security headers to all responses.
 */

const BASE_DOMAIN = process.env.BASE_DOMAIN || "engagio.app"

// Security headers applied to all responses
// Match next.config.ts headers for consistency
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
}

/**
 * Legacy `?view=VALUE` → new route path.
 */
function routeForView(view: string | null): string | null {
  if (!view) return null
  switch (view) {
    case "login":
      return "/login"
    case "superadmin":
    case "platform":
      return "/superadmin/login"
    case "org-register":
    case "org-onboarding":
      return "/org-register"
    case "student":
      return "/dashboard"
    case "admin":
      return "/admin"
    case "no-org":
      return "/no-org"
    case "about":
      return "/about"
    case "privacy":
      return "/privacy"
    case "terms":
      return "/terms"
    case "contact":
      return "/contact"
    case "pricing":
      return "/pricing"
    case "org-dashboard":
    case "org-settings":
    case "accept-invitation":
    case "superadmin-security":
      return "/"
    default:
      return null
  }
}

/**
 * Build a 301 redirect response that preserves query params.
 */
function buildRedirect(
  req: NextRequest,
  targetPath: string,
  consumeParams: string[],
  preserveRest: boolean,
) {
  const url = new URL(req.url)
  const target = new URL(targetPath, url.origin)

  if (preserveRest) {
    for (const [k, v] of url.searchParams.entries()) {
      if (!consumeParams.includes(k)) {
        target.searchParams.set(k, v)
      }
    }
  }

  const res = NextResponse.redirect(target, 301)
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value)
  }
  return res
}

/**
 * Apply security headers to a response.
 */
function withSecurityHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value)
  }
  return res
}

/**
 * Extract the org slug from a subdomain or custom domain.
 *
 * - Subdomain: demo-medical.engagio.app → "demo-medical"
 * - Custom domain: events.abcmedical.org → needs DB lookup (handled by tenant.ts)
 * - Base domain: engagio.app → null (no org)
 */
function extractSlugFromSubdomain(host: string): string | null {
  if (host.endsWith(`.${BASE_DOMAIN}`)) {
    const slug = host.slice(0, -(`.${BASE_DOMAIN}`.length))
    if (slug && slug !== "www") return slug
  }
  return null
}

export function middleware(request: NextRequest) {
  const url = new URL(request.url)

  // ─── Phase 1 legacy URL redirects ────────────────────────────────────
  const isLandingPath = url.pathname === "/"
  const isApi = url.pathname.startsWith("/api/")

  if (isLandingPath && !isApi) {
    const verify = url.searchParams.get("verify")
    if (verify) {
      return buildRedirect(request, `/verify/${encodeURIComponent(verify)}`, ["verify"], false)
    }
    const share = url.searchParams.get("share")
    if (share) {
      return buildRedirect(request, `/share/${encodeURIComponent(share)}`, ["share"], false)
    }
    const invite = url.searchParams.get("invite")
    if (invite) {
      return buildRedirect(request, `/invite/${encodeURIComponent(invite)}`, ["invite"], false)
    }
    const gate = url.searchParams.get("gate")
    if (gate) {
      return buildRedirect(request, `/gate/${encodeURIComponent(gate)}`, ["gate"], false)
    }
    const quiz = url.searchParams.get("quiz")
    if (quiz) {
      return buildRedirect(request, `/quiz/${encodeURIComponent(quiz)}`, ["quiz"], false)
    }
    const eventSlug = url.searchParams.get("event")
    if (eventSlug) {
      return buildRedirect(request, `/event/${encodeURIComponent(eventSlug)}`, ["event"], false)
    }
    const orgSlug = url.searchParams.get("org")
    if (orgSlug) {
      return buildRedirect(request, `/org/${encodeURIComponent(orgSlug)}`, ["org"], false)
    }
    const activitySlug = url.searchParams.get("activity")
    if (activitySlug) {
      return buildRedirect(
        request,
        `/dashboard?sub=activity&activity=${encodeURIComponent(activitySlug)}`,
        ["activity"],
        false,
      )
    }
    const live = url.searchParams.get("live")
    if (live) {
      return buildRedirect(request, `/live/${encodeURIComponent(live)}`, ["live"], false)
    }
    const view = url.searchParams.get("view")
    if (view) {
      const target = routeForView(view)
      if (target) {
        return buildRedirect(request, target, ["view"], true)
      }
    }
  }

  // ─── Hostname-based org resolution + security headers ────────────────
  const hostname = request.headers.get("host") || ""
  const cleanHost = hostname.toLowerCase().replace(/^www\./, "")

  // Check if this is a subdomain of the base domain
  const subdomainSlug = extractSlugFromSubdomain(cleanHost)

  if (subdomainSlug) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-engagio-org-host", cleanHost)

    // Rewrite the root path to /org/{slug} so the org landing page renders.
    // The URL in the browser stays as demo-medical.engagio.app/
    // but the server internally serves /org/demo-medical content.
    if (url.pathname === "/") {
      const rewriteUrl = new URL(`/org/${subdomainSlug}`, url.origin)
      const res = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
      return withSecurityHeaders(res)
    }

    // For all other paths on a subdomain, just pass the header through
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    return withSecurityHeaders(res)
  }

  // Custom domain (not a subdomain of BASE_DOMAIN)
  // BUT skip Vercel preview subdomains (*.vercel.app) and localhost —
  // these are deployment previews, not custom org domains.
  if (cleanHost && cleanHost !== BASE_DOMAIN && !cleanHost.startsWith("localhost") && !cleanHost.endsWith(".vercel.app")) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-engagio-org-host", cleanHost)

    if (url.pathname === "/") {
      // Custom domain root — we don't know the slug yet (needs DB lookup).
      // Rewrite to a special route that resolves the org from the hostname.
      const rewriteUrl = new URL(`/org/custom-domain`, url.origin)
      const res = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
      return withSecurityHeaders(res)
    }

    const res = NextResponse.next({ request: { headers: requestHeaders } })
    return withSecurityHeaders(res)
  }

  // Default: no org context, just add security headers
  const response = NextResponse.next()
  return withSecurityHeaders(response)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt).*)"],
}
