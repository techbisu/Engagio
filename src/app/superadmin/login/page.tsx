"use client"

/**
 * /superadmin/login
 *
 * Super Admin login page (separate from org login). Renders the
 * SuperAdminLogin component with the dark amber-themed chrome.
 *
 * Replaces the old `/?view=superadmin` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { SuperAdminLogin } from "@/components/auth/super-admin-login"
import { SuperAdminSecurity } from "@/components/auth/super-admin-security"
import { PlatformAdminShell } from "@/components/platform/platform-admin-shell"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppStore } from "@/store/app-store"

export default function SuperAdminLoginPage() {
  const router = useRouter()
  const { user, session, sessionStatus, isLoading, refetch, signOutEverything } =
    useCurrentUser()
  const setView = useAppStore((s) => s.setView)
  const view = useAppStore((s) => s.view)

  const handleBack = React.useCallback(() => {
    router.push("/")
  }, [router])

  const handleSignOut = React.useCallback(async () => {
    await signOutEverything()
    router.push("/")
  }, [signOutEverything, router])

  const handleNavigateHome = React.useCallback(() => {
    router.push("/")
  }, [router])

  const handleOpenAdmin = React.useCallback(() => {
    router.push("/admin")
  }, [router])

  // Loading state while session + me load.
  if (sessionStatus === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  // If user is authed as a super admin, show the platform shell OR the
  // security setup page (depending on the "view" store — kept for the
  // superadmin-security sub-view that doesn't have its own route).
  if (user && user.role === "ADMIN") {
    const isSuper = (session as { user?: { isSuperAdmin?: boolean } } | null)?.user
      ?.isSuperAdmin === true
    if (isSuper) {
      if (view === "superadmin-security") {
        return <SuperAdminSecurity onBack={() => setView("platform")} />
      }
      return (
        <PlatformAdminShell
          user={user}
          onSignOut={handleSignOut}
          onNavigateHome={handleNavigateHome}
          onOpenAdmin={handleOpenAdmin}
          onOpenSecurity={() => setView("superadmin-security")}
        />
      )
    }
  }

  // Not authed or not super admin → show login
  return (
    <SuperAdminLogin
      onSuccess={async () => {
        // Refetch /api/me to pick up the new session.
        await refetch()
        // Verify super admin in session
        const sessionRes = await fetch("/api/auth/session").then((r) => r.json())
        if (sessionRes?.user?.isSuperAdmin) {
          setView("platform")
        } else {
          toast.error("This account does not have Super Admin privileges.")
        }
      }}
      onBack={handleBack}
    />
  )
}
