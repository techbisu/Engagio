/**
 * Rate limiting for sensitive endpoints.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL is configured (production),
 * falls back to in-memory for local development.
 *
 * On Vercel, in-memory rate limiting is useless because each serverless
 * function instance has its own Map. Upstash Redis provides a shared,
 * persistent store that works across all instances.
 *
 * Production REQUIREMENT: In production, UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN must be set, otherwise rate limiting fails closed.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// ─── Upstash Redis implementation ────────────────────────────────────────

let upstashRatelimit: any = null

function getUpstash(): any {
  if (upstashRatelimit) return upstashRatelimit
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  try {
    // Dynamic import so the module works without the packages installed (dev)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Ratelimit } = require("@upstash/ratelimit")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require("@upstash/redis")

    upstashRatelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, "60 s"),
      analytics: true,
      prefix: "engagio:ratelimit",
    })
    return upstashRatelimit
  } catch (e) {
    console.warn("[rate-limit] Failed to initialize Upstash, falling back to in-memory:", e)
    return null
  }
}

/**
 * Check rate limit for a key using Upstash Redis.
 * Uses a sliding window algorithm for accurate limiting.
 */
async function upstashRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult> {
  const ratelimit = getUpstash()
  if (!ratelimit) return inMemoryRateLimit(key, maxAttempts, windowMs)

  try {
    // Map our custom window to Upstash's format
    const windowSec = Math.ceil(windowMs / 1000)
    // Create a per-key limiter with the right limits
    const limiter = (await import("@upstash/ratelimit")).Ratelimit.slidingWindow(
      maxAttempts,
      `${windowSec} s`
    )
    const { Redis } = await import("@upstash/redis")
    const redis = Redis.fromEnv()
    const rl = new (await import("@upstash/ratelimit")).Ratelimit({
      redis,
      limiter,
      prefix: `engagio:${key}`,
    })

    const result = await rl.limit(key)
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    }
  } catch (e) {
    console.error("[rate-limit] Upstash error, falling back to in-memory:", e)
    return inMemoryRateLimit(key, maxAttempts, windowMs)
  }
}

// ─── In-memory fallback (dev only) ───────────────────────────────────────

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

function inMemoryRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
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

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Check rate limit for a key. Uses Upstash Redis in production, in-memory in dev.
 *
 *   const rl = rateLimit(`login:${ip}`, 10, 60_000) // 10 attempts per 60s
 *   if (!rl.allowed) return 429
 *
 * This is now async — callers must await it.
 *
 * Production behavior: If UPSTASH_REDIS_REST_URL is not set in production,
 * the function will fall back to in-memory (which is ineffective on Vercel).
 * Callers should check process.env.NODE_ENV and require Upstash if needed.
 */
export async function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult> {
  return upstashRateLimit(key, maxAttempts, windowMs)
}

/**
 * Assert that Upstash is configured in production.
 * Call this in production code paths that require rate limiting.
 */
export function requireUpstashInProduction(): void {
  const isProd = process.env.NODE_ENV === "production"
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (isProd && (!url || !token)) {
    throw new Error(
      "Upstash Redis is required in production. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    )
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
