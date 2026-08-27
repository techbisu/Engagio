"use client"

/**
 * /org/[orgSlug]/[eventSlug]/quiz/[quizSlug]
 *
 * Org-scoped quiz deep-link. Same behavior as /quiz/[quizSlug] but with
 * org/event context in the URL for SEO and user clarity.
 */

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { ParticipantGoogleLogin } from "@/components/auth/participant-google-login"
import { QuizStart } from "@/components/student/quiz-start"
import { QuizRunner } from "@/components/quiz/quiz-runner"
import { StudentShell } from "@/components/student/student-shell"
import { SiteHeader } from "@/components/shared/site-header"
import { SiteFooter } from "@/components/shared/site-footer"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppNavigate } from "@/lib/nav"
import { useAppStore, type QuizMeta } from "@/store/app-store"

export default function OrgQuizRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <OrgQuizRoutePageInner />
    </Suspense>
  )
}

function OrgQuizRoutePageInner() {
  const router = useRouter()
  const params = useParams<{ orgSlug: string; eventSlug: string; quizSlug: string }>()
  const navigate = useAppNavigate()
  const { user, refetch, signOutEverything } = useCurrentUser()
  const quizSlug = params?.quizSlug ?? ""
  const orgSlug = params?.orgSlug ?? ""
  const eventSlug = params?.eventSlug ?? ""

  const quizMeta = useAppStore((s) => s.quizMeta)
  const setQuizMeta = useAppStore((s) => s.setQuizMeta)

  const orgDashboard = "/org/" + orgSlug + "/participant/dashboard"

  const handleBegin = React.useCallback(
    (meta: {
      quizLink: { id: string }
      event?: { title?: string } | null
      timeLimit: number
      requireFullscreen: boolean
    }) => {
      const m: QuizMeta = {
        quizLinkId: meta.quizLink.id,
        slug: quizSlug,
        requireFullscreen: meta.requireFullscreen,
        timeLimit: meta.timeLimit,
        quizTitle: meta.event?.title,
      }
      setQuizMeta(m)
    },
    [quizSlug, setQuizMeta],
  )

  const handleQuizExit = React.useCallback(() => {
    setQuizMeta(null)
    router.push(orgDashboard)
  }, [setQuizMeta, router, orgDashboard])

  const handleBack = React.useCallback(() => {
    setQuizMeta(null)
    router.push(orgDashboard)
  }, [setQuizMeta, router, orgDashboard])

  const handleSignOut = React.useCallback(async () => {
    await signOutEverything()
    router.push("/")
  }, [signOutEverything, router])

  const handleNavigateHome = React.useCallback(() => {
    router.push("/org/" + orgSlug)
  }, [router, orgSlug])

  // Quiz runner takes over the whole screen.
  if (user && quizMeta) {
    return (
      <QuizRunner
        quizLinkId={quizMeta.quizLinkId}
        requireFullscreen={quizMeta.requireFullscreen}
        timeLimit={quizMeta.timeLimit}
        quizTitle={quizMeta.quizTitle}
        user={user}
        onExit={handleQuizExit}
      />
    )
  }

  // Authed → render QuizStart inside StudentShell
  if (user) {
    return (
      <StudentShell
        user={user}
        onSignOut={handleSignOut}
        onNavigateHome={handleNavigateHome}
      >
        <QuizStart
          slug={quizSlug}
          user={user}
          onBegin={handleBegin}
          onBack={handleBack}
        />
      </StudentShell>
    )
  }

  // Not authed → show participant login
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader session={null} onNavigate={navigate} onSignOut={handleSignOut} />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="space-y-6">
          <ParticipantGoogleLogin
            callbackUrl={"/org/" + orgSlug + "/" + eventSlug + "/quiz/" + quizSlug}
            className="w-full"
          />
          <p className="text-center text-sm text-white/60">
            Sign in with Google to take this quiz.
          </p>
        </div>
      </main>
      <SiteFooter onNavigate={navigate} />
    </div>
  )
}
