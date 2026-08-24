"use client"

/**
 * Client-side permission helpers.
 *
 * The server returns the caller's effective (inherited) permissions in
 * `/api/me` (`permissions` for the active org, plus `permissionsByOrg` so the
 * UI can react to org switching without a refetch). These helpers mirror the
 * server-side `hasAnyPermission` from `src/lib/permissions.ts` so the admin
 * panel can hide tabs/actions the user's org role can't perform.
 */

import type { SafeUser } from "@/types"

/**
 * Resolve the permission list that applies to the currently-active org.
 *
 * Resolution order matches the server's `getTenantContext`:
 *   1. the `currentOrgSlug` (the `x-org-slug` header equivalent on the client)
 *   2. the user's first ACTIVE membership
 *   3. `user.permissions` (active-org permissions computed server-side)
 */
export function getActiveOrgPermissions(
  user: SafeUser | null | undefined,
  currentOrgSlug?: string | null
): string[] {
  if (!user) return []
  if (user.permissionsByOrg) {
    if (currentOrgSlug && user.permissionsByOrg[currentOrgSlug]) {
      return user.permissionsByOrg[currentOrgSlug]
    }
    const first = user.orgMemberships?.[0]?.slug
    if (first && user.permissionsByOrg[first]) {
      return user.permissionsByOrg[first]
    }
  }
  return user.permissions ?? []
}

/**
 * True if the user has ANY of the given permissions in the active org.
 * Platform admins always pass (they bypass all permission checks server-side).
 */
export function hasAnyPermission(
  user: SafeUser | null | undefined,
  permissions: string[],
  currentOrgSlug?: string | null
): boolean {
  if (!user) return false
  if (user.isPlatformAdmin) return true
  if (!permissions || permissions.length === 0) return false
  const active = getActiveOrgPermissions(user, currentOrgSlug)
  return permissions.some((p) => active.includes(p))
}

/**
 * True if the user has ALL of the given permissions in the active org.
 * Platform admins always pass.
 */
export function hasAllPermissions(
  user: SafeUser | null | undefined,
  permissions: string[],
  currentOrgSlug?: string | null
): boolean {
  if (!user) return false
  if (user.isPlatformAdmin) return true
  if (!permissions || permissions.length === 0) return false
  const active = getActiveOrgPermissions(user, currentOrgSlug)
  return permissions.every((p) => active.includes(p))
}
