"use client"

import { create } from "zustand"
import type { SafeUser, ViewName, AdminTab, ActivityType } from "@/types"

export type StudentSubView =
  | "dashboard"
  | "quiz-start"
  | "quiz-runner"
  | "leaderboard"
  | "results"
  | "certificates"
  | "activity"
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

  // Active organization slug (persisted to localStorage via the org API helper).
  currentOrgSlug: string | null
  setCurrentOrgSlug: (slug: string | null) => void

  // Invitation token (deep-link ?invite=TOKEN)
  inviteToken: string | null
  setInviteToken: (token: string | null) => void

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

  // Public share-token (when visiting /?share=TOKEN)
  shareToken: string | null
  setShareToken: (t: string | null) => void

  // Activity deep-link (?activity=SLUG) — renders the participant activity join
  activitySlug: string | null
  setActivitySlug: (slug: string | null) => void

  // Live-display deep-link (?live=ID) — renders the projector view full-screen
  liveActivityId: string | null
  liveActivityType: ActivityType | null
  setLiveActivity: (id: string | null, type?: ActivityType | null) => void

  // Reset to landing
  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  view: "landing",
  setView: (view) => set({ view }),

  currentOrgSlug: null,
  setCurrentOrgSlug: (currentOrgSlug) => set({ currentOrgSlug }),

  inviteToken: null,
  setInviteToken: (inviteToken) => set({ inviteToken }),

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

  shareToken: null,
  setShareToken: (shareToken) => set({ shareToken }),

  activitySlug: null,
  setActivitySlug: (activitySlug) => set({ activitySlug }),

  liveActivityId: null,
  liveActivityType: null,
  setLiveActivity: (id, type = null) =>
    set({ liveActivityId: id, liveActivityType: type }),

  reset: () =>
    set({
      view: "landing",
      adminTab: "dashboard",
      studentSubView: "dashboard",
      quizSlug: null,
      quizMeta: null,
      lastAttemptId: null,
      verifyToken: null,
      shareToken: null,
      activitySlug: null,
      liveActivityId: null,
      liveActivityType: null,
      currentOrgSlug: null,
      inviteToken: null,
    }),
}))

/**
 * Read URL params on first load to support deep links:
 *   ?quiz=SLUG        → start at student quiz-start view (will require login)
 *   ?view=admin      → admin panel (will require login)
 *   ?view=login      → login page
 *   ?view=student    → student dashboard (will require login)
 *   ?verify=TOKEN    → public verification page (no login needed)
 *   ?share=TOKEN     → public shareable-achievement page (no login needed)
 *   ?activity=SLUG   → participant activity join view (will require login)
 *   ?live=ID         → projector live-display view (no auth — public audience view)
 *   ?invite=TOKEN    → accept an org invitation (requires login)
 */
export function parseInitialRoute(): {
  view: ViewName
  quizSlug: string | null
  adminTab: AdminTab
  verifyToken: string | null
  shareToken: string | null
  activitySlug: string | null
  liveActivityId: string | null
  inviteToken: string | null
} {
  if (typeof window === "undefined") {
    return {
      view: "landing",
      quizSlug: null,
      adminTab: "dashboard",
      verifyToken: null,
      shareToken: null,
      activitySlug: null,
      liveActivityId: null,
      inviteToken: null,
    }
  }
  const params = new URLSearchParams(window.location.search)
  const quiz = params.get("quiz")
  const view = params.get("view") as ViewName | null
  const tab = params.get("tab") as AdminTab | null
  const verify = params.get("verify")
  const share = params.get("share")
  const activity = params.get("activity")
  const live = params.get("live")
  const invite = params.get("invite")

  // Public verify deep-link takes priority — no auth required.
  if (verify) {
    return {
      view: "verify",
      quizSlug: null,
      adminTab: "dashboard",
      verifyToken: verify,
      shareToken: null,
      activitySlug: null,
      liveActivityId: null,
      inviteToken: null,
    }
  }
  // Public share deep-link — no auth required.
  if (share) {
    return {
      view: "share",
      quizSlug: null,
      adminTab: "dashboard",
      verifyToken: null,
      shareToken: share,
      activitySlug: null,
      liveActivityId: null,
      inviteToken: null,
    }
  }
  // Public live-display deep-link — no auth required (projector view).
  if (live) {
    return {
      view: "live-display",
      quizSlug: null,
      adminTab: "dashboard",
      verifyToken: null,
      shareToken: null,
      activitySlug: null,
      liveActivityId: live,
      inviteToken: null,
    }
  }
  // Org invitation deep-link — requires login (handled by page.tsx guard).
  if (invite) {
    return {
      view: "accept-invitation",
      quizSlug: null,
      adminTab: "dashboard",
      verifyToken: null,
      shareToken: null,
      activitySlug: null,
      liveActivityId: null,
      inviteToken: invite,
    }
  }
  if (activity) {
    return {
      view: "activity",
      quizSlug: null,
      adminTab: "dashboard",
      verifyToken: null,
      shareToken: null,
      activitySlug: activity,
      liveActivityId: null,
      inviteToken: null,
    }
  }
  if (quiz) {
    return {
      view: "quiz",
      quizSlug: quiz,
      adminTab: "dashboard",
      verifyToken: null,
      shareToken: null,
      activitySlug: null,
      liveActivityId: null,
      inviteToken: null,
    }
  }
  if (
    view === "admin" ||
    view === "login" ||
    view === "student" ||
    view === "org-onboarding" ||
    view === "org-dashboard" ||
    view === "org-settings" ||
    view === "pricing" ||
    view === "about" ||
    view === "privacy" ||
    view === "terms" ||
    view === "contact"
  ) {
    return {
      view,
      quizSlug: null,
      adminTab: tab || "dashboard",
      verifyToken: null,
      shareToken: null,
      activitySlug: null,
      liveActivityId: null,
      inviteToken: null,
    }
  }
  return {
    view: "landing",
    quizSlug: null,
    adminTab: "dashboard",
    verifyToken: null,
    shareToken: null,
    activitySlug: null,
    liveActivityId: null,
    inviteToken: null,
  }
}

/** Update URL without scrolling, so deep links stay shareable. */
export function syncUrl(
  view: ViewName,
  opts?: {
    quizSlug?: string | null
    verifyToken?: string | null
    shareToken?: string | null
    activitySlug?: string | null
    liveActivityId?: string | null
    inviteToken?: string | null
  },
) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  url.searchParams.delete("quiz")
  url.searchParams.delete("view")
  url.searchParams.delete("verify")
  url.searchParams.delete("share")
  url.searchParams.delete("activity")
  url.searchParams.delete("live")
  url.searchParams.delete("invite")
  if (view === "verify" && opts?.verifyToken) {
    url.searchParams.set("verify", opts.verifyToken)
  } else if (view === "share" && opts?.shareToken) {
    url.searchParams.set("share", opts.shareToken)
  } else if (view === "quiz" && opts?.quizSlug) {
    url.searchParams.set("quiz", opts.quizSlug)
  } else if (view === "activity" && opts?.activitySlug) {
    url.searchParams.set("activity", opts.activitySlug)
  } else if (view === "live-display" && opts?.liveActivityId) {
    url.searchParams.set("live", opts.liveActivityId)
  } else if (view === "accept-invitation" && opts?.inviteToken) {
    url.searchParams.set("invite", opts.inviteToken)
  } else if (
    view === "admin" ||
    view === "login" ||
    view === "student" ||
    view === "org-onboarding" ||
    view === "org-dashboard" ||
    view === "org-settings" ||
    view === "pricing" ||
    view === "about" ||
    view === "privacy" ||
    view === "terms" ||
    view === "contact"
  ) {
    url.searchParams.set("view", view)
  }
  window.history.replaceState({}, "", url.toString())
}
