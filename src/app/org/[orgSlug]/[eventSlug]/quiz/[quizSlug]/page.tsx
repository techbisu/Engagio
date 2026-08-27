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
import { QuizStart } from "@/components/student/quiz-start"
import { QuizRunner } from "@/components/quiz/quiz-runner"
import { StudentShell } from "@/components/student/student-shell"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppStore, type QuizMeta } from "@/store/app-store"
import {
  QuizLandingPublic,
  type PublicQuizMeta,
} from "@/components/student/quiz-landing-public"

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
  const { user, signOutEverything } = useCurrentUser()
  const quizSlug = params?.quizSlug ?? ""
  const orgSlug = params?.orgSlug ?? ""
  const eventSlug = params?.eventSlug ?? ""

  const quizMeta = useAppStore((s) => s.quizMeta)
  const setQuizMeta = useAppStore((s) => s.setQuizMeta)

  // Fetch quiz metadata for the public landing page (shown when unauthenticated).
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
      })
      .catch(() => {
        setNotFound(true)
      })
      .finally(() => setMetaLoading(false))
  }, [quizSlug])

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

  // Not authed → show public landing with event info + Google login.
  // This replaces the old blank page with only a Google login button.
  return (
    <QuizLandingPublic
      meta={publicMeta}
      loading={metaLoading}
      notFound={notFound}
      callbackUrl={"/org/" + orgSlug + "/" + eventSlug + "/quiz/" + quizSlug}
      onBack={() => router.push("/org/" + orgSlug)}
    />
  )
}
