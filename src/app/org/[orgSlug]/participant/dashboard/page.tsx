"use client"

/**
 * /org/[orgSlug]/participant/dashboard
 *
 * Org-scoped participant dashboard showing registered events, activities, and quiz attempts.
 */

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { ActivityJoin } from "@/components/activities/activity-join"
import { Leaderboard } from "@/components/student/leaderboard"
import { MyCertificates } from "@/components/student/my-certificates"
import { StudentDashboard } from "@/components/student/student-dashboard"
import { StudentShell } from "@/components/student/student-shell"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppStore } from "@/store/app-store"
import { setOrgSlug, ORG_CHANGED_EVENT_NAME } from "@/components/organization/api"
import type { ActivityType } from "@/types"

export default function ParticipantDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <ParticipantDashboardInner />
    </Suspense>
  )
}

function ParticipantDashboardInner() {
  const router = useRouter()
  const params = useParams<{ orgSlug: string }>()
  const searchParams = useSearchParams()
  const orgSlug = params.orgSlug
  const { user, isLoading, signOutEverything } = useCurrentUser()
  const setLiveActivity = useAppStore((s) => s.setLiveActivity)

  const sub = searchParams.get("sub") ?? ""
  const quizSlugParam = searchParams.get("quiz") ?? ""
  const activitySlugParam = searchParams.get("activity") ?? ""

  // Sync org slug into localStorage on mount.
  React.useEffect(() => {
    if (orgSlug) {
      setOrgSlug(orgSlug)
    }
  }, [orgSlug])

  // Redirect to login if not authenticated.
  React.useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login")
    }
  }, [user, isLoading, router])

  const handleSignOut = React.useCallback(async () => {
    await signOutEverything()
    router.push("/")
  }, [signOutEverything, router])

  const handleNavigateHome = React.useCallback(() => {
    router.push("/org/" + orgSlug)
  }, [router, orgSlug])

  const handleNavigateMyCertificates = React.useCallback(() => {
    router.push("/org/" + orgSlug + "/participant/dashboard?sub=certificates")
  }, [router, orgSlug])

  const handleStartQuiz = React.useCallback(
    (slug: string) => {
      router.push("/quiz/" + encodeURIComponent(slug))
    },
    [router],
  )

  const handleViewLeaderboard = React.useCallback(
    (slug: string) => {
      router.push("/org/" + orgSlug + "/participant/dashboard?sub=leaderboard&quiz=" + encodeURIComponent(slug))
    },
    [router, orgSlug],
  )

  const handleActivityExit = React.useCallback(() => {
    router.push("/org/" + orgSlug + "/participant/dashboard")
  }, [router, orgSlug])

  const handleActivityQuizRedirect = React.useCallback(
    (quizSlugValue: string) => {
      router.push("/quiz/" + encodeURIComponent(quizSlugValue))
    },
    [router],
  )

  const handleOpenLiveDisplay = React.useCallback(
    (activityId: string, _type?: ActivityType) => {
      setLiveActivity(activityId, _type ?? null)
      router.push("/live/" + encodeURIComponent(activityId))
    },
    [router, setLiveActivity],
  )

  if (isLoading || !user) {
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
          onBack={() => router.push("/org/" + orgSlug + "/participant/dashboard")}
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
      />
    </StudentShell>
  )
}
