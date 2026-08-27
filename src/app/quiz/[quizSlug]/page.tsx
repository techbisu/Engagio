"use client"

/**
 * /quiz/[quizSlug]
 *
 * Backward-compat quiz deep-link. Fetches the quiz metadata to get
 * org/event slugs, then redirects to /org/{orgSlug}/{eventSlug}/quiz/{slug}.
 * If the user is unauthenticated, shows a public landing page with event
 * info + Google login (instead of a blank page with only a Google button).
 * Falls back to inline rendering if the redirect fails (e.g. missing org data).
 */

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useParams } from "next/navigation"
import { QuizStart } from "@/components/student/quiz-start"
import { QuizRunner } from "@/components/quiz/quiz-runner"
import { StudentShell } from "@/components/student/student-shell"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppStore, type QuizMeta } from "@/store/app-store"
import {
  QuizLandingPublic,
  type PublicQuizMeta,
} from "@/components/student/quiz-landing-public"

export default function QuizRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <QuizRoutePageInner />
    </Suspense>
  )
}

function QuizRoutePageInner() {
  const router = useRouter()
  const params = useParams<{ quizSlug: string }>()
  const { user, refetch, signOutEverything } = useCurrentUser()
  const quizSlug = params?.quizSlug ?? ""

  const quizMeta = useAppStore((s) => s.quizMeta)
  const setQuizMeta = useAppStore((s) => s.setQuizMeta)

  // Fetch quiz metadata to get org/event slugs, then redirect.
  // Also used by the public landing page to show event info.
  const [publicMeta, setPublicMeta] = React.useState<PublicQuizMeta | null>(null)
  const [metaLoading, setMetaLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)

  React.useEffect(() => {
    if (!quizSlug) return
    setMetaLoading(true)
    fetch("/api/quiz-links/by-slug/" + encodeURIComponent(quizSlug))
      .then((r) => {
        if (!r.ok) {
          setNotFound(true)
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setPublicMeta(data as PublicQuizMeta)
        // Redirect to the org-scoped URL if we have the slugs AND the user
        // is authenticated (so the redirect target renders the quiz start).
        // For unauthenticated users, we show the public landing here instead
        // of redirecting — the org-scoped page would show the same landing
        // anyway, and staying here avoids a confusing double-redirect.
        if (data?.orgSlug && data?.eventSlug && user) {
          router.replace(
            "/org/" + data.orgSlug + "/" + data.eventSlug + "/quiz/" + quizSlug,
          )
        }
      })
      .catch(() => {
        setNotFound(true)
      })
      .finally(() => setMetaLoading(false))
  }, [quizSlug, router, user])

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
    router.push("/dashboard")
  }, [setQuizMeta, router])

  const handleBack = React.useCallback(() => {
    setQuizMeta(null)
    router.push("/dashboard")
  }, [setQuizMeta, router])

  const handleSignOut = React.useCallback(async () => {
    await signOutEverything()
    router.push("/")
  }, [signOutEverything, router])

  const handleNavigateHome = React.useCallback(() => {
    router.push("/")
  }, [router])

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

  // Authed → render QuizStart (will redirect to org-scoped URL)
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

  // Not authed → show public landing with event info + Google login.
  // This replaces the old blank page with only a Google login button.
  return (
    <QuizLandingPublic
      meta={publicMeta}
      loading={metaLoading}
      notFound={notFound}
      callbackUrl={"/quiz/" + quizSlug}
      onBack={() => router.push("/")}
    />
  )
}
