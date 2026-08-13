"use client"

/**
 * /quiz/[quizSlug]
 *
 * Quiz deep-link. Handles the full participant quiz flow:
 *   - Not authed → ParticipantLogin (inline, with site header/footer)
 *   - Authed, no quizMeta → QuizStart (inside StudentShell)
 *   - Authed, quizMeta set → QuizRunner (full-screen, takes over the page)
 *
 * Replaces the old `/?quiz=SLUG` query-param route (and the in-dashboard
 * quiz-runner / quiz-start sub-views).
 *
 * Added during the Phase 1 routing migration.
 */

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { ParticipantLogin } from "@/components/auth/participant-login"
import { QuizStart } from "@/components/student/quiz-start"
import { QuizRunner } from "@/components/quiz/quiz-runner"
import { StudentShell } from "@/components/student/student-shell"
import { SiteHeader } from "@/components/shared/site-header"
import { SiteFooter } from "@/components/shared/site-footer"
import { useCurrentUser } from "@/components/shared/use-current-user"
import { useAppNavigate } from "@/lib/nav"
import { useAppStore, type QuizMeta } from "@/store/app-store"

export default function QuizRoutePage() {
  const router = useRouter()
  const params = useParams<{ quizSlug: string }>()
  const navigate = useAppNavigate()
  const { user, refetch, signOutEverything } = useCurrentUser()
  const quizSlug = params?.quizSlug ?? ""

  const quizMeta = useAppStore((s) => s.quizMeta)
  const setQuizMeta = useAppStore((s) => s.setQuizMeta)

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

  // Quiz runner takes over the whole screen (no shell chrome).
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

  // Not authed → show participant login (with event context)
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader session={null} onNavigate={navigate} onSignOut={handleSignOut} />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <ParticipantLogin
          slug={quizSlug}
          onSuccess={async () => {
            // After participant login:
            // 1. Fetch the user
            // 2. Auto-register them as a PARTICIPANT in the event's org
            // 3. Stay on this page — user state will update and re-render
            //    the QuizStart component above.
            await refetch()

            // Auto-register as participant in the org that owns this event.
            // Idempotent — safe if already a member.
            try {
              await fetch("/api/events/register-participant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quizSlug }),
              })
            } catch {
              // Non-blocking — the quiz still works even if registration fails
              toast.error("Could not auto-register you as a participant.")
            }
          }}
        />
      </main>
      <SiteFooter onNavigate={navigate} />
    </div>
  )
}
