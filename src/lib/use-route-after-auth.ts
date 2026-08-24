"use client"

/**
 * useRouteAfterAuth
 *
 * Hook that encapsulates the post-login routing logic, shared by /login,
 * /superadmin/login, and the OAuth callback landing flow. Mirrors the
 * original `routeAfterAuth` function from the old monolithic page.tsx.
 *
 * Behavior:
 *   1. Invitation deep-link (/invite/[token]) → accept invitation view
 *   2. Quiz deep-link (/quiz/[slug]) → student quiz-start
 *   3. Activity deep-link (?activity=slug) → student dashboard activity
 *   4. Event deep-link (/event/[slug]) → event landing page
 *   5. Role-based: canManageOrg (OWNER/ADMIN/EVENT_MANAGER in an ACTIVE org,
 *      or platform admin) → /admin, STUDENT → /dashboard, legacy ADMIN without
 *      an org → /org-register (via NoOrgRedirect)
 *
 * Added during the Phase 1 routing migration.
 */

import { useRouter } from "next/navigation"
import { useCallback } from "react"
import { toast } from "sonner"
import type { SafeUser } from "@/types"

export function useRouteAfterAuth() {
  const router = useRouter()

  return useCallback(
    async (me: SafeUser, opts?: { inviteToken?: string | null }) => {
      // 1. Invitation deep-link → accept invitation
      if (opts?.inviteToken) {
        router.push(`/invite/${encodeURIComponent(opts.inviteToken)}`)
        return
      }

      // 5. Role-based routing (the only remaining logic after deep-link checks
      //    were moved to dedicated routes — /quiz, /event, /activity are now
      //    separate files that the user lands on directly).
      //
      // Org access is membership-based: canManageOrg (OWNER/ADMIN/EVENT_MANAGER
      // in an ACTIVE org, or platform admin) goes straight to the admin panel.
      // The flag is server-computed from memberships, so no extra fetch needed.
      if (me.canManageOrg) {
        router.push("/admin")
        return
      }

      if (me.role === "STUDENT") {
        router.push("/dashboard")
        return
      }

      // Legacy ADMIN role without an org-management membership: check for org
      // membership so they land on /no-org instead of an empty admin panel.
      try {
        const orgRes = await fetch("/api/organizations")
        const orgData = await orgRes.json()
        if (orgData.organizations && orgData.organizations.length > 0) {
          router.push("/admin")
        } else {
          // No org → show toast + intermediate redirect page.
          toast.error("No organization found for this email.", {
            description: "Please register your organization first.",
          })
          router.push("/no-org")
        }
      } catch {
        // Org check failed → go to admin panel
        router.push("/admin")
      }
    },
    [router],
  )
}
