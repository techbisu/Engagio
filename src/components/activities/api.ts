"use client"

/**
 * Shared fetch helper for the participant-facing activity views.
 *
 * - Always sends JSON content-type
 * - Surfaces server error messages
 * - Works with relative Next.js API routes only
 * - Returns parsed JSON (or undefined for empty bodies)
 */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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

  const text = await res.text()
  if (!text) return undefined as unknown as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

// ---- Activity DTOs (re-exported from /types for convenience) ----------------

import type {
  ActivityDto,
  ActivityQuestionDto,
  ActivityResultsDto,
  ActivityType,
} from "@/types"

export type {
  ActivityDto,
  ActivityQuestionDto,
  ActivityResponseDto,
  ActivityResultsDto,
  ActivityType,
  ActivityQuestionType,
  ActivitySettings,
  PollOptionResult,
} from "@/types"

/** Response shape for GET /api/activities/by-slug/[slug] */
export interface ActivityBySlugResponse {
  activity: ActivityDto
  questions: ActivityQuestionDto[]
  hasResponded: boolean
}

/** Body shape for POST /api/activities/[id]/respond */
export interface ActivityResponseInput {
  questionId?: string | null
  selectedOptions?: number[]
  text?: string | null
  numberValue?: number | null
  ratingValue?: number | null
}

export interface RespondBody {
  responses: ActivityResponseInput[]
}

/** Response shape for POST /api/activities/[id]/respond — loosely typed. */
export interface RespondResponse {
  success?: boolean
  activityId?: string
  responseIds?: string[]
}

/** Body shape for POST /api/activities/[id]/qa/upvote */
export interface QaUpvoteBody {
  responseId: string
}

/** Response shape for the upvote endpoint. */
export interface QaUpvoteResponse {
  success?: boolean
  upvotes?: number
}

/**
 * Returns the icon-friendly ActivityType category for routing purposes.
 * Allows the join screen to map QUIZ/KNOWLEDGE_CHECK → existing quiz flow.
 */
export function isQuizLike(type: ActivityType): boolean {
  return type === "QUIZ" || type === "KNOWLEDGE_CHECK" || type === "PRE_POST_ASSESSMENT"
}
