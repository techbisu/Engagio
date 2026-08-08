"use client"

import { create } from "zustand"
import type { SafeUser, ViewName, AdminTab } from "@/types"

export type StudentSubView =
  | "dashboard"
  | "quiz-start"
  | "quiz-runner"
  | "leaderboard"
  | "results"
  | "certificates"
export type QuizPhase = "start" | "active" | "done"

export interface QuizMeta {
  quizLinkId: string
  slug: string
  requireFullscreen: boolean
  timeLimit: number // minutes
  quizTitle?: string
}

interface AppState {
  // Session
  user: SafeUser | null
  setUser: (user: SafeUser | null) => void

  // Top-level view
  view: ViewName
  setView: (view: ViewName) => void

  // Admin tab
  adminTab: AdminTab
  setAdminTab: (tab: AdminTab) => void

  // Student quiz flow
  studentSubView: StudentSubView
  setStudentSubView: (v: StudentSubView) => void

  quizSlug: string | null
  setQuizSlug: (slug: string | null) => void

  quizMeta: QuizMeta | null
  setQuizMeta: (m: QuizMeta | null) => void

  // Last attempt id (for results view if needed)
  lastAttemptId: string | null
  setLastAttemptId: (id: string | null) => void

  // Public verify-token (when visiting /?verify=TOKEN)
  verifyToken: string | null
  setVerifyToken: (t: string | null) => void

  // Reset to landing
  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  view: "landing",
  setView: (view) => set({ view }),

  adminTab: "dashboard",
  setAdminTab: (adminTab) => set({ adminTab }),

  studentSubView: "dashboard",
  setStudentSubView: (studentSubView) => set({ studentSubView }),

  quizSlug: null,
  setQuizSlug: (quizSlug) => set({ quizSlug }),

  quizMeta: null,
  setQuizMeta: (quizMeta) => set({ quizMeta }),

  lastAttemptId: null,
  setLastAttemptId: (lastAttemptId) => set({ lastAttemptId }),

  verifyToken: null,
  setVerifyToken: (verifyToken) => set({ verifyToken }),

  reset: () =>
    set({
      view: "landing",
      adminTab: "dashboard",
      studentSubView: "dashboard",
      quizSlug: null,
      quizMeta: null,
      lastAttemptId: null,
      verifyToken: null,
    }),
}))

/**
 * Read URL params on first load to support deep links:
 *   ?quiz=SLUG        → start at student quiz-start view (will require login)
 *   ?view=admin      → admin panel (will require login)
 *   ?view=login      → login page
 *   ?view=student    → student dashboard (will require login)
 *   ?verify=TOKEN    → public verification page (no login needed)
 */
export function parseInitialRoute(): {
  view: ViewName
  quizSlug: string | null
  adminTab: AdminTab
  verifyToken: string | null
} {
  if (typeof window === "undefined") {
    return {
      view: "landing",
      quizSlug: null,
      adminTab: "dashboard",
      verifyToken: null,
    }
  }
  const params = new URLSearchParams(window.location.search)
  const quiz = params.get("quiz")
  const view = params.get("view") as ViewName | null
  const tab = params.get("tab") as AdminTab | null
  const verify = params.get("verify")

  // Public verify deep-link takes priority — no auth required.
  if (verify) {
    return {
      view: "verify",
      quizSlug: null,
      adminTab: "dashboard",
      verifyToken: verify,
    }
  }
  if (quiz) {
    return {
      view: "quiz",
      quizSlug: quiz,
      adminTab: "dashboard",
      verifyToken: null,
    }
  }
  if (view === "admin" || view === "login" || view === "student") {
    return {
      view,
      quizSlug: null,
      adminTab: tab || "dashboard",
      verifyToken: null,
    }
  }
  return {
    view: "landing",
    quizSlug: null,
    adminTab: "dashboard",
    verifyToken: null,
  }
}

/** Update URL without scrolling, so deep links stay shareable. */
export function syncUrl(view: ViewName, opts?: { quizSlug?: string | null; verifyToken?: string | null }) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  url.searchParams.delete("quiz")
  url.searchParams.delete("view")
  url.searchParams.delete("verify")
  if (view === "verify" && opts?.verifyToken) {
    url.searchParams.set("verify", opts.verifyToken)
  } else if (view === "quiz" && opts?.quizSlug) {
    url.searchParams.set("quiz", opts.quizSlug)
  } else if (view === "admin" || view === "login" || view === "student") {
    url.searchParams.set("view", view)
  }
  window.history.replaceState({}, "", url.toString())
}
