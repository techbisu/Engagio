"use client"

/**
 * /admin
 *
 * Organization admin panel. Default landing for signed-in ADMIN users who
 * have at least one org membership.
 *
 * Replaces the old `/?view=admin` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AdminShell } from "@/components/admin/admin-shell"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppStore } from "@/store/app-store"
import { ORG_CHANGED_EVENT_NAME } from "@/components/organization/api"
import type { AdminTab } from "@/types"

export default function AdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, signOutEverything } = useCurrentUser()
  const adminTab = useAppStore((s) => s.adminTab)
  const setAdminTab = useAppStore((s) => s.setAdminTab)
  const setCurrentOrgSlug = useAppStore((s) => s.setCurrentOrgSlug)

  // Read ?tab= from URL to support deep-linking admin sub-tabs.
  const tabParam = searchParams.get("tab") as AdminTab | null
  const initialTab = tabParam ?? adminTab

  // Redirect to /login if not signed in. Wait for the session + meQuery to
  // finish before redirecting to avoid a flash on page reload.
  React.useEffect(() => {
    if (!user) {
      router.replace("/login")
    } else if (user.role !== "ADMIN") {
      // Non-admin → send them to the student dashboard.
      router.replace("/dashboard")
    }
  }, [user, router])

  // Hydrate currentOrgSlug from localStorage on mount, and listen for the
  // `engagio-org-changed` custom event so the store stays in sync when the
  // OrgSwitcher (or anyone else) updates it.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem("engagio-org-slug")
    if (stored && stored !== useAppStore.getState().currentOrgSlug) {
      setCurrentOrgSlug(stored)
    }
    function handleOrgChange(e: Event) {
      const detail = (e as CustomEvent<{ slug: string | null }>).detail
      setCurrentOrgSlug(detail?.slug ?? null)
    }
    window.addEventListener(ORG_CHANGED_EVENT_NAME, handleOrgChange)
    return () =>
      window.removeEventListener(ORG_CHANGED_EVENT_NAME, handleOrgChange)
  }, [setCurrentOrgSlug])

  const handleSignOut = React.useCallback(async () => {
    await signOutEverything()
    router.push("/")
  }, [signOutEverything, router])

  const handleNavigate = React.useCallback(
    (view: "landing" | "login" | "student" | "platform") => {
      switch (view) {
        case "landing":
          router.push("/")
          break
        case "login":
          router.push("/login")
          break
        case "student":
          router.push("/dashboard")
          break
        case "platform":
          router.push("/superadmin/login")
          break
      }
    },
    [router],
  )

  const handleOrgSwitch = React.useCallback(
    (slug: string) => {
      setCurrentOrgSlug(slug)
    },
    [setCurrentOrgSlug],
  )

  const handleOpenOrgSettings = React.useCallback(() => {
    // Org settings is a future route — for now, stay on /admin.
    // (Original code routed to "org-settings" view which doesn't have a
    // dedicated file route in Phase 1.)
  }, [])

  const handleOpenOrgOnboarding = React.useCallback(() => {
    router.push("/org-register")
  }, [router])

  // Loading state until session resolves.
  if (!user || user.role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <AdminShell
      user={user}
      initialTab={initialTab}
      onTabChange={setAdminTab}
      onSignOut={handleSignOut}
      onNavigate={handleNavigate}
      onOrgSwitch={handleOrgSwitch}
      onOpenOrgSettings={handleOpenOrgSettings}
      onOpenOrgOnboarding={handleOpenOrgOnboarding}
    />
  )
}
