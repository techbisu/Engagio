import { NextResponse, type NextRequest } from "next/server"

/**
 * Engagio middleware — hostname-based organization resolution, security
 * headers, and Phase 1 legacy URL redirects.
 *
 * Responsibilities:
 *  1. 301-redirect legacy query-param URLs (?view=, ?quiz=, ?event=, ?org=,
 *    ?verify=, ?share=, ?invite=, ?activity=, ?live=) to their new
 *    file-based App Router routes. This keeps all old shared links /
 *    bookmarks / Google OAuth callbackUrls working.
 *  2. Extract the hostname from the request. If it's a subdomain
 *    ({slug}.engagio.app) or custom domain → set the `x-engagio-org-host`
 *    header so API routes can resolve the org.
 *  3. Add security headers to all responses.
 *
 * Note: The actual org DB lookup happens in the API routes / tenant context
 * helpers (to avoid a DB hit in middleware on every request). Middleware
 * just extracts the hostname + passes it along.
 */

const BASE_DOMAIN = process.env.BASE_DOMAIN || "engagio.app"

// Security headers applied to all responses
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
}

/**
 * Legacy `?view=VALUE` → new route path. Returns null if the value doesn't
 * map to a known route (in which case we leave the URL alone).
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
    // org-dashboard / org-settings / accept-invitation / superadmin-security
    // are sub-views of authed routes — they don't have dedicated Phase 1
    // file routes. Drop the param and let the destination route handle
    // internal navigation. (org-settings etc. will be promoted to file
    // routes in a later phase.)
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
 * Build a 301 redirect response that preserves all query params except the
 * one we're consuming.
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
    // Copy over all params we didn't consume.
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

export function middleware(request: NextRequest) {
  const url = new URL(request.url)

  // ─── Phase 1 legacy URL redirects ────────────────────────────────────
  // Order matters: token-style deep links (?verify=, ?share=, ?invite=) win
  // over ?view=, then quiz/event/org/activity/live follow.
  const verify = url.searchParams.get("verify")
  const share = url.searchParams.get("share")
  const invite = url.searchParams.get("invite")
  const quiz = url.searchParams.get("quiz")
  const eventSlug = url.searchParams.get("event")
  const orgSlug = url.searchParams.get("org")
  const activitySlug = url.searchParams.get("activity")
  const live = url.searchParams.get("live")
  const view = url.searchParams.get("view")

  // Only redirect from the bare landing path (`/`) — if the user is on a
  // sub-path with these params, we don't want to interfere. Also skip if
  // the request is for /api/* (API routes are separate).
  const isLandingPath = url.pathname === "/"
  const isApi = url.pathname.startsWith("/api/")

  if (isLandingPath && !isApi) {
    if (verify) {
      return buildRedirect(request, `/verify/${encodeURIComponent(verify)}`, ["verify"], false)
    }
    if (share) {
      return buildRedirect(request, `/share/${encodeURIComponent(share)}`, ["share"], false)
    }
    if (invite) {
      return buildRedirect(request, `/invite/${encodeURIComponent(invite)}`, ["invite"], false)
    }
    const gate = url.searchParams.get("gate")
    if (gate) {
      return buildRedirect(request, `/gate/${encodeURIComponent(gate)}`, ["gate"], false)
    }
    if (quiz) {
      return buildRedirect(request, `/quiz/${encodeURIComponent(quiz)}`, ["quiz"], false)
    }
    if (eventSlug) {
      return buildRedirect(request, `/event/${encodeURIComponent(eventSlug)}`, ["event"], false)
    }
    if (orgSlug) {
      return buildRedirect(request, `/org/${encodeURIComponent(orgSlug)}`, ["org"], false)
    }
    if (activitySlug) {
      return buildRedirect(
        request,
        `/dashboard?sub=activity&activity=${encodeURIComponent(activitySlug)}`,
        ["activity"],
        false,
      )
    }
    if (live) {
      return buildRedirect(request, `/live/${encodeURIComponent(live)}`, ["live"], false)
    }
    if (view) {
      const target = routeForView(view)
      if (target) {
        // Preserve other query params (e.g. ?tab=events for admin sub-tabs)
        // and only consume the legacy `view` param.
        return buildRedirect(request, target, ["view"], true)
      }
    }
  }

  // ─── Hostname-based org resolution + security headers ────────────────
  const hostname = request.headers.get("host") || ""
  const cleanHost = hostname.toLowerCase().replace(/^www\./, "")

  // Create the response
  const response = NextResponse.next()

  // Add security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }

  // If this is a subdomain or custom domain (not the base domain), pass
  // the hostname to downstream API routes via a header.
  if (cleanHost && cleanHost !== BASE_DOMAIN && !cleanHost.startsWith("localhost")) {
    response.headers.set("x-engagio-org-host", cleanHost)
    // Also set it on the request so server components can read it
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-engagio-org-host", cleanHost)
    const modifiedRequest = new NextResponse(request.body, {
      headers: requestHeaders,
    })
    // Copy security headers to the modified request response
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      modifiedRequest.headers.set(key, value)
    }
  }

  return response
}

export const config = {
  // Run on all routes except static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt).*)"],
}
