"use client"

// Prevent static prerendering — this page uses useSearchParams() which
// requires a Suspense boundary during static generation.
export const dynamic = "force-dynamic"

/**
 * /dashboard
 *
 * Participant dashboard. Default landing for signed-in STUDENT users.
 *
 * Supports the following sub-views via URL search params (so they're
 * shareable + survive refresh):
 *
 *   /dashboard                            → StudentDashboard (overview)
 *   /dashboard?sub=certificates           → MyCertificates
 *   /dashboard?sub=leaderboard&quiz=SLUG  → Leaderboard for the given quiz
 *   /dashboard?sub=activity&activity=SLUG → ActivityJoin for the activity
 *
 * If the user is not signed in, redirects to /login.
 *
 * Replaces the old `/?view=student` query-param route (and the in-dashboard
 * sub-views: leaderboard, certificates, activity). The quiz-start /
 * quiz-runner sub-views now live on their own /quiz/[quizSlug] route.
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ActivityJoin } from "@/components/activities/activity-join"
import { Leaderboard } from "@/components/student/leaderboard"
import { MyCertificates } from "@/components/student/my-certificates"
import { StudentDashboard } from "@/components/student/student-dashboard"
import { StudentShell } from "@/components/student/student-shell"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppStore } from "@/store/app-store"
import type { ActivityType } from "@/types"

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, signOutEverything } = useCurrentUser()
  const setLiveActivity = useAppStore((s) => s.setLiveActivity)

  const sub = searchParams.get("sub") ?? ""
  const quizSlugParam = searchParams.get("quiz") ?? ""
  const activitySlugParam = searchParams.get("activity") ?? ""

  // Redirect to /login if not signed in. Wait for the session + meQuery to
  // finish before redirecting to avoid a flash on page reload.
  React.useEffect(() => {
    if (!user) {
      router.replace("/login")
    }
  }, [user, router])

  const handleSignOut = React.useCallback(async () => {
    await signOutEverything()
    router.push("/")
  }, [signOutEverything, router])

  const handleNavigateHome = React.useCallback(() => {
    router.push("/")
  }, [router])

  const handleNavigateMyCertificates = React.useCallback(() => {
    router.push("/dashboard?sub=certificates")
  }, [router])

  const handleStartQuiz = React.useCallback(
    (slug: string) => {
      router.push(`/quiz/${encodeURIComponent(slug)}`)
    },
    [router],
  )

  const handleViewLeaderboard = React.useCallback(
    (slug: string) => {
      router.push(`/dashboard?sub=leaderboard&quiz=${encodeURIComponent(slug)}`)
    },
    [router],
  )

  const handleActivityExit = React.useCallback(() => {
    router.push("/dashboard")
  }, [router])

  const handleActivityQuizRedirect = React.useCallback(
    (quizSlugValue: string) => {
      router.push(`/quiz/${encodeURIComponent(quizSlugValue)}`)
    },
    [router],
  )

  const handleOpenLiveDisplay = React.useCallback(
    (activityId: string, _type?: ActivityType) => {
      setLiveActivity(activityId, _type ?? null)
      router.push(`/live/${encodeURIComponent(activityId)}`)
    },
    [router, setLiveActivity],
  )

  // Loading state until session resolves (avoid flashing the login redirect).
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  // Sub-view: certificates
  if (sub === "certificates") {
    return (
      <StudentShell
        user={user}
        onSignOut={handleSignOut}
        onNavigateHome={handleNavigateHome}
        onNavigateMyCertificates={handleNavigateMyCertificates}
      >
        <MyCertificates />
      </StudentShell>
    )
  }

  // Sub-view: leaderboard
  if (sub === "leaderboard" && quizSlugParam) {
    return (
      <StudentShell
        user={user}
        onSignOut={handleSignOut}
        onNavigateHome={handleNavigateHome}
        onNavigateMyCertificates={handleNavigateMyCertificates}
      >
        <Leaderboard
          slug={quizSlugParam}
          onBack={() => router.push("/dashboard")}
        />
      </StudentShell>
    )
  }

  // Sub-view: activity
  if (sub === "activity" && activitySlugParam) {
    return (
      <StudentShell
        user={user}
        onSignOut={handleSignOut}
        onNavigateHome={handleNavigateHome}
      >
        <ActivityJoin
          slug={activitySlugParam}
          user={user}
          onExit={handleActivityExit}
          onOpenLiveDisplay={handleOpenLiveDisplay}
          onQuizRedirect={handleActivityQuizRedirect}
        />
      </StudentShell>
    )
  }

  // Default: dashboard overview
  return (
    <StudentShell
      user={user}
      onSignOut={handleSignOut}
      onNavigateHome={handleNavigateHome}
      onNavigateMyCertificates={handleNavigateMyCertificates}
    >
      <StudentDashboard
        user={user}
        onStartQuiz={handleStartQuiz}
        onViewLeaderboard={handleViewLeaderboard}
      />
    </StudentShell>
  )
}
