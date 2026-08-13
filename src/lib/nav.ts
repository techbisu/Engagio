"use client"

/**
 * useAppNavigate
 *
 * Centralized client-side navigation helper used by every App Router page
 * during the Phase 1 routing migration. Maps legacy `ViewName` values to
 * real file-based routes so existing components (SiteHeader, SiteFooter,
 * Hero, etc.) that still call `onNavigate(view)` keep working without
 * modification.
 *
 * Added during the Phase 1 routing migration.
 */

import { useRouter } from "next/navigation"
import { useCallback } from "react"
import type { ViewName } from "@/types"

const VIEW_TO_PATH: Partial<Record<ViewName, string>> = {
  landing: "/",
  login: "/login",
  admin: "/admin",
  student: "/dashboard",
  "org-register": "/org-register",
  "org-onboarding": "/org-register",
  pricing: "/pricing",
  about: "/about",
  privacy: "/privacy",
  terms: "/terms",
  contact: "/contact",
  superadmin: "/superadmin/login",
  platform: "/superadmin/login",
}

export function useAppNavigate() {
  const router = useRouter()

  return useCallback(
    (view: ViewName) => {
      const path = VIEW_TO_PATH[view]
      if (path) {
        router.push(path)
      } else {
        // Unknown views fall back to the landing page.
        router.push("/")
      }
    },
    [router],
  )
}

/**
 * Build the path for an event landing page.
 *   buildEventPath("medical-summit-2026") → "/event/medical-summit-2026"
 */
export function buildEventPath(eventSlug: string): string {
  return `/event/${encodeURIComponent(eventSlug)}`
}

/**
 * Build the path for an org landing page.
 */
export function buildOrgPath(orgSlug: string): string {
  return `/org/${encodeURIComponent(orgSlug)}`
}

/**
 * Build the path for a quiz deep-link.
 */
export function buildQuizPath(quizSlug: string): string {
  return `/quiz/${encodeURIComponent(quizSlug)}`
}

/**
 * Build the path for an activity deep-link.
 *
 * NOTE: Activities don't have a dedicated route yet (Phase 1 scope). They
 * still flow through the student dashboard with a query param. Future
 * phases can promote this to `/activity/[slug]`.
 */
export function buildActivityPath(activitySlug: string): string {
  return `/dashboard?activity=${encodeURIComponent(activitySlug)}`
}

/**
 * Build the path for the public certificate verify page.
 */
export function buildVerifyPath(token: string): string {
  return `/verify/${encodeURIComponent(token)}`
}

/**
 * Build the path for the public share page.
 */
export function buildSharePath(token: string): string {
  return `/share/${encodeURIComponent(token)}`
}
