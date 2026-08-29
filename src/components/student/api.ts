"use client"

import type {
  QuizLinkDto,
  MatchPair,
  QuestionType,
  PaymentMethod,
} from "@/types"

/**
 * Shared fetch helper for the participant-facing API surface.
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

/** Per-category summary returned for a completed attempt review. */
export interface AttemptCategoryStat {
  category: string
  total: number
  correct: number
  score: number
  maxScore: number
}

// ---- DTOs returned by the participant APIs ------------------------------------

export interface QuizLinkBySlugResponse {
  quizLink: QuizLinkDto
  event: {
    id: string
    title: string
    description?: string | null
    image?: string | null
    // Payment config (returned by /api/quiz-links/by-slug/[slug]).
    // Present when the by-slug endpoint includes the event's payment fields.
    paymentMethod?: PaymentMethod
    paymentAmount?: number
    paymentCurrency?: string
    paymentInstructions?: string | null
    upiId?: string | null
    upiLink?: string | null
    qrCodeUrl?: string | null
    requireTransactionRef?: boolean
    requireScreenshot?: boolean
  } | null
  questionCount: number
  timeLimit: number
  passThreshold: number
  maxAttempts: number
  requireFullscreen: boolean
  isActive: boolean
  hasExpired: boolean
  // When true, the participant must fill out the event registration form
  // (fetched via GET /api/events/[eventId]/fields) before they can start
  // the quiz. The QuizStart screen renders a RegistrationForm in that case.
  requireRegistration?: boolean
  fieldCount?: number
  // ----- Security config (mirrors quizLink fields) -----
  // All optional for backward-compatibility with cached responses.
  security?: {
    autoSubmitOnExit?: boolean
    tabSwitchDetection?: boolean
    copyPasteBlocking?: boolean
    rightClickDisable?: boolean
    keyboardShortcutBlocking?: boolean
    devtoolsDetection?: boolean
    antiScreenshot?: boolean
    watermarkOverlay?: boolean
    aiProctor?: boolean
    aiProctorFaceDetection?: boolean
    aiProctorMultiFace?: boolean
    aiProctorLookAway?: boolean
  }
  /** Number of questions the admin wants to pick per attempt (0 = all). */
  quizLinkQuestionCount?: number
  /** When true, results are hidden until an admin publishes them. */
  publishResults?: boolean
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
  type: QuestionType
  options: string[]
  matchPairs?: MatchPair[] | null
  codeLanguage?: string | null
  marks: number
  order: number
}

/**
 * Per-quiz-link security config returned by /api/attempts/start.
 * The runner activates each anti-cheat feature conditionally based on these.
 */
export interface SecurityConfig {
  autoSubmitOnExit: boolean
  tabSwitchDetection: boolean
  copyPasteBlocking: boolean
  rightClickDisable: boolean
  keyboardShortcutBlocking: boolean
  devtoolsDetection: boolean
  antiScreenshot: boolean
  watermarkOverlay: boolean
  aiProctor: boolean
  aiProctorFaceDetection: boolean
  aiProctorMultiFace: boolean
  aiProctorLookAway: boolean
}

export interface StartAttemptResponse {
  attemptId: string
  questions: PublicQuestion[]
  timeLimit: number
  totalQuestions: number
  totalMarks: number
  security: SecurityConfig
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
  type?: QuestionType
  question: string
  options: string[]
  /** The participant's chosen option index, or null if unanswered (MCQ/TRUE_FALSE). */
  chosenIndex: number | null
  /** The correct option index (MCQ/TRUE_FALSE). */
  correctIndex: number
  /** Free-text answer (FILL_BLANK/CODING). */
  chosenText?: string | null
  /** Matched pairs { left: right } (MATCHING). */
  chosenMatches?: Record<string, string> | null
  /** Correct text (FILL_BLANK/CODING reference). */
  correctText?: string | null
  /** Match pairs (MATCHING). */
  matchPairs?: MatchPair[] | null
  /** Code language (CODING). */
  codeLanguage?: string | null
  isCorrect: boolean
  marks: number
  marksAwarded: number
  /** Per-question negative-mark deduction (defaults to 0). */
  negativeMarks?: number
  /** Optional category tag. */
  category?: string | null
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
  devtoolsOpen?: number
  screenshotAttempts?: number
  keyboardViolations?: number
  faceNotDetected?: number
  multiFaceAlerts?: number
  lookAwayAlerts?: number
  timeTaken: number | null
  flaggedQuestions?: string[]
  questionOrder?: string[]
  questions?: AttemptReviewQuestion[]
  categoryStats?: AttemptCategoryStat[] | null
  totalQuestions: number
  showResults: boolean
  /** When true, results are hidden until admin publishes them. */
  publishResults?: boolean
  /** True iff scoring details are visible to the participant. */
  published?: boolean
  publishedAt?: string | null
  event?: { id: string; title: string; description?: string | null } | null
  quizLink?: {
    id: string
    slug?: string
    timeLimit?: number
    maxAttempts?: number
    passThreshold?: number
    showResults?: boolean
    requireFullscreen?: boolean
    publishResults?: boolean
  } | null
  /** Certificate info — present when auto-generated on submit */
  certificate?: {
    id: string
    certificateNumber: string
    verificationToken: string
    template: string
    recipientName: string
    issuedAt: string
  } | null
  /** Organization info for the share card (logo, name, colors) */
  organization?: {
    name: string
    slug: string
    logoUrl: string | null
    primaryColor: string | null
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
  devtoolsOpen?: number
  screenshotAttempts?: number
  keyboardViolations?: number
  faceNotDetected?: number
  multiFaceAlerts?: number
  lookAwayAlerts?: number
  timeTaken: number | null
  startedAt: string
  completedAt: string | null
  publishedAt?: string | null
  published?: boolean
  event?: { id: string; title: string }
  quizLink?: { slug: string }
}

export interface AttemptListResponse {
  attempts: AttemptListItem[]
}
