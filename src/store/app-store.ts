"use client"

import { create } from "zustand"
import type { SafeUser, ViewName, AdminTab } from "@/types"

export type StudentSubView = "dashboard" | "quiz-start" | "quiz-runner"
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

  reset: () =>
    set({
      view: "landing",
      adminTab: "dashboard",
      studentSubView: "dashboard",
      quizSlug: null,
      quizMeta: null,
      lastAttemptId: null,
    }),
}))

/**
 * Read URL params on first load to support deep links:
 *   ?quiz=SLUG        → start at student quiz-start view (will require login)
 *   ?view=admin      → admin panel (will require login)
 *   ?view=login      → login page
 *   ?view=student    → student dashboard (will require login)
 */
export function parseInitialRoute(): {
  view: ViewName
  quizSlug: string | null
  adminTab: AdminTab
} {
  if (typeof window === "undefined") {
    return { view: "landing", quizSlug: null, adminTab: "dashboard" }
  }
  const params = new URLSearchParams(window.location.search)
  const quiz = params.get("quiz")
  const view = params.get("view") as ViewName | null
  const tab = params.get("tab") as AdminTab | null

  if (quiz) {
    return { view: "quiz", quizSlug: quiz, adminTab: "dashboard" }
  }
  if (view === "admin" || view === "login" || view === "student") {
    return { view, quizSlug: null, adminTab: tab || "dashboard" }
  }
  return { view: "landing", quizSlug: null, adminTab: "dashboard" }
}

/** Update URL without scrolling, so deep links stay shareable. */
export function syncUrl(view: ViewName, opts?: { quizSlug?: string | null }) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  url.searchParams.delete("quiz")
  url.searchParams.delete("view")
  if (view === "quiz" && opts?.quizSlug) {
    url.searchParams.set("quiz", opts.quizSlug)
  } else if (view === "admin" || view === "login" || view === "student") {
    url.searchParams.set("view", view)
  }
  window.history.replaceState({}, "", url.toString())
}
