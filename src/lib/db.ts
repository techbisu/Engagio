import { PrismaClient } from '@prisma/client'

/**
 * Schema versioning for the cached PrismaClient.
 *
 * Bump this whenever the schema gains new models/relations so the cached
 * client (which was instantiated from an earlier `prisma generate` output)
 * is discarded and a fresh one is created from the current generated code.
 *
 * History:
 *  - v7: Plan.prices relation + PlanPrice model added (PROD-SAAS-2)
 */
const PRISMA_SCHEMA_VERSION = 7

interface GlobalWithPrismaMeta {
  prisma: PrismaClient | undefined
  __prismaSchemaVersion?: number
}

const globalForPrisma = globalThis as unknown as GlobalWithPrismaMeta

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
  // Probe for delegates added after the original set. If any are missing,
  // the cached client predates the current schema and must be discarded.
  const hasNewDelegates =
    typeof (client as unknown as { certificate?: unknown }).certificate !==
      'undefined' &&
    typeof (client as unknown as { planPrice?: unknown }).planPrice !==
      'undefined' &&
    typeof (client as unknown as { organizationDomain?: unknown })
      .organizationDomain !== 'undefined'
  if (!hasNewDelegates) return true
  // Schema version check — discard when the cached client predates the
  // current schema (e.g., a new relation was added after the dev server
  // started and `prisma generate` ran).
  if (globalForPrisma.__prismaSchemaVersion !== PRISMA_SCHEMA_VERSION) {
    return true
  }
  return false
}

const cached = globalForPrisma.prisma
if (isStaleClient(cached)) {
  globalForPrisma.prisma = undefined
  globalForPrisma.__prismaSchemaVersion = PRISMA_SCHEMA_VERSION
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.__prismaSchemaVersion = PRISMA_SCHEMA_VERSION
}
