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
 *   5. Role-based: STUDENT → /dashboard, ADMIN with org → /admin,
 *      ADMIN without org → /org-register (via NoOrgRedirect)
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
      if (me.role === "STUDENT") {
        router.push("/dashboard")
        return
      }

      // ADMIN role: check for org membership
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
