"use client"

import type { QuizLinkDto } from "@/types"

/**
 * Shared fetch helper for the student-facing API surface.
 * Always sends JSON content-type, surfaces server error messages,
 * and works with relative Next.js API routes only.
 */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error((e as { error?: string }).error || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ---- DTOs returned by the student APIs ------------------------------------

export interface QuizLinkBySlugResponse {
  quizLink: QuizLinkDto
  event: {
    id: string
    title: string
    description?: string | null
    image?: string | null
  } | null
  questionCount: number
  timeLimit: number
  passThreshold: number
  maxAttempts: number
  requireFullscreen: boolean
  isActive: boolean
  hasExpired: boolean
  // When true, the student must fill out the event registration form
  // (fetched via GET /api/events/[eventId]/fields) before they can start
  // the quiz. The QuizStart screen renders a RegistrationForm in that case.
  requireRegistration?: boolean
  fieldCount?: number
}

export interface EventFieldDto {
  id: string
  eventId: string
  label: string
  type:
    | "text"
    | "email"
    | "number"
    | "tel"
    | "textarea"
    | "select"
    | "checkbox"
    | "date"
  required: boolean
  placeholder?: string | null
  helpText?: string | null
  options: string[]
  order: number
  createdAt: string
}

export interface PublicQuestion {
  id: string
  question: string
  options: string[]
  marks: number
  order: number
}

export interface StartAttemptResponse {
  attemptId: string
  questions: PublicQuestion[]
  timeLimit: number
  totalQuestions: number
  totalMarks: number
}

export type SubmitStatus =
  | "COMPLETED"
  | "CHEAT_DETECTED"
  | "TIMEOUT"

export interface SubmitAttemptResponse {
  attemptId: string
  status: SubmitStatus
  score: number
  totalMarks: number
  percentage: number
  passed: boolean
  timeTaken?: number
  showResults: boolean
}

export interface AttemptReviewQuestion {
  id: string
  order: number
  question: string
  options: string[]
  /** The student's chosen option index, or null if unanswered. */
  chosenIndex: number | null
  /** The correct option index. */
  correctIndex: number
  isCorrect: boolean
  marks: number
  marksAwarded: number
  explanation?: string | null
}

export interface AttemptReviewPayload {
  attemptId: string
  status: SubmitStatus
  startedAt: string
  completedAt: string | null
  score: number | null
  totalMarks: number | null
  percentage: number | null
  passed: boolean | null
  tabSwitches: number
  fullscreenExits: number
  copyAttempts: number
  rightClicks: number
  timeTaken: number | null
  questionOrder?: string[]
  questions?: AttemptReviewQuestion[]
  totalQuestions: number
  showResults: boolean
  event?: { id: string; title: string; description?: string | null } | null
  quizLink?: {
    id: string
    slug?: string
    timeLimit?: number
    maxAttempts?: number
    passThreshold?: number
    showResults?: boolean
    requireFullscreen?: boolean
  } | null
}

export interface AttemptListItem {
  id: string
  status: SubmitStatus | "IN_PROGRESS"
  score: number | null
  totalMarks: number | null
  percentage: number | null
  passed: boolean | null
  tabSwitches: number
  fullscreenExits: number
  copyAttempts: number
  rightClicks: number
  timeTaken: number | null
  startedAt: string
  completedAt: string | null
  event?: { id: string; title: string }
  quizLink?: { slug: string }
}

export interface AttemptListResponse {
  attempts: AttemptListItem[]
}
