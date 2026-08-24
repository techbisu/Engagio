/**
 * Database client — Prisma with connection pooling for Vercel serverless.
 *
 * Connection pooling strategy for 200+ concurrent users:
 *
 * 1. PgBouncer mode (PostgreSQL): append ?pgbouncer=true to DATABASE_URL
 *    so Prisma uses PgBouncer's server-side connection pooling instead of
 *    opening a new TCP connection per function invocation. Neon/Supabase
 *    provide this automatically.
 *
 * 2. Global singleton: in production, each serverless function instance
 *    reuses a single PrismaClient. Without this, every cold start would
 *    open a new connection pool.
 *
 * 3. Connection limits: connection_limit prevents a single function from
 *    exhausting the pool. With 10 concurrent Vercel functions on Hobby,
 *    each pool gets connection_limit connections. Keep it low (1-2) since
 *    queries are fast and PgBouncer handles queueing.
 *
 * 4. Pool timeout: if all connections are busy, wait up to 10s before
 *    failing. This prevents cascading failures during traffic spikes.
 *
 * For 200 concurrent exam takers:
 * - Quiz is mostly client-side (question rendering, timer, UI)
 * - Server calls: 1x start, 1x submit, periodic auto-saves (~every 30s)
 * - With PgBouncer, 2-5 connections handle 200 concurrent users easily
 * - Neon Free tier: 24/7 compute, handles 100+ concurrent connections
 */

import { PrismaClient } from '@prisma/client'
import { assertEnv } from './env'

// Fail fast on missing/misconfigured env vars in production (no-op in dev).
assertEnv()

// --- Connection pooling configuration ---

/**
 * Build the DATABASE_URL with connection pooling parameters.
 *
 * For PostgreSQL: adds ?pgbouncer=true (server-side pooling via PgBouncer)
 *                 and connection_limit to cap per-instance pool size.
 * For SQLite: no changes needed (single-file DB, no pooling).
 */
function buildPooledUrl(): string {
  const baseUrl = process.env.DATABASE_URL || ''
  if (!baseUrl) return baseUrl

  // SQLite doesn't support PgBouncer
  if (baseUrl.startsWith('file:')) return baseUrl

  // PostgreSQL — add PgBouncer and connection limits
  const separator = baseUrl.includes('?') ? '&' : '?'
  const isProduction = process.env.NODE_ENV === 'production'

  const params = new URLSearchParams()

  // PgBouncer mode: Neon/Supabase proxy handles connection multiplexing
  if (isProduction) {
    params.set('pgbouncer', 'true')
  }

  // Connection limit: keep low in serverless (each instance has its own pool)
  // 10 concurrent Vercel Hobby functions × 2 connections each = 20 max to DB
  // Neon handles up to 100+ connections, so this is safe.
  const limit = process.env.DB_CONNECTION_LIMIT || (isProduction ? '2' : '5')
  params.set('connection_limit', limit)

  // Pool timeout: max seconds to wait for a connection before failing
  const timeout = process.env.DB_POOL_TIMEOUT || '10'
  params.set('pool_timeout', timeout)

  // Query timeout: kill slow queries after 15s to prevent function timeout
  params.set('connect_timeout', '10')

  return `${baseUrl}${separator}${params.toString()}`
}

// --- PrismaClient singleton ---

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const pooledUrl = buildPooledUrl()

  return new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['error']
      : ['error', 'warn'],
    datasources: pooledUrl ? {
      db: {
        url: pooledUrl,
      },
    } : undefined,
  })
}

// In production (Vercel), each serverless function instance gets one
// PrismaClient that lives for the instance lifetime (minutes, not days).
// In dev, cache on globalThis to survive hot-module reloads.
export const db =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}

// --- Graceful shutdown (dev only) ---
// In production, Vercel kills the process after 10s — no need to drain.
if (process.env.NODE_ENV !== 'production') {
  process.on('beforeExit', async () => {
    await db.$disconnect()
  })
}
