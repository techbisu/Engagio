"use client"

/**
 * MarketingPageShell
 *
 * Shared layout for public marketing pages (about, privacy, terms, contact,
 * pricing, login). Wraps content with the site header + footer and handles
 * the standard navigation + sign-out wiring so each route file can stay
 * focused on its own content.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { SiteHeader } from "@/components/shared/site-header"
import { SiteFooter } from "@/components/shared/site-footer"
import { useAppNavigate } from "@/lib/nav"
import { useCurrentUser } from "@/components/shared/use-current-user"
import type { SafeUser } from "@/types"

interface MarketingPageShellProps {
  children: React.ReactNode
  /** Optional: render the header with a max-width constrained hero. */
  className?: string
}

export function MarketingPageShell({ children, className }: MarketingPageShellProps) {
  const router = useRouter()
  const navigate = useAppNavigate()
  const { user, signOutEverything } = useCurrentUser()

  const session = React.useMemo(
    () => (user ? ({ user } as { user: SafeUser }) : null),
    [user],
  )

  const handleSignOut = React.useCallback(async () => {
    await signOutEverything()
    router.push("/")
  }, [signOutEverything, router])

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader
        session={session}
        onNavigate={navigate}
        onSignOut={handleSignOut}
      />
      <main className={`flex-1 ${className ?? ""}`}>{children}</main>
      <SiteFooter onNavigate={navigate} />
    </div>
  )
}
