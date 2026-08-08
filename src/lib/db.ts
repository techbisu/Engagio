import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Detect when the cached PrismaClient is stale because the Prisma schema
 * was extended (e.g., a new model added) after `prisma generate` ran.
 *
 * In dev (HMR), the `PrismaClient` instance is cached on `globalThis` to
 * survive module reloads. But if a new model was added since the dev server
 * started (e.g., `Certificate` was added after `prisma generate`), the cached
 * instance lacks the new model delegate (`db.certificate`). When detected,
 * we discard the cached instance so a fresh one is created from the
 * newly-generated code.
 */
function isStaleClient(client: PrismaClient | undefined): boolean {
  if (!client) return false
  // `certificate` is a getter on the PrismaClient instance added by the
  // generator. If it's missing, the client predates the Certificate model.
  return typeof (client as unknown as { certificate?: unknown }).certificate === 'undefined'
}

const cached = globalForPrisma.prisma
if (isStaleClient(cached)) {
  globalForPrisma.prisma = undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
