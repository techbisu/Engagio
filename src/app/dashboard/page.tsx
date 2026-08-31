"use client"

/**
 * /dashboard — Participant dashboard.
 *
 * Wrapped in <Suspense> because useSearchParams() requires a Suspense
 * boundary during prerendering in Next.js 16 / Turbopack.
 */

import * as React from "react"
import { Suspense } from "react"
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
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <DashboardPageInner />
    </Suspense>
  )
}

function DashboardPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, signOutEverything } = useCurrentUser()
  const setLiveActivity = useAppStore((s) => s.setLiveActivity)
  // Read the current org slug from the app store (populated by the org
  // switcher / localStorage). Passed to StudentDashboard so the API calls
  // are scoped to this org only.
  const currentOrgSlug = useAppStore((s) => s.currentOrgSlug)

  const sub = searchParams.get("sub") ?? ""
  const quizSlugParam = searchParams.get("quiz") ?? ""
  const activitySlugParam = searchParams.get("activity") ?? ""

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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

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
        orgSlug={currentOrgSlug ?? undefined}
      />
    </StudentShell>
  )
}
