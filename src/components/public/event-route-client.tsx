"use client"

/**
 * EventRouteClient — client-side rendering of the public event landing
 * experience. Used as the fallback when the /event/[eventSlug] legacy path
 * cannot resolve the org slug server-side, so visitors always get a working
 * page (or a graceful "not found") instead of a crash.
 */

import * as React from "react"
import { useRouter, Suspense } from "next/navigation"
import { EventLandingPage } from "@/components/public/event-landing-page"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppNavigate } from "@/lib/nav"

function EventRouteClientContent({ eventSlug }: { eventSlug: string }) {
  const router = useRouter()
  const navigate = useAppNavigate()
  const { user, refetch } = useCurrentUser()

  const handleStartQuiz = React.useCallback(
    (quizSlug: string) => {
      router.push(`/quiz/${encodeURIComponent(quizSlug)}`)
    },
    [router],
  )

  const handleSignIn = React.useCallback(async () => {
    await refetch()
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

export function EventRouteClient({ eventSlug }: { eventSlug: string }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <EventRouteClientContent eventSlug={eventSlug} />
    </Suspense>
  )
}
