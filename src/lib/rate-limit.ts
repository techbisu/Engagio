/**
 * Lightweight rate limiting for sensitive endpoints.
 *
 * In-memory implementation (works for single-instance dev). For production
 * on Vercel (serverless, multiple instances), use Upstash Redis:
 *
 *   import { Ratelimit } from "@upstash/ratelimit"
 *   import { Redis } from "@upstash/redis"
 *
 * For MVP, this in-memory limiter provides basic protection.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a key (e.g. `login:${ip}` or `signup:${ip}`).
 *
 *   const rl = rateLimit(`login:${ip}`, 10, 60_000) // 10 attempts per 60s
 *   if (!rl.allowed) return 429 { error: "Too many attempts. Try again later." }
 */
export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // First attempt or window expired
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    }
    store.set(key, newEntry)
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt: newEntry.resetAt,
    }
  }

  // Within the window
  if (entry.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  entry.count++
  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Get client IP from request headers (Vercel-aware).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  return real || "unknown"
}

/**
 * Standard rate limits for common endpoints.
 */
export const RATE_LIMITS = {
  LOGIN: { maxAttempts: 10, windowMs: 60_000 }, // 10/min
  SIGNUP: { maxAttempts: 5, windowMs: 60_000 }, // 5/min
  ORG_CREATE: { maxAttempts: 5, windowMs: 60_000 },
  INVITE: { maxAttempts: 20, windowMs: 60_000 },
  PUBLIC_REGISTRATION: { maxAttempts: 10, windowMs: 60_000 },
  SHARE_GENERATE: { maxAttempts: 30, windowMs: 60_000 },
  CERT_VERIFY: { maxAttempts: 60, windowMs: 60_000 },
} as const
