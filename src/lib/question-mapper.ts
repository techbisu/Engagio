import { parseJsonArray } from "@/lib/utils";
import type { QuestionDto, MatchPair, QuestionType } from "@/types";

/** Shared mapper — converts a Prisma Question row into a QuestionDto. */
export function toQuestionDto(q: any): QuestionDto {
  let matchPairs: MatchPair[] | null = null;
  if (q.matchPairs) {
    try {
      const parsed = JSON.parse(q.matchPairs);
      matchPairs = Array.isArray(parsed) ? (parsed as MatchPair[]) : null;
    } catch {
      matchPairs = null;
    }
  }
  return {
    id: q.id,
    eventId: q.eventId,
    question: q.question,
    type: (q.type as QuestionType) ?? "MCQ",
    options: parseJsonArray<string>(q.options),
    correctAnswer: q.correctAnswer,
    correctText: q.correctText ?? null,
    matchPairs,
    codeLanguage: q.codeLanguage ?? null,
    marks: q.marks,
    negativeMarks: q.negativeMarks ?? 0,
    category: q.category ?? null,
    order: q.order,
    explanation: q.explanation ?? null,
    createdAt: q.createdAt.toISOString(),
  };
}

export const VALID_QUESTION_TYPES: QuestionType[] = [
  "MCQ",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCHING",
  "CODING",
];

export function isValidQuestionType(t: unknown): t is QuestionType {
  return typeof t === "string" && (VALID_QUESTION_TYPES as string[]).includes(t);
}
