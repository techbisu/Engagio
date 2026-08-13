"use client"

/**
 * /event/[eventSlug]
 *
 * Public event landing page — event details + quiz start CTA.
 *
 * Replaces the old `/?event=SLUG` query-param route.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { EventLandingPage } from "@/components/public/event-landing-page"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppNavigate } from "@/lib/nav"

export default function EventRoutePage() {
  const router = useRouter()
  const params = useParams<{ eventSlug: string }>()
  const navigate = useAppNavigate()
  const { user, refetch } = useCurrentUser()
  const eventSlug = params?.eventSlug ?? ""

  const handleStartQuiz = React.useCallback(
    (quizSlug: string) => {
      router.push(`/quiz/${encodeURIComponent(quizSlug)}`)
    },
    [router],
  )

  const handleSignIn = React.useCallback(async () => {
    // Re-fetch /api/me to pick up the freshly-signed-in user.
    await refetch()
    // Stay on the event landing page (user will see "Start Test").
  }, [refetch])

  return (
    <EventLandingPage
      eventSlug={eventSlug}
      user={user}
      onNavigate={navigate}
      onStartQuiz={handleStartQuiz}
      onSignIn={handleSignIn}
    />
  )
}
