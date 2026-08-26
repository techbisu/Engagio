"use client"

/**
 * useRouteAfterAuth
 *
 * Hook that encapsulates the post-login routing logic, shared by /login,
 * /superadmin/login, and the OAuth callback landing flow.
 *
 * Behavior:
 *   1. Invitation deep-link (/invite/[token]) → accept invitation view
 *   2. Quiz deep-link (/quiz/[slug]) → student quiz-start
 *   3. Activity deep-link (?activity=slug) → student dashboard activity
 *   4. Event deep-link (/event/[slug]) → event landing page
 *   5. Role-based:
 *      - canManageOrg (OWNER/ADMIN/EVENT_MANAGER in an ACTIVE org,
 *        or platform admin) → /org/{slug}/admin
 *      - PARTICIPANT with org membership → /org/{slug} (org landing page)
 *      - PARTICIPANT without org → /dashboard
 *      - Legacy ADMIN without org membership → /org-register
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

      // 5. Role-based routing
      //
      // Org access is membership-based: canManageOrg (OWNER/ADMIN/EVENT_MANAGER
      // in an ACTIVE org, or platform admin) goes straight to the admin panel.
      if (me.canManageOrg) {
        // Redirect to org-scoped admin URL if we know the org slug.
        const firstSlug = me.orgMemberships?.[0]?.slug
        if (firstSlug) {
          router.push("/org/" + firstSlug + "/admin")
        } else {
          router.push("/admin")
        }
        return
      }

      // Participants with org membership → go to the org's landing page
      if (me.role === "PARTICIPANT" && me.orgMemberships && me.orgMemberships.length > 0) {
        const firstOrg = me.orgMemberships[0]
        router.push("/org/" + firstOrg.slug + "/participant/dashboard")
        return
      }

      // Participants without org membership → generic dashboard
      if (me.role === "PARTICIPANT") {
        router.push("/dashboard")
        return
      }

      // Legacy ADMIN role without an org-management membership: check for org
      // membership so they land on /no-org instead of an empty admin panel.
      try {
        const orgRes = await fetch("/api/organizations")
        const orgData = await orgRes.json()
        if (orgData.organizations && orgData.organizations.length > 0) {
          const slug = orgData.organizations[0]?.slug
          if (slug) {
            router.push("/org/" + slug + "/admin")
          } else {
            router.push("/admin")
          }
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
