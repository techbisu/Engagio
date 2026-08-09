/**
 * Helpers for the Organization API routes.
 *
 * The tenant.ts helpers resolve the *current* org from the session + the
 * `x-org-slug` header (the "active org" of the user). But the
 * `/api/organizations/[id]/...` routes operate on an org specified by URL,
 * which may differ from the user's active org. This module resolves
 * membership against the URL's org id directly.
 *
 * NOTE: The Prisma schema intentionally does NOT define a `plan` relation on
 * Organization (just `planId String?`) — see prisma/schema.prisma. So when
 * callers ask for the plan, we fetch it separately by `planId` instead of
 * using `include: { plan: true }`.
 */

import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { db } from "./db"
import { hasRole, type TenantContext, type OrgRole } from "./tenant"

type OrgRow = Awaited<ReturnType<typeof db.organization.findUnique>>
type PlanRow = Awaited<ReturnType<typeof db.plan.findUnique>>
type MemberRow = Awaited<ReturnType<typeof db.organizationMember.findUnique>>

export interface OrgMembershipResult {
  ctx: TenantContext
  /** The Organization row (with `plan` attached when requested by the caller). */
  org: OrgRow & { plan?: PlanRow | null }
  /** The OrganizationMember row, or null when the caller is a platform admin
   *  operating on an org they're not a member of. */
  membership: MemberRow
}

/**
 * Resolve the caller's membership in a specific organization (by id).
 * Verifies:
 *   1. The caller is authenticated.
 *   2. The organization exists (404 otherwise).
 *   3. The caller is a member of that org (403 otherwise) — platform admins
 *      bypass this check (treated as ADMIN).
 *   4. The caller's role meets the minimum required level (403 otherwise).
 *
 * Returns a TenantContext built from the session + the URL's org, suitable
 * for passing to `auditLog()`.
 *
 * Pass `{ includePlan: true }` to also fetch the org's Plan (attached as
 * `org.plan`) — the schema doesn't define an Organization↔Plan relation, so
 * we fetch the Plan by `planId` separately.
 */
export async function resolveOrgMembership(
  orgId: string,
  minRole: OrgRole,
  options: { includePlan?: boolean } = {}
): Promise<OrgMembershipResult | { error: string; status: number }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return { error: "Not authenticated", status: 401 }
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
  })
  if (!org) {
    return { error: "Organization not found", status: 404 }
  }

  const membership = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId: session.user.id },
    },
  })

  const isPlatformAdmin = (session.user as any).role === "ADMIN"
  if (!membership && !isPlatformAdmin) {
    return { error: "Not a member of this organization", status: 403 }
  }

  const userRole: OrgRole = (membership?.role as OrgRole) ?? "ADMIN"
  if (!isPlatformAdmin && !hasRole(userRole, minRole)) {
    return { error: `Insufficient permissions (requires ${minRole} role)`, status: 403 }
  }

  const ctx: TenantContext = {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name ?? null,
    userRole: (session.user as any).role,
    orgId: org.id,
    orgSlug: org.slug,
    orgName: org.name,
    orgRole: userRole,
    isPlatformAdmin,
  }

  // Optionally fetch the plan separately (no relation on Organization).
  let plan: PlanRow = null
  if (options.includePlan && org.planId) {
    plan = await db.plan.findUnique({ where: { id: org.planId } })
  }

  return { ctx, org: { ...org, plan }, membership }
}
