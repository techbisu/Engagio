"use client"

/**
 * Shared API helper for the Activities admin components.
 * Wraps fetch with JSON content-type, throws on non-2xx with the
 * server-provided `error` message, and parses JSON (or returns text/empty).
 *
 * Same shape as the top-level `src/components/admin/api.ts` helper, kept
 * local so this folder is self-contained.
 */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm =
    typeof FormData !== "undefined" && init?.body instanceof FormData

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  })

  if (!res.ok) {
    const e = await res.json().catch(() => ({} as Record<string, unknown>))
    const message =
      (e &&
        typeof e === "object" &&
        "error" in e &&
        typeof e.error === "string"
        ? e.error
        : null) || `Request failed: ${res.status}`
    throw new Error(message)
  }

  const text = await res.text()
  if (!text) return undefined as unknown as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

// ---------------------------------------------------------------------------
// Activity type metadata (icons + colors + labels)
// ---------------------------------------------------------------------------

import {
  FileQuestion,
  Zap,
  BarChart3,
  ClipboardList,
  Star,
  MessageSquare,
  Vote,
  Brain,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"
import type {
  ActivityType,
  ActivityStatus,
  ActivityQuestionType,
} from "@/types"

export interface ActivityTypeMeta {
  label: string
  short: string
  emoji: string
  icon: LucideIcon
  description: string
  /** Tailwind classes — emerald/teal/amber/slate/rose only (no indigo/blue). */
  iconWrap: string
  accentText: string
  badgeClass: string
}

export const ACTIVITY_TYPE_META: Record<ActivityType, ActivityTypeMeta> = {
  POLL: {
    label: "Poll",
    short: "Single-question poll",
    emoji: "📊",
    icon: BarChart3,
    description: "Quick single-question pulse check with multiple options.",
    iconWrap:
      "bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
    accentText: "text-emerald-700 dark:text-emerald-400",
    badgeClass:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30 border-0",
  },
  LIVE_QUIZ: {
    label: "Live Quiz",
    short: "Real-time quiz",
    emoji: "⚡",
    icon: Zap,
    description: "Run a real-time quiz synchronized across participants.",
    iconWrap:
      "bg-amber-50 text-amber-600 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
    accentText: "text-amber-700 dark:text-amber-400",
    badgeClass:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30 border-0",
  },
  QUIZ: {
    label: "Quiz Link",
    short: "Existing quiz link",
    emoji: "📝",
    icon: FileQuestion,
    description: "Reuse an existing Quiz Link as a graded activity.",
    iconWrap:
      "bg-teal-50 text-teal-600 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/30",
    accentText: "text-teal-700 dark:text-teal-400",
    badgeClass:
      "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/30 border-0",
  },
  SURVEY: {
    label: "Survey",
    short: "Multi-question survey",
    emoji: "📋",
    icon: ClipboardList,
    description: "Multi-question survey with mixed question types.",
    iconWrap:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30",
    accentText: "text-slate-700 dark:text-slate-300",
    badgeClass:
      "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30 border-0",
  },
  FEEDBACK: {
    label: "Feedback",
    short: "Session feedback",
    emoji: "⭐",
    icon: Star,
    description: "Collect post-session feedback with ratings + comments.",
    iconWrap:
      "bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
    accentText: "text-emerald-700 dark:text-emerald-400",
    badgeClass:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30 border-0",
  },
  Q_AND_A: {
    label: "Q&A",
    short: "Open Q&A session",
    emoji: "💬",
    icon: MessageSquare,
    description: "Participants submit questions; you moderate in real-time.",
    iconWrap:
      "bg-teal-50 text-teal-600 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/30",
    accentText: "text-teal-700 dark:text-teal-400",
    badgeClass:
      "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/30 border-0",
  },
  VOTING: {
    label: "Voting",
    short: "Single-choice vote",
    emoji: "🗳️",
    icon: Vote,
    description: "Single-choice vote with a list of candidates.",
    iconWrap:
      "bg-amber-50 text-amber-600 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
    accentText: "text-amber-700 dark:text-amber-400",
    badgeClass:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30 border-0",
  },
  KNOWLEDGE_CHECK: {
    label: "Knowledge Check",
    short: "Mid-session check",
    emoji: "🧠",
    icon: Brain,
    description: "Low-stakes check during a session — no grading.",
    iconWrap:
      "bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
    accentText: "text-emerald-700 dark:text-emerald-400",
    badgeClass:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30 border-0",
  },
  PRE_POST_ASSESSMENT: {
    label: "Pre/Post Assessment",
    short: "Compare before/after",
    emoji: "📈",
    icon: TrendingUp,
    description: "Measure learning growth with paired before/after questions.",
    iconWrap:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30",
    accentText: "text-slate-700 dark:text-slate-300",
    badgeClass:
      "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30 border-0",
  },
}

export const ACTIVITY_TYPE_ORDER: ActivityType[] = [
  "POLL",
  "VOTING",
  "Q_AND_A",
  "SURVEY",
  "FEEDBACK",
  "KNOWLEDGE_CHECK",
  "LIVE_QUIZ",
  "QUIZ",
  "PRE_POST_ASSESSMENT",
]

export interface ActivityStatusMeta {
  label: string
  badgeClass: string
  /** Show a pulsing dot for LIVE. */
  pulse?: boolean
}

export const ACTIVITY_STATUS_META: Record<ActivityStatus, ActivityStatusMeta> = {
  DRAFT: {
    label: "Draft",
    badgeClass:
      "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30 border-0",
  },
  SCHEDULED: {
    label: "Scheduled",
    badgeClass:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30 border-0",
  },
  LIVE: {
    label: "Live",
    badgeClass:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30 border-0",
    pulse: true,
  },
  CLOSED: {
    label: "Closed",
    badgeClass:
      "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30 border-0",
  },
  COMPLETED: {
    label: "Completed",
    badgeClass:
      "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/30 border-0",
  },
}

export interface ActivityQuestionTypeMeta {
  label: string
  /** Whether this question type supports an options list. */
  hasOptions: boolean
  /** Whether it supports a numeric/rating scale. */
  hasRating?: boolean
  /** Whether it accepts free-text. */
  hasText?: boolean
  /** Whether it accepts a number value. */
  hasNumber?: boolean
}

export const ACTIVITY_QUESTION_TYPE_META: Record<
  ActivityQuestionType,
  ActivityQuestionTypeMeta
> = {
  SINGLE_CHOICE: { label: "Single Choice", hasOptions: true },
  MULTIPLE_CHOICE: { label: "Multiple Choice", hasOptions: true },
  RATING: { label: "Rating (1–5)", hasOptions: false, hasRating: true },
  TEXT: { label: "Short Text", hasOptions: false, hasText: true },
  NUMBER: { label: "Number", hasOptions: false, hasNumber: true },
  YES_NO: { label: "Yes / No", hasOptions: true },
  OPEN: { label: "Open-ended", hasOptions: false, hasText: true },
}

export const ACTIVITY_QUESTION_TYPES: ActivityQuestionType[] = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "RATING",
  "TEXT",
  "NUMBER",
  "YES_NO",
]
