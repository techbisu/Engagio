/**
 * Tenant context helpers — the single source of truth for multi-tenancy.
 *
 * Every org-scoped API route MUST resolve the current organization from the
 * authenticated session + the user's organization membership, NEVER from a
 * browser-supplied `organizationId`.
 *
 * Usage in API routes:
 *   const ctx = await requireOrgContext(req)
 *   // ctx.orgId, ctx.userId, ctx.role, ctx.org
 *   const events = await db.event.findMany({ where: { organizationId: ctx.orgId } })
 *
 * For backward compatibility (existing routes without org context), use
 * `getOrCreateDefaultOrg()` which returns the Default Organization so
 * existing data remains accessible.
 */

import { getServerSession } from "next-auth"
import type { NextRequest } from "next/server"
import { authOptions } from "./auth"
import { db } from "./db"
import type { Role } from "@/types"

export type OrgRole =
  | "OWNER"
  | "ADMIN"
  | "EVENT_MANAGER"
  | "MODERATOR"
  | "EVALUATOR"
  | "CHECKIN_STAFF"
  | "PARTICIPANT"

export interface TenantContext {
  userId: string
  userEmail: string
  userName: string | null
  userRole: Role // the global role (ADMIN | STUDENT)
  orgId: string
  orgSlug: string
  orgName: string
  orgRole: OrgRole
  isPlatformAdmin: boolean
}

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  OWNER: 7,
  ADMIN: 6,
  EVENT_MANAGER: 5,
  MODERATOR: 4,
  EVALUATOR: 3,
  CHECKIN_STAFF: 2,
  PARTICIPANT: 1,
}

/** Check if a role meets the minimum required level. */
export function hasRole(memberRole: OrgRole, required: OrgRole): boolean {
  return ROLE_HIERARCHY[memberRole] >= ROLE_HIERARCHY[required]
}

/**
 * Get or create the Default Organization. Used for backward compatibility
 * so existing data (events/questions without organizationId) remains
 * accessible. Also used when a user has no org memberships yet.
 */
let defaultOrgCache: { id: string; slug: string; name: string } | null = null

export async function getOrCreateDefaultOrg(): Promise<{
  id: string
  slug: string
  name: string
}> {
  if (defaultOrgCache) return defaultOrgCache

  let org = await db.organization.findUnique({ where: { slug: "default" } })
  if (!org) {
    org = await db.organization.create({
      data: {
        name: "Default Organization",
        slug: "default",
        description: "Default organization for existing data (auto-created during migration).",
        status: "ACTIVE",
      },
    })
  }
  defaultOrgCache = { id: org.id, slug: org.slug, name: org.name }
  return defaultOrgCache
}

/**
 * Resolve the current tenant context from the session + optional org slug/switch.
 *
 * The client can pass the desired org via:
 *   1. `x-org-slug` header (set by the org switcher)
 *   2. `?org=slug` query param
 *
 * If neither is provided, the user's first org membership is used.
 * If the user has no memberships, the Default Org is used (read-only for PARTICIPANTs).
 */
export async function getTenantContext(
  req?: NextRequest
): Promise<TenantContext | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) return null

  const isPlatformAdmin = (session.user as any).role === "ADMIN"

  // Determine the target org slug from header or query
  let targetSlug: string | null = null
  if (req) {
    targetSlug =
      req.headers.get("x-org-slug") ||
      new URL(req.url).searchParams.get("org")
  }

  // Fetch the user's org memberships
  const memberships = await db.organizationMember.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: { organization: { select: { id: true, slug: true, name: true, status: true } } },
  })

  // If target slug specified, find that membership
  let activeMembership = null
  if (targetSlug) {
    activeMembership = memberships.find(
      (m) => m.organization.slug === targetSlug && m.organization.status === "ACTIVE"
    )
  }
  // Fallback: first membership
  if (!activeMembership && memberships.length > 0) {
    activeMembership = memberships[0]
  }

  let orgId: string
  let orgSlug: string
  let orgName: string
  let orgRole: OrgRole

  if (activeMembership) {
    orgId = activeMembership.organizationId
    orgSlug = activeMembership.organization.slug
    orgName = activeMembership.organization.name
    orgRole = activeMembership.role as OrgRole
  } else {
    // No memberships — use Default Org as PARTICIPANT (read-only)
    const defaultOrg = await getOrCreateDefaultOrg()
    orgId = defaultOrg.id
    orgSlug = defaultOrg.slug
    orgName = defaultOrg.name
    orgRole = isPlatformAdmin ? "ADMIN" : "PARTICIPANT"
  }

  return {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name ?? null,
    userRole: (session.user as any).role as Role,
    orgId,
    orgSlug,
    orgName,
    orgRole,
    isPlatformAdmin,
  }
}

/**
 * Require an authenticated tenant context. Returns 401 if not authenticated.
 * Use this for any org-scoped route.
 */
export async function requireTenantContext(
  req?: NextRequest
): Promise<TenantContext | { error: string; status: number }> {
  const ctx = await getTenantContext(req)
  if (!ctx) {
    return { error: "Not authenticated", status: 401 }
  }
  return ctx
}

/**
 * Require a minimum org role. Use this to gate admin-only routes.
 * Returns the context on success, or an error response on failure.
 *
 *   const result = await requireOrgRole(req, "EVENT_MANAGER")
 *   if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
 *   const ctx = result
 */
export async function requireOrgRole(
  req: NextRequest | undefined,
  minRole: OrgRole
): Promise<TenantContext | { error: string; status: number }> {
  const result = await requireTenantContext(req)
  if ("error" in result) return result

  // Platform admins bypass org role checks
  if (result.isPlatformAdmin) return result

  if (!hasRole(result.orgRole, minRole)) {
    return {
      error: `Insufficient permissions (requires ${minRole} role)`,
      status: 403,
    }
  }
  return result
}

/**
 * Verify that a resource belongs to the current organization.
 * Use this before returning/updating/deleting any org-scoped resource.
 *
 *   const event = await db.event.findUnique({ where: { id } })
 *   if (!ownsResource(event, ctx)) return 404
 */
export function ownsResource(
  resource: { organizationId?: string | null } | null,
  ctx: TenantContext
): boolean {
  if (!resource) return false
  // Platform admin can access any org's data
  if (ctx.isPlatformAdmin) return true
  // If the resource has an organizationId, it must match
  if (resource.organizationId) {
    return resource.organizationId === ctx.orgId
  }
  // If the resource has no organizationId (legacy data), only allow if
  // the current org is the Default Org. This prevents cross-tenant leaks
  // of unmigrated data.
  return ctx.orgSlug === "default"
}

/**
 * Build a Prisma `where` clause scoped to the current org.
 * Use this for all list queries on org-owned resources.
 *
 *   const events = await db.event.findMany({ where: orgScope(ctx) })
 */
export function orgScope(ctx: TenantContext): { organizationId: string } {
  return { organizationId: ctx.orgId }
}

/**
 * Log an audit event for the current org.
 */
export async function auditLog(
  ctx: TenantContext,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        organizationId: ctx.orgId,
        userId: ctx.userId,
        action,
        entityType: entityType || null,
        entityId: entityId || null,
        metadata: metadata ? JSON.stringify(metadata) : "{}",
      },
    })
  } catch (e) {
    console.error("[auditLog] failed:", e)
  }
}
