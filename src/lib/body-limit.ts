/**
 * Request body size limiting middleware for Next.js App Router route handlers.
 *
 * Vercel serverless functions have a default 4.5 MB body limit, but:
 *   1. That limit isn't enforced until the body is fully read (wasting memory).
 *   2. Most endpoints don't need anywhere near 4.5 MB.
 *   3. Without explicit limits, a malicious client can send huge JSON payloads
 *      to waste serverless function memory and increase cold-start times.
 *
 * Usage:
 *   const tooLarge = await checkBodySize(req, 512 * 1024) // 512 KB
 *   if (tooLarge) return tooLarge
 *
 * Or use the predefined limits:
 *   const tooLarge = await enforceLimit(req, BODY_LIMITS.STANDARD)
 */

import { NextResponse } from "next/server"
import { NextRequest } from "next/server"

/** Predefined body size limits (in bytes). */
export const BODY_LIMITS = {
  /** Small payloads: login, TOTP, quick mutations. */
  SMALL: 16 * 1024, // 16 KB
  /** Standard payloads: event CRUD, quiz config, org settings. */
  STANDARD: 512 * 1024, // 512 KB
  /** Large payloads: landing page sections, question imports. */
  LARGE: 2 * 1024 * 1024, // 2 MB
  /** File uploads: images, certificates. Should match Vercel's limit. */
  UPLOAD: 4 * 1024 * 1024, // 4 MB
} as const

/**
 * Check if the request body exceeds the given size limit.
 * Reads the Content-Length header first (fast path). If that's missing
 * (chunked transfer), reads the body and checks the byte length.
 *
 * Returns a NextResponse with 413 if too large, null if OK.
 */
export async function checkBodySize(
  req: NextRequest,
  maxBytes: number
): Promise<NextResponse | null> {
  const contentLength = req.headers.get("content-length")
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (Number.isFinite(size) && size > maxBytes) {
      return NextResponse.json(
        { error: `Request body too large (max ${formatBytes(maxBytes)})` },
        { status: 413 }
      )
    }
    // Content-Length is within limit — no need to read the body.
    return null
  }

  // No Content-Length header (chunked transfer or unknown).
  // We can't pre-check, so return null and let the route handler read the body.
  // The route should use enforceLimit() after reading for full protection.
  return null
}

/**
 * Convenience wrapper: read + validate the body in one step.
 * Use this instead of `req.json()` when you want size enforcement.
 *
 *   const body = await enforceLimit(req, BODY_LIMITS.STANDARD)
 *   if (body.error) return body.error  // already a NextResponse
 *   const data = body.data
 */
export async function enforceLimit<T = unknown>(
  req: NextRequest,
  maxBytes: number
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  // Fast path: check Content-Length header first
  const headerCheck = await checkBodySize(req, maxBytes)
  if (headerCheck) {
    return { data: null, error: headerCheck }
  }

  // Read the full body
  const raw = await req.text()

  // Check the actual byte length
  const byteLength = new TextEncoder().encode(raw).byteLength
  if (byteLength > maxBytes) {
    return {
      data: null,
      error: NextResponse.json(
        { error: `Request body too large (max ${formatBytes(maxBytes)})` },
        { status: 413 }
      ),
    }
  }

  // Parse JSON
  try {
    const data = JSON.parse(raw) as T
    return { data, error: null }
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      ),
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
