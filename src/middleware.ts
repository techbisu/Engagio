import { NextResponse, type NextRequest } from "next/server"

/**
 * Engagio middleware — hostname-based organization resolution + security headers.
 *
 * 1. Extracts the hostname from the request.
 * 2. If it's a subdomain ({slug}.engagio.app) or custom domain → sets the
 *    `x-engagio-org-host` header so API routes can resolve the org.
 * 3. Adds security headers to all responses.
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

export function middleware(request: NextRequest) {
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
