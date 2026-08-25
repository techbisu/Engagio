"use client"

/**
 * /no-org
 *
 * Intermediate page shown after login when the user has NO
 * organization membership. Explains the situation clearly and routes the
 * user toward registration (or sign-out so they can try a different
 * account).
 *
 * Replaces the old `/?view=no-org` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { NoOrgRedirect } from "@/components/organization/no-org-redirect"
import { useCurrentUser } from "@/components/shared/use-current-user"

export default function NoOrgRoutePage() {
  const router = useRouter()
  const { user, signOutEverything } = useCurrentUser()

  const handleRegister = React.useCallback(() => {
    router.push("/org-register")
  }, [router])

  const handleHome = React.useCallback(() => {
    router.push("/")
  }, [router])

  // If not signed in, just send them to /login.
  React.useEffect(() => {
    if (!user) {
      router.replace("/login")
    }
  }, [user, router])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  // We pass signOutEverything-wrapped home handler so NoOrgRedirect's "sign
  // out" button signs out AND clears the client cache.
  return (
    <NoOrgRedirect
      email={user?.email}
      onRegister={handleRegister}
      onHome={handleHome}
    />
  )
}
