"use client"

/**
 * /org/[orgSlug]
 *
 * Public organization landing page — lists an organization's events.
 *
 * Replaces the old `/?org=SLUG` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { OrgLandingPage } from "@/components/public/org-landing-page"
import { useAppNavigate } from "@/lib/nav"
import { useCurrentUser } from "@/components/shared/use-current-user"

export default function OrgRoutePage() {
  const router = useRouter()
  const params = useParams<{ orgSlug: string }>()
  const navigate = useAppNavigate()
  const { user } = useCurrentUser()
  const orgSlug = params?.orgSlug ?? ""

  const handleOpenEvent = React.useCallback(
    (eventSlug: string) => {
      router.push(`/org/${encodeURIComponent(orgSlug)}/event/${encodeURIComponent(eventSlug)}`)
    },
    [router, orgSlug],
  )

  return (
    <OrgLandingPage
      orgSlug={orgSlug}
      user={user}
      onNavigate={navigate}
      onOpenEvent={handleOpenEvent}
    />
  )
}
