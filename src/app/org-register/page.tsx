"use client"

/**
 * /org-register
 *
 * Organization onboarding page (email + password registration + org details form).
 *
 * Replaces the old `/?view=org-register` and `/?view=org-onboarding`
 * query-param routes.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { OrgOnboarding } from "@/components/organization/org-onboarding"
import { useCurrentUser } from "@/components/shared/use-current-user"

export default function OrgRegisterPage() {
  const router = useRouter()
  const { user, refetch } = useCurrentUser()

  const handleOrgCreated = React.useCallback(async (_orgId: string, orgSlug?: string) => {
    // Refetch user data to get updated canManageOrg flag after org creation.
    await refetch()
    // Route the user to the org-scoped admin panel.
    if (orgSlug) {
      router.push("/org/" + orgSlug + "/admin")
    } else {
      router.push("/admin")
    }
  }, [router, refetch])

  const handleCancel = React.useCallback(() => {
    if (user) {
      router.push("/admin")
    } else {
      router.push("/")
    }
  }, [user, router])

  return (
    <OrgOnboarding
      onCreated={handleOrgCreated}
      onCancel={handleCancel}
      forced={!user}
    />
  )
}
