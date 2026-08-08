"use client"

import * as React from "react"
import { useSession, signOut } from "next-auth/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  useAppStore,
  parseInitialRoute,
  syncUrl,
  type QuizMeta,
} from "@/store/app-store"
import type { SafeUser } from "@/types"

import { SiteHeader } from "@/components/shared/site-header"
import { SiteFooter } from "@/components/shared/site-footer"
import { LoginForm } from "@/components/auth/login-form"

import { Hero } from "@/components/landing/hero"
import { Features } from "@/components/landing/features"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Faq } from "@/components/landing/faq"
import { CtaSection } from "@/components/landing/cta-section"

import { AdminShell } from "@/components/admin/admin-shell"
import { StudentShell } from "@/components/student/student-shell"
import { StudentDashboard } from "@/components/student/student-dashboard"
import { QuizStart } from "@/components/student/quiz-start"
import { QuizRunner } from "@/components/quiz/quiz-runner"

/**
 * Helper: GET /api/me → returns { id, email, name, image, role } or null.
 * Used as the source of truth for the current user on the client.
 */
async function fetchMe(): Promise<SafeUser | null> {
  try {
    const res = await fetch("/api/me", { credentials: "include" })
    if (!res.ok) return null
    const data = await res.json()
    return (data as SafeUser) ?? null
  } catch {
    return null
  }
}

export default function Home() {
  // --- Hydrate initial view from URL on first client render --------------
  const [hydrated, setHydrated] = React.useState(false)
  const {
    view,
    setView,
    adminTab,
    setAdminTab,
    studentSubView,
    setStudentSubView,
    quizSlug,
    setQuizSlug,
    quizMeta,
    setQuizMeta,
    user,
    setUser,
  } = useAppStore()

  React.useEffect(() => {
    if (hydrated) return
    const initial = parseInitialRoute()
    setView(initial.view)
    setAdminTab(initial.adminTab)
    if (initial.quizSlug) setQuizSlug(initial.quizSlug)
    setHydrated(true)
  }, [hydrated, setView, setAdminTab, setQuizSlug])

  // --- Session sync -------------------------------------------------------
  // We use NextAuth's useSession for live auth state changes (e.g., after
  // signIn/signOut) and reconcile it with the Zustand store. We also fetch
  // /api/me as a fallback to ensure role + id are always populated (the
  // JWT session sometimes lacks the freshly-set role on first sign-in).
  const { data: session, status: sessionStatus } = useSession()

  const meQuery = useQuery({
    queryKey: ["me", session?.user?.email ?? "anon"],
    queryFn: fetchMe,
    enabled: sessionStatus !== "loading",
    staleTime: 60_000,
  })

  React.useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data)
    } else if (meQuery.isError || (sessionStatus === "unauthenticated" && !meQuery.isLoading)) {
      setUser(null)
    }
  }, [meQuery.data, meQuery.isError, meQuery.isLoading, sessionStatus, setUser])

  // --- URL sync ----------------------------------------------------------
  React.useEffect(() => {
    syncUrl(view, { quizSlug })
  }, [view, quizSlug])

  // --- Routing guards ----------------------------------------------------
  // If user lands on a protected view without a session, redirect to login.
  React.useEffect(() => {
    if (sessionStatus === "loading") return
    const isAuthed = !!user
    if (!isAuthed && (view === "admin" || view === "student")) {
      setView("login")
    }
    // Quiz view: show login first if not authed; the quiz-start screen
    // will be rendered after auth.
    if (!isAuthed && view === "quiz") {
      setView("login")
    }
  }, [view, user, sessionStatus, setView])

  // --- Handlers ----------------------------------------------------------
  const queryClient = useQueryClient()

  const handleSignOut = React.useCallback(async () => {
    await signOut({ redirect: false })
    // Clear ALL cached queries so the next user doesn't see the previous
    // user's data (attempts, analytics, etc.).
    queryClient.clear()
    setUser(null)
    setView("landing")
  }, [setUser, setView, queryClient])

  const handleLoginSuccess = React.useCallback(
    async (role: string) => {
      // Fetch the freshly-issued session user BEFORE switching views so the
      // protected-view guard doesn't bounce us back to login.
      const me = await fetchMe()
      if (me) {
        setUser(me)
        // Refetch the React Query cache so useSession-derived queries stay in sync.
        meQuery.refetch()
        if (me.role === "ADMIN" || role === "ADMIN") {
          setView("admin")
        } else {
          if (quizSlug) {
            setStudentSubView("quiz-start")
            setView("student")
          } else {
            setStudentSubView("dashboard")
            setView("student")
          }
        }
      } else {
        // Couldn't fetch /me — fall back to the React Query refetch path.
        meQuery.refetch()
      }
    },
    [meQuery, setView, setStudentSubView, setUser, quizSlug],
  )

  const handleNavigate = React.useCallback(
    (target: typeof view) => {
      if (target === "admin" || target === "student") {
        if (!user) {
          setView("login")
          return
        }
      }
      setView(target)
    },
    [user, setView],
  )

  const handleStartQuiz = React.useCallback(
    (slug: string) => {
      setQuizSlug(slug)
      setStudentSubView("quiz-start")
      setView("student")
    },
    [setQuizSlug, setStudentSubView, setView],
  )

  const handleQuizBegin = React.useCallback(
    (meta: {
      quizLink: { id: string }
      event?: { title?: string } | null
      timeLimit: number
      requireFullscreen: boolean
    }) => {
      const m: QuizMeta = {
        quizLinkId: meta.quizLink.id,
        slug: quizSlug ?? "",
        requireFullscreen: meta.requireFullscreen,
        timeLimit: meta.timeLimit,
        quizTitle: meta.event?.title,
      }
      setQuizMeta(m)
      setStudentSubView("quiz-runner")
    },
    [quizSlug, setQuizMeta, setStudentSubView],
  )

  const handleQuizExit = React.useCallback(() => {
    setQuizMeta(null)
    setQuizSlug(null)
    setStudentSubView("dashboard")
    setView("student")
  }, [setQuizMeta, setQuizSlug, setStudentSubView, setView])

  // --- Render ------------------------------------------------------------
  if (sessionStatus === "loading" && !hydrated) {
    // Initial paint: minimal shell to avoid hydration mismatch
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      </div>
    )
  }

  // ADMIN VIEW
  if (view === "admin" && user && user.role === "ADMIN") {
    return (
      <AdminShell
        user={user}
        initialTab={adminTab}
        onTabChange={setAdminTab}
        onSignOut={handleSignOut}
        onNavigate={(v) => setView(v)}
      />
    )
  }

  // STUDENT VIEW (dashboard + quiz-start + quiz-runner)
  if (view === "student" && user) {
    let content: React.ReactNode
    if (studentSubView === "quiz-runner" && quizMeta) {
      // The quiz runner takes over the whole screen (no shell chrome).
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
    if (studentSubView === "quiz-start" && quizSlug) {
      content = (
        <QuizStart
          slug={quizSlug}
          user={user}
          onBegin={handleQuizBegin}
          onBack={() => {
            setQuizSlug(null)
            setStudentSubView("dashboard")
          }}
        />
      )
    } else {
      content = <StudentDashboard user={user} onStartQuiz={handleStartQuiz} />
    }
    return (
      <StudentShell
        user={user}
        onSignOut={handleSignOut}
        onNavigateHome={() => setView("landing")}
      >
        {content}
      </StudentShell>
    )
  }

  // QUIZ deep-link view: requires auth. If authed, route to student quiz-start.
  if (view === "quiz" && quizSlug) {
    if (user) {
      return (
        <StudentShell
          user={user}
          onSignOut={handleSignOut}
          onNavigateHome={() => setView("landing")}
        >
          <QuizStart
            slug={quizSlug}
            user={user}
            onBegin={handleQuizBegin}
            onBack={() => {
              setQuizSlug(null)
              setStudentSubView("dashboard")
              setView("student")
            }}
          />
        </StudentShell>
      )
    }
    // Not authed — fall through to login (guard already redirected).
  }

  // LOGIN VIEW
  if (view === "login") {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader session={null} onNavigate={handleNavigate} onSignOut={handleSignOut} />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <LoginForm onSuccess={handleLoginSuccess} />
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }

  // LANDING VIEW (default)
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader
        session={user ? { user } : null}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
      />
      <main className="flex-1">
        <Hero onNavigate={handleNavigate} />
        <Features />
        <HowItWorks />
        <Faq />
        <CtaSection onNavigate={handleNavigate} />
      </main>
      <SiteFooter />
    </div>
  )
}
