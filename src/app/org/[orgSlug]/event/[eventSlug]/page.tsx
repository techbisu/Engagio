"use client"

/**
 * /org/[orgSlug]/event/[eventSlug]
 *
 * Public event landing page — event details + quiz start CTA.
 *
 * Org-scoped variant of the event landing page URL.
 */

import * as React from "react"
import { useRouter, useParams, Suspense } from "next/navigation"
import { EventLandingPage } from "@/components/public/event-landing-page"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppNavigate } from "@/lib/nav"

function OrgEventRoutePageContent() {
  const router = useRouter()
  const params = useParams<{ orgSlug: string; eventSlug: string }>()
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

export default function OrgEventRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <OrgEventRoutePageContent />
    </Suspense>
  )
}
