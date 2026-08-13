"use client"

/**
 * /org-register
 *
 * Organization onboarding page (Google login + org details form).
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
  const { user } = useCurrentUser()

  const handleOrgCreated = React.useCallback(
    (_orgId: string) => {
      // Route the user to the admin shell (which is org-aware via the switcher).
      router.push("/admin")
    },
    [router],
  )

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
