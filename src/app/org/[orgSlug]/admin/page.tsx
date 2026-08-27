"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useParams } from "next/navigation"
import { AdminShell } from "@/components/admin/admin-shell"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppStore } from "@/store/app-store"
import { setOrgSlug, ORG_CHANGED_EVENT_NAME } from "@/components/organization/api"
import type { AdminTab } from "@/types"

/**
 * /org/[orgSlug]/admin — Organization admin panel (org-scoped URL).
 *
 * Sets the active org slug from the URL param so all API calls
 * resolve to the correct tenant context.
 */
export default function OrgAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <OrgAdminPageInner />
    </Suspense>
  )
}

function OrgAdminPageInner() {
  const router = useRouter()
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = params.orgSlug
  const { user, isLoading, signOutEverything } = useCurrentUser()
  const adminTab = useAppStore((s) => s.adminTab)
  const setAdminTab = useAppStore((s) => s.setAdminTab)
  const setCurrentOrgSlug = useAppStore((s) => s.setCurrentOrgSlug)

  // Sync the URL org slug into localStorage + store on mount and when slug changes.
  React.useEffect(() => {
    if (orgSlug) {
      setOrgSlug(orgSlug)
      setCurrentOrgSlug(orgSlug)
    }
  }, [orgSlug, setCurrentOrgSlug])

  const initialTab = adminTab

  React.useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace("/login")
    } else if (!user.canManageOrg) {
      router.replace("/dashboard")
    }
  }, [user, isLoading, router])

  // Listen for org-changed events (from OrgSwitcher) and update URL.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    function handleOrgChange(e: Event) {
      const detail = (e as CustomEvent<{ slug: string | null }>).detail
      if (detail?.slug && detail.slug !== orgSlug) {
        setCurrentOrgSlug(detail.slug)
        router.replace(`/org/${detail.slug}/admin`)
      }
    }
    window.addEventListener(ORG_CHANGED_EVENT_NAME, handleOrgChange)
    return () => window.removeEventListener(ORG_CHANGED_EVENT_NAME, handleOrgChange)
  }, [orgSlug, router, setCurrentOrgSlug])

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
      // URL will update via the ORG_CHANGED_EVENT listener above.
    },
    [setCurrentOrgSlug],
  )

  const handleOpenOrgSettings = React.useCallback(() => {}, [])

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
