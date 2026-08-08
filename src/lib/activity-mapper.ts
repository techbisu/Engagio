import { parseJsonArray } from "@/lib/utils";
// Re-export parseJsonArray so the activity API routes can import all the
// helpers from a single module.
export { parseJsonArray };
import type {
  ActivityDto,
  ActivityQuestionDto,
  ActivityResponseDto,
  ActivityType,
  ActivityStatus,
  ActivityQuestionType,
  ActivitySettings,
} from "@/types";

/** Canonical list of valid ActivityType values (must match Prisma schema doc). */
export const ACTIVITY_TYPES: ActivityType[] = [
  "QUIZ",
  "LIVE_QUIZ",
  "POLL",
  "SURVEY",
  "FEEDBACK",
  "Q_AND_A",
  "VOTING",
  "KNOWLEDGE_CHECK",
  "PRE_POST_ASSESSMENT",
];

/** Canonical list of valid ActivityStatus values. */
export const ACTIVITY_STATUSES: ActivityStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "LIVE",
  "CLOSED",
  "COMPLETED",
];

/** Canonical list of valid ActivityQuestionType values. */
export const ACTIVITY_QUESTION_TYPES: ActivityQuestionType[] = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "RATING",
  "TEXT",
  "NUMBER",
  "YES_NO",
  "OPEN",
];

export function isValidActivityType(v: unknown): v is ActivityType {
  return typeof v === "string" && (ACTIVITY_TYPES as string[]).includes(v);
}

export function isValidActivityStatus(v: unknown): v is ActivityStatus {
  return typeof v === "string" && (ACTIVITY_STATUSES as string[]).includes(v);
}

export function isValidActivityQuestionType(
  v: unknown
): v is ActivityQuestionType {
  return (
    typeof v === "string" && (ACTIVITY_QUESTION_TYPES as string[]).includes(v)
  );
}

/** Default settings — merged with stored settings to fill in gaps. */
export const DEFAULT_ACTIVITY_SETTINGS: ActivitySettings = {
  allowMultiple: false,
  anonymous: false,
  showResults: true,
  hideResultsUntilClosed: false,
};

/** Parse the JSON settings string on an Activity row → typed settings object. */
export function parseActivitySettings(raw: string | null | undefined): ActivitySettings {
  if (!raw) return { ...DEFAULT_ACTIVITY_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...DEFAULT_ACTIVITY_SETTINGS, ...(parsed as ActivitySettings) };
    }
  } catch {
    /* ignore parse errors — fall through to defaults */
  }
  return { ...DEFAULT_ACTIVITY_SETTINGS };
}

/** Default Q&A response metadata (used when a Q&A question is submitted). */
export const DEFAULT_QA_METADATA = {
  upvotes: 0,
  approved: false,
  pinned: false,
  answered: false,
  hidden: false,
} as const;

/** Parse the JSON metadata string on an ActivityResponse row. */
export function parseResponseMetadata(raw: string | null | undefined): ActivityResponseDto["metadata"] {
  if (!raw) return { ...DEFAULT_QA_METADATA };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        upvotes: typeof parsed.upvotes === "number" ? parsed.upvotes : 0,
        approved: !!parsed.approved,
        pinned: !!parsed.pinned,
        answered: !!parsed.answered,
        hidden: !!parsed.hidden,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_QA_METADATA };
}

/**
 * Map a Prisma Activity row (optionally with `_count` and a separately
 * fetched `quizLink` object) → ActivityDto.
 *
 * The Activity → QuizLink relation is NOT defined in the Prisma schema
 * (QuizLink's schema is intentionally untouched — see ACT-2 task brief).
 * Instead, callers fetch the QuizLink row separately and pass it here as
 * `quizLink`. When undefined/null, the resulting DTO will have `quizLink: null`.
 */
export function toActivityDto(
  a: any,
  quizLink?: { id: string; slug: string; timeLimit: number } | null
): ActivityDto {
  return {
    id: a.id,
    eventId: a.eventId,
    type: (a.type ?? "POLL") as ActivityType,
    title: a.title,
    description: a.description ?? null,
    status: (a.status ?? "DRAFT") as ActivityStatus,
    isEnabled: a.isEnabled ?? true,
    sortOrder: a.sortOrder ?? 0,
    startsAt: a.startsAt ? a.startsAt.toISOString() : null,
    endsAt: a.endsAt ? a.endsAt.toISOString() : null,
    settings: parseActivitySettings(a.settings),
    quizLinkId: a.quizLinkId ?? null,
    session: a.session ?? null,
    slug: a.slug ?? null,
    createdBy: a.createdBy ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    questionCount: a._count?.questions ?? a.questionCount ?? 0,
    responseCount: a._count?.responses ?? a.responseCount ?? 0,
    participationCount: a._count?.participations ?? a.participationCount ?? 0,
    quizLink: quizLink
      ? {
          id: quizLink.id,
          slug: quizLink.slug,
          timeLimit: quizLink.timeLimit,
        }
      : null,
  };
}

/**
 * Helper: given an Activity row that may have a quizLinkId, fetch the related
 * QuizLink's minimal fields. Returns null when the activity has no
 * quizLinkId, or when no matching QuizLink exists.
 */
export async function fetchActivityQuizLink(
  quizLinkId: string | null | undefined
): Promise<{ id: string; slug: string; timeLimit: number } | null> {
  if (!quizLinkId) return null;
  // Lazy-import to avoid pulling Prisma into the mapper module's import graph
  // for type-only consumers (the mapper is also imported by pure type files).
  const { db } = await import("@/lib/db");
  const ql = await db.quizLink.findUnique({
    where: { id: quizLinkId },
    select: { id: true, slug: true, timeLimit: true },
  });
  return ql;
}

/** Map a Prisma ActivityQuestion row → ActivityQuestionDto. */
export function toActivityQuestionDto(q: any): ActivityQuestionDto {
  return {
    id: q.id,
    activityId: q.activityId,
    text: q.text,
    type: (q.type ?? "SINGLE_CHOICE") as ActivityQuestionType,
    options: parseJsonArray<string>(q.options),
    required: q.required ?? true,
    sortOrder: q.sortOrder ?? 0,
    createdAt: q.createdAt.toISOString(),
  };
}

/** Map a Prisma ActivityResponse row → ActivityResponseDto. */
export function toActivityResponseDto(r: any): ActivityResponseDto {
  return {
    id: r.id,
    activityId: r.activityId,
    questionId: r.questionId ?? null,
    participantId: r.participantId ?? null,
    participantName: r.participantName ?? null,
    selectedOptions: parseJsonArray<number>(r.selectedOptions),
    text: r.text ?? null,
    numberValue: r.numberValue ?? null,
    ratingValue: r.ratingValue ?? null,
    metadata: parseResponseMetadata(r.metadata),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
