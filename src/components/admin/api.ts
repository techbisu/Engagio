"use client"

/**
 * Shared API helper for admin components.
 * Assumes backend routes return JSON; throws an Error on non-2xx with the
 * server-provided `error` message (or a generic fallback).
 */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm =
    typeof FormData !== "undefined" && init?.body instanceof FormData

  // Read the active org slug so the server resolves the correct tenant context.
  const orgSlug = typeof window !== "undefined" ? localStorage.getItem("engagio-org-slug") : null;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(orgSlug ? { "x-org-slug": orgSlug } : {}),
      ...(init?.headers || {}),
    },
  })

  if (!res.ok) {
    const e = await res.json().catch(() => ({} as Record<string, unknown>))
    const message =
      (e && typeof e === "object" && "error" in e && typeof e.error === "string"
        ? e.error
        : null) || `Request failed: ${res.status}`
    throw new Error(message)
  }

  // Some endpoints (e.g. DELETE) may return no content.
  const text = await res.text()
  if (!text) return undefined as unknown as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

export interface AnalyticsPayload {
  totalEvents: number
  totalQuestions: number
  totalQuizLinks: number
  totalAttempts: number
  completedAttempts: number
  cheatDetected: number
  avgScore: number | null
  passRate: number | null
  recentAttempts?: Array<{
    id: string
    startedAt: string
    status: string
  }>
  attemptsOverTime?: Array<{ date: string; count: number }>
  scoreBuckets?: Array<{ bucket: string; count: number }>
  topEvents?: Array<{
    id: string
    title: string
    attemptCount: number
  }>
}
