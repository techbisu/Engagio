/**
 * Centralized permission system for Engagio.
 *
 * Permissions are server-side checked via `hasPermission(ctx, permission)`.
 * This is the single source of truth — do NOT scatter `if (role === "ADMIN")`
 * checks throughout the codebase.
 *
 * Each permission maps to one or more roles that have it. The role hierarchy
 * (from tenant.ts) is still used for backward compat, but new code should
 * prefer `hasPermission()` over `requireOrgRole()`.
 */

import { hasRole, type OrgRole, type TenantContext } from "./tenant"

// ─── Role tier helpers ─────────────────────────────────────────────────────
// Groups the 7 org roles into 3 tiers for simplified permission checks.
// Use roleTier(role) instead of hardcoding role name lists in every route.

export type RoleTier = "admin" | "manager" | "participant"

export function roleTier(role: OrgRole): RoleTier {
  switch (role) {
    case "OWNER":
    case "ADMIN":
      return "admin"
    case "EVENT_MANAGER":
    case "MODERATOR":
    case "EVALUATOR":
    case "CHECKIN_STAFF":
      return "manager"
    case "PARTICIPANT":
    default:
      return "participant"
  }
}

/**
 * Check if the context's org role is in the "admin tier" (OWNER or ADMIN).
 */
export function isOrgAdmin(ctx: TenantContext): boolean {
  if (ctx.isPlatformAdmin) return true
  return roleTier(ctx.orgRole) === "admin"
}

/**
 * Check if the context's org role is in the "manager tier" or above
 * (EVENT_MANAGER, MODERATOR, EVALUATOR, CHECKIN_STAFF, ADMIN, OWNER).
 */
export function isOrgManager(ctx: TenantContext): boolean {
  if (ctx.isPlatformAdmin) return true
  const tier = roleTier(ctx.orgRole)
  return tier === "admin" || tier === "manager"
}

// ─── Permission definitions ────────────────────────────────────────────────

export type Permission =
  // Organization
  | "organization.view"
  | "organization.update"
  | "organization.delete"
  | "organization.members.manage"
  | "organization.roles.manage"
  | "organization.billing.view"
  | "organization.billing.manage"
  | "organization.domains.manage"
  | "organization.branding.manage"
  | "organization.audit.read"
  // Events
  | "event.view"
  | "event.create"
  | "event.update"
  | "event.delete"
  | "event.publish"
  // Registration
  | "registration.view"
  | "registration.manage"
  | "registration.payment.verify"
  // Activities
  | "activity.view"
  | "activity.create"
  | "activity.update"
  | "activity.delete"
  | "activity.moderate"
  // Questions / Assessment
  | "question.view"
  | "question.create"
  | "question.update"
  | "question.delete"
  | "question.import"
  | "assessment.view"
  | "assessment.create"
  | "assessment.manage"
  | "assessment.evaluate"
  // Results
  | "result.view"
  | "result.publish"
  // Certificates
  | "certificate.view"
  | "certificate.generate"
  | "certificate.revoke"
  // Analytics
  | "analytics.view"
  // Check-in
  | "checkin.view"
  | "checkin.manage"

/**
 * Role → Permission mapping. A role has all permissions listed for it,
 * PLUS all permissions of roles below it in the hierarchy.
 */
const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  OWNER: [
    // Owner has everything — plus ownership-sensitive actions
    "organization.delete",
    "organization.roles.manage",
    "organization.billing.manage",
    "organization.domains.manage",
    "organization.branding.manage",
    "organization.members.manage",
    "organization.update",
    "organization.audit.read",
    "organization.view",
    "event.create",
    "event.update",
    "event.delete",
    "event.publish",
    "registration.payment.verify",
    "activity.moderate",
    "assessment.evaluate",
    "result.publish",
    "certificate.generate",
    "certificate.revoke",
    "checkin.manage",
    "analytics.view",
  ],
  ADMIN: [
    // Admin has most things except org deletion + ownership transfer
    "organization.update",
    "organization.members.manage",
    "organization.branding.manage",
    "organization.audit.read",
    "organization.view",
    "event.create",
    "event.update",
    "event.delete",
    "event.publish",
    "registration.payment.verify",
    "activity.moderate",
    "assessment.evaluate",
    "result.publish",
    "certificate.generate",
    "certificate.revoke",
    "checkin.manage",
    "analytics.view",
  ],
  EVENT_MANAGER: [
    "organization.view",
    "event.create",
    "event.update",
    "event.publish",
    "registration.manage",
    "activity.create",
    "activity.update",
    "assessment.create",
    "assessment.manage",
    "certificate.generate",
    "checkin.manage",
    "analytics.view",
  ],
  MODERATOR: [
    "organization.view",
    "event.view",
    "activity.view",
    "activity.moderate",
    "checkin.view",
  ],
  EVALUATOR: [
    "organization.view",
    "question.view",
    "question.create",
    "question.update",
    "assessment.view",
    "assessment.manage",
    "assessment.evaluate",
    "result.view",
    "result.publish",
  ],
  CHECKIN_STAFF: [
    "organization.view",
    "event.view",
    "registration.view",
    "checkin.view",
    "checkin.manage",
  ],
  PARTICIPANT: [
    // Participants have no org-admin permissions — they interact via
    // public routes + their own registrations/attempts/certs
  ],
}

/**
 * Check if the current tenant context has a permission.
 *
 * Platform admins always have all permissions.
 *
 *   if (await hasPermission(ctx, "event.create")) { ... }
 */
export function hasPermission(
  ctx: TenantContext,
  permission: Permission
): boolean {
  // Platform admins bypass all permission checks
  if (ctx.isPlatformAdmin) return true

  const rolePerms = ROLE_PERMISSIONS[ctx.orgRole] || []
  return rolePerms.includes(permission)
}

/**
 * Check multiple permissions — returns true if the user has ALL of them.
 */
export function hasAllPermissions(
  ctx: TenantContext,
  ...permissions: Permission[]
): boolean {
  if (ctx.isPlatformAdmin) return true
  return permissions.every((p) => hasPermission(ctx, p))
}

/**
 * Check multiple permissions — returns true if the user has ANY of them.
 */
export function hasAnyPermission(
  ctx: TenantContext,
  ...permissions: Permission[]
): boolean {
  if (ctx.isPlatformAdmin) return true
  return permissions.some((p) => hasPermission(ctx, p))
}

/**
 * Get all permissions for a role (useful for the role management UI).
 */
export function getPermissionsForRole(role: OrgRole): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Get all available permissions (for the admin permission matrix UI).
 */
export function getAllPermissions(): Permission[] {
  return [
    "organization.view",
    "organization.update",
    "organization.delete",
    "organization.members.manage",
    "organization.roles.manage",
    "organization.billing.view",
    "organization.billing.manage",
    "organization.domains.manage",
    "organization.branding.manage",
    "organization.audit.read",
    "event.view",
    "event.create",
    "event.update",
    "event.delete",
    "event.publish",
    "registration.view",
    "registration.manage",
    "registration.payment.verify",
    "activity.view",
    "activity.create",
    "activity.update",
    "activity.delete",
    "activity.moderate",
    "question.view",
    "question.create",
    "question.update",
    "question.delete",
    "question.import",
    "assessment.view",
    "assessment.create",
    "assessment.manage",
    "assessment.evaluate",
    "result.view",
    "result.publish",
    "certificate.view",
    "certificate.generate",
    "certificate.revoke",
    "analytics.view",
    "checkin.view",
    "checkin.manage",
  ]
}

// ─── Convenience: map permissions to roles for the UI ──────────────────────

export const PERMISSION_LABELS: Record<Permission, string> = {
  "organization.view": "View organization",
  "organization.update": "Update organization settings",
  "organization.delete": "Delete organization",
  "organization.members.manage": "Manage members",
  "organization.roles.manage": "Manage roles",
  "organization.billing.view": "View billing",
  "organization.billing.manage": "Manage billing",
  "organization.domains.manage": "Manage domains",
  "organization.branding.manage": "Manage branding",
  "organization.audit.read": "Read audit logs",
  "event.view": "View events",
  "event.create": "Create events",
  "event.update": "Update events",
  "event.delete": "Delete events",
  "event.publish": "Publish events",
  "registration.view": "View registrations",
  "registration.manage": "Manage registrations",
  "registration.payment.verify": "Verify payments",
  "activity.view": "View activities",
  "activity.create": "Create activities",
  "activity.update": "Update activities",
  "activity.delete": "Delete activities",
  "activity.moderate": "Moderate activities",
  "question.view": "View questions",
  "question.create": "Create questions",
  "question.update": "Update questions",
  "question.delete": "Delete questions",
  "question.import": "Import questions",
  "assessment.view": "View assessments",
  "assessment.create": "Create assessments",
  "assessment.manage": "Manage assessments",
  "assessment.evaluate": "Evaluate assessments",
  "result.view": "View results",
  "result.publish": "Publish results",
  "certificate.view": "View certificates",
  "certificate.generate": "Generate certificates",
  "certificate.revoke": "Revoke certificates",
  "analytics.view": "View analytics",
  "checkin.view": "View check-in",
  "checkin.manage": "Manage check-in",
}
