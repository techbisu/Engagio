"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AdminShell } from "@/components/admin/admin-shell"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppStore } from "@/store/app-store"
import { setOrgSlug, ORG_CHANGED_EVENT_NAME } from "@/components/organization/api"
import type { AdminTab } from "@/types"

/**
 * /admin — Organization admin panel (backward-compat route).
 *
 * Redirects to /org/[orgSlug]/admin when the user has an org membership.
 * Falls back to showing the admin shell for legacy users without an org slug.
 */
export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <AdminPageInner />
    </Suspense>
  )
}

function AdminPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading, signOutEverything } = useCurrentUser()
  const adminTab = useAppStore((s) => s.adminTab)
  const setAdminTab = useAppStore((s) => s.setAdminTab)
  const setCurrentOrgSlug = useAppStore((s) => s.setCurrentOrgSlug)

  const tabParam = searchParams.get("tab") as AdminTab | null
  const initialTab = tabParam ?? adminTab

  // If the user has an org membership, redirect to the org-scoped URL.
  React.useEffect(() => {
    if (isLoading || !user) return
    if (!user.canManageOrg) {
      router.replace("/dashboard")
      return
    }
    // Redirect to org-scoped admin URL if we have a slug and aren't already there.
    const slug = user.orgMemberships?.[0]?.slug
    if (slug && !window.location.pathname.startsWith("/org/")) {
      router.replace("/org/" + slug + "/admin")
    }
  }, [user, isLoading, router])

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
    return () => window.removeEventListener(ORG_CHANGED_EVENT_NAME, handleOrgChange)
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
      // Navigate to the new org's admin page.
      router.replace("/org/" + slug + "/admin")
    },
    [setCurrentOrgSlug, router],
  )

  const handleOpenOrgSettings = React.useCallback(() => {
    const slug = currentOrgSlug || user?.orgMemberships?.find((m) => m.role === "OWNER" || m.role === "ADMIN")?.organization?.slug
    if (slug) {
      router.push("/org/" + slug + "/admin")
    }
  }, [currentOrgSlug, router, user])

  const handleOpenOrgOnboarding = React.useCallback(() => {
    router.push("/org-register")
  }, [router])

  if (isLoading || !user || !user.canManageOrg) {
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
