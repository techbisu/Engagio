"use client"

import { useMemo } from "react"
import { Flag, Code2, Type as TypeIcon, Shuffle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PublicQuestion } from "@/components/student/api"
import type { MatchPair } from "@/types"

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"]

/** The answer shape — varies by question type. */
export type QuestionAnswer = number | string | Record<string, string>

interface QuestionCardProps {
  index: number
  total: number
  question: PublicQuestion
  /** The student's current answer for this question (or undefined). */
  answer: QuestionAnswer | undefined
  /** Update handler — receives the new answer value. */
  onAnswer: (answer: QuestionAnswer) => void
  /** Whether the question is flagged for review. */
  isFlagged: boolean
  /** Toggle the flag-for-review state. */
  onToggleFlag: () => void
}

/**
 * Inline sub-component for MATCHING questions. Renders the left items as a
 * list, each with a Select dropdown of the (shuffled) right items. Manages
 * the pair selections as `{ [leftValue]: rightValue }`.
 *
 * The right-side items are shuffled once per mount via useMemo so the order
 * is stable while the student works the question.
 */
function MatchingInput({
  question,
  value,
  onChange,
}: {
  question: PublicQuestion
  value: Record<string, string> | undefined
  onChange: (next: Record<string, string>) => void
}) {
  const pairs: MatchPair[] = useMemo(() => {
    if (question.matchPairs && question.matchPairs.length > 0)
      return question.matchPairs
    return []
  }, [question.matchPairs])

  // Shuffle the right-side options once per question instance.
  const shuffledRights = useMemo(() => {
    const rights = pairs.map((p) => p.right)
    // Fisher-Yates — stable per-mount.
    const out = [...rights]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }, [question.id, pairs])

  if (pairs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This matching question has no pairs.
      </p>
    )
  }

  const setPair = (left: string, right: string) => {
    onChange({ ...(value ?? {}), [left]: right })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Match each item on the left with the correct option on the right.
      </p>
      <div className="space-y-2">
        {pairs.map((pair, idx) => {
          const selected = value?.[pair.left]
          return (
            <div
              key={pair.left}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {idx + 1}
                </span>
                <span className="text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                  {pair.left}
                </span>
              </div>
              <Select
                value={selected ?? ""}
                onValueChange={(v) => setPair(pair.left, v)}
              >
                <SelectTrigger className="w-full sm:w-56" size="sm">
                  <SelectValue placeholder="Select match…" />
                </SelectTrigger>
                <SelectContent>
                  {shuffledRights.map((right) => (
                    <SelectItem key={right} value={right}>
                      {right}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Presentational question card. Animations are handled by the parent
 * (quiz-runner) using AnimatePresence so this component stays pure.
 *
 * Renders different input UIs based on `question.type`:
 *   - MCQ / TRUE_FALSE → RadioGroup of options (selected = number index)
 *   - FILL_BLANK       → text Input (answer = string)
 *   - MATCHING         → left items × Select dropdowns (answer = { left: right })
 *   - CODING           → Textarea with language label (answer = string code)
 */
export function QuestionCard({
  index,
  total,
  question,
  answer,
  onAnswer,
  isFlagged,
  onToggleFlag,
}: QuestionCardProps) {
  const type = question.type ?? "MCQ"

  return (
    <div className="flex flex-col gap-5">
      {/* Header: question number + marks + type badge + flag toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900"
          >
            Question {index + 1} of {total}
          </Badge>
          <Badge variant="secondary" className="font-medium">
            {question.marks} {question.marks === 1 ? "mark" : "marks"}
          </Badge>
          {type !== "MCQ" && (
            <Badge
              variant="outline"
              className="gap-1 text-slate-600 dark:text-slate-300"
            >
              {type === "TRUE_FALSE" && <TypeIcon className="size-3" />}
              {type === "FILL_BLANK" && <TypeIcon className="size-3" />}
              {type === "MATCHING" && <Shuffle className="size-3" />}
              {type === "CODING" && <Code2 className="size-3" />}
              {type.replace("_", " ")}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleFlag}
          className={cn(
            "h-8 gap-1.5 px-2 text-xs",
            isFlagged
              ? "text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40"
              : "text-muted-foreground hover:text-amber-600",
          )}
          aria-pressed={isFlagged}
          aria-label={
            isFlagged ? "Remove flag for review" : "Flag for review"
          }
        >
          <Flag
            className={cn("size-4", isFlagged && "fill-amber-500 text-amber-500")}
          />
          {isFlagged ? "Flagged" : "Flag"}
        </Button>
      </div>

      {/* Question text */}
      <h2 className="text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100 sm:text-xl">
        {question.question}
      </h2>

      {/* Type-specific input */}
      {(type === "MCQ" || type === "TRUE_FALSE") && (
        <RadioGroup
          value={
            typeof answer === "number" ? String(answer) : undefined
          }
          onValueChange={(v) => onAnswer(Number(v))}
          className="gap-3"
        >
          {question.options.map((opt, i) => {
            const letter = LETTERS[i] ?? String(i + 1)
            const isSelected = typeof answer === "number" && answer === i
            return (
              <Label
                key={i}
                htmlFor={`opt-${question.id}-${i}`}
                className={cn(
                  "group flex cursor-pointer items-start gap-3 rounded-lg border p-3 sm:p-4 transition-all",
                  "hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30",
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40 ring-1 ring-emerald-500/40"
                    : "border-border bg-card",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    isSelected
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-emerald-900/60 dark:group-hover:text-emerald-300",
                  )}
                >
                  {letter}
                </span>
                <span className="flex-1 text-sm leading-relaxed text-slate-800 dark:text-slate-100 sm:text-base">
                  {opt}
                </span>
                <RadioGroupItem
                  id={`opt-${question.id}-${i}`}
                  value={String(i)}
                  className="sr-only"
                />
              </Label>
            )
          })}
        </RadioGroup>
      )}

      {type === "FILL_BLANK" && (
        <div className="space-y-2">
          <Label htmlFor={`fb-${question.id}`} className="sr-only">
            Your answer
          </Label>
          <Input
            id={`fb-${question.id}`}
            type="text"
            placeholder="Type your answer…"
            value={typeof answer === "string" ? answer : ""}
            onChange={(e) => onAnswer(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="max-w-xl"
          />
          <p className="text-xs text-muted-foreground">
            Type your answer exactly as expected (case-insensitive grading may
            apply).
          </p>
        </div>
      )}

      {type === "MATCHING" && (
        <MatchingInput
          question={question}
          value={
            answer && typeof answer === "object" && !Array.isArray(answer)
              ? (answer as Record<string, string>)
              : undefined
          }
          onChange={(next) => onAnswer(next)}
        />
      )}

      {type === "CODING" && (
        <div className="space-y-2">
          {question.codeLanguage && (
            <div className="flex items-center gap-2">
              <Code2 className="size-4 text-emerald-600" />
              <Badge variant="outline" className="font-mono text-xs">
                {question.codeLanguage}
              </Badge>
            </div>
          )}
          <Textarea
            id={`code-${question.id}`}
            placeholder={`// Write your ${question.codeLanguage ?? "code"} solution here…`}
            value={typeof answer === "string" ? answer : ""}
            onChange={(e) => onAnswer(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            className={cn(
              "min-h-[280px] resize-y font-mono text-sm leading-relaxed",
              "bg-slate-950 text-slate-100 dark:bg-slate-950 dark:text-slate-100",
            )}
          />
          <p className="text-xs text-muted-foreground">
            Your code will be reviewed manually after submission.
          </p>
        </div>
      )}
    </div>
  )
}
