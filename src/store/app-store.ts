"use client"

/**
 * Engagio client-side UI state.
 *
 * After the Phase 1 routing migration, the Zustand store is for genuinely
 * client-only / cross-page state ONLY. View routing is handled by the
 * Next.js App Router (file-based routes in src/app/).
 *
 * What lives here:
 *   - `user`             : the signed-in user (mirrored from useCurrentUser
 *                          so legacy components like leaderboard.tsx can
 *                          read it without prop-drilling)
 *   - `currentOrgSlug`   : the active organization slug (persisted to
 *                          localStorage via the org API helper)
 *   - `inviteToken`      : the invite token from a /invite/[token] deep-link
 *                          (stashed here so /login can route the user back
 *                          to the invite page after sign-in)
 *   - `adminTab`         : the active admin sub-tab (preserved across
 *                          navigations within /admin)
 *   - `quizMeta`         : the in-progress quiz attempt metadata (set when
 *                          the user clicks "Begin" on QuizStart, consumed
 *                          by QuizRunner)
 *   - `liveActivityId`   : the live-display projector activity id (set when
 *                          the user opens /live/[activityId])
 *   - `view`             : INTERNAL — used only by /superadmin/login to
 *                          toggle between "platform" and "superadmin-security"
 *                          sub-views. Do NOT use for top-level routing.
 *
 * What no longer lives here (moved to URL routes):
 *   - quizSlug, eventSlug, orgSlug, activitySlug, verifyToken, shareToken
 *   - studentSubView
 *   - parseInitialRoute(), syncUrl() — removed; the App Router handles
 *     URL→route resolution now.
 */

import { create } from "zustand"
import type { SafeUser, ViewName, ActivityType } from "@/types"

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

  // Internal sub-view state used by /superadmin/login to toggle between
  // "platform" (PlatformAdminShell) and "superadmin-security" (TOTP setup).
  // Kept in the store because the toggle is purely client-side UI state.
  view: ViewName
  setView: (view: ViewName) => void

  // Active organization slug (persisted to localStorage via the org API helper).
  currentOrgSlug: string | null
  setCurrentOrgSlug: (slug: string | null) => void

  // Invitation token (deep-link /invite/[token]). Stashed here so /login
  // can route the user back to the invite page after sign-in.
  inviteToken: string | null
  setInviteToken: (token: string | null) => void

  // Admin tab (preserved across navigations within /admin).
  adminTab: "dashboard" | "events" | "questions" | "links" | "activities" | "attempts" | "users" | "payments" | "certificates" | "results" | "gatepasses"
  setAdminTab: (tab: "dashboard" | "events" | "questions" | "links" | "activities" | "attempts" | "users" | "payments" | "certificates" | "results" | "gatepasses") => void

  // In-progress quiz attempt metadata. Set when the user clicks "Begin" on
  // QuizStart; consumed by QuizRunner (which takes over the screen).
  quizMeta: QuizMeta | null
  setQuizMeta: (m: QuizMeta | null) => void

  // Last attempt id (kept for legacy code that may reference it).
  lastAttemptId: string | null
  setLastAttemptId: (id: string | null) => void

  // Live-display projector activity (set when the user opens /live/[id]).
  liveActivityId: string | null
  liveActivityType: ActivityType | null
  setLiveActivity: (id: string | null, type?: ActivityType | null) => void

  // Reset to defaults (used on sign-out).
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

  quizMeta: null,
  setQuizMeta: (quizMeta) => set({ quizMeta }),

  lastAttemptId: null,
  setLastAttemptId: (lastAttemptId) => set({ lastAttemptId }),

  liveActivityId: null,
  liveActivityType: null,
  setLiveActivity: (id, type = null) =>
    set({ liveActivityId: id, liveActivityType: type }),

  reset: () =>
    set({
      view: "landing",
      adminTab: "dashboard",
      quizMeta: null,
      lastAttemptId: null,
      liveActivityId: null,
      liveActivityType: null,
      currentOrgSlug: null,
      inviteToken: null,
    }),
}))
