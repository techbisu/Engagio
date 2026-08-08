"use client"

import * as React from "react"
import { Check, Loader2, Send, Star } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { api } from "./api"
import type {
  ActivityDto,
  ActivityQuestionDto,
  ActivityResponseInput,
  RespondBody,
  RespondResponse,
} from "./api"

export interface SurveyFormProps {
  activity: ActivityDto
  questions: ActivityQuestionDto[]
  onSubmit?: () => void
}

interface AnswerState {
  selectedOptions: number[]
  text: string
  numberValue: string // keep as string for input control
  ratingValue: number
  yesNo: boolean | null
}

function emptyAnswer(): AnswerState {
  return {
    selectedOptions: [],
    text: "",
    numberValue: "",
    ratingValue: 0,
    yesNo: null,
  }
}

function isAnswered(q: ActivityQuestionDto, a: AnswerState): boolean {
  switch (q.type) {
    case "SINGLE_CHOICE":
      return a.selectedOptions.length > 0
    case "MULTIPLE_CHOICE":
      return a.selectedOptions.length > 0
    case "RATING":
      return a.ratingValue > 0
    case "TEXT":
    case "OPEN":
      return a.text.trim().length > 0
    case "NUMBER":
      return a.numberValue.trim() !== ""
    case "YES_NO":
      return a.yesNo !== null
    default:
      return false
  }
}

/**
 * SurveyForm — participant UI for SURVEY / FEEDBACK activities.
 * Renders every question in a single scrollable form. Validates required
 * questions, shows a progress bar at top, and POSTs all responses at once.
 */
export function SurveyForm({ activity, questions, onSubmit }: SurveyFormProps) {
  const [answers, setAnswers] = React.useState<Record<string, AnswerState>>(() => {
    const init: Record<string, AnswerState> = {}
    for (const q of questions) init[q.id] = emptyAnswer()
    return init
  })
  const [submitting, setSubmitting] = React.useState(false)

  const totalRequired = React.useMemo(
    () => questions.filter((q) => q.required).length,
    [questions],
  )
  const answeredRequired = React.useMemo(
    () =>
      questions.filter(
        (q) => q.required && isAnswered(q, answers[q.id] ?? emptyAnswer()),
      ).length,
    [questions, answers],
  )
  const totalQuestions = questions.length
  const answeredAll = React.useMemo(
    () => questions.filter((q) => isAnswered(q, answers[q.id] ?? emptyAnswer()))
      .length,
    [questions, answers],
  )
  const progressPct =
    totalQuestions === 0 ? 0 : Math.round((answeredAll / totalQuestions) * 100)

  const update = (qid: string, patch: Partial<AnswerState>) => {
    setAnswers((prev) => ({
      ...prev,
      [qid]: { ...(prev[qid] ?? emptyAnswer()), ...patch },
    }))
  }

  const missingRequired = React.useMemo(
    () =>
      questions.filter(
        (q) => q.required && !isAnswered(q, answers[q.id] ?? emptyAnswer()),
      ),
    [questions, answers],
  )

  const handleSubmit = async () => {
    if (missingRequired.length > 0) {
      toast.error(
        `Please answer ${missingRequired.length} required question${missingRequired.length === 1 ? "" : "s"}.`,
      )
      return
    }
    setSubmitting(true)
    try {
      const responses: ActivityResponseInput[] = questions.map((q) => {
        const a = answers[q.id] ?? emptyAnswer()
        const r: ActivityResponseInput = { questionId: q.id }
        if (q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE") {
          r.selectedOptions = a.selectedOptions
        } else if (q.type === "TEXT" || q.type === "OPEN") {
          r.text = a.text
        } else if (q.type === "NUMBER") {
          r.numberValue = a.numberValue === "" ? null : Number(a.numberValue)
        } else if (q.type === "RATING") {
          r.ratingValue = a.ratingValue
        } else if (q.type === "YES_NO") {
          // Encode Yes/No as a single-option choice (0=No, 1=Yes) for storage
          r.selectedOptions = a.yesNo === null ? [] : [a.yesNo ? 1 : 0]
          r.text = a.yesNo === null ? null : a.yesNo ? "Yes" : "No"
        }
        return r
      })

      const body: RespondBody = { responses }
      await api<RespondResponse>(`/api/activities/${activity.id}/respond`, {
        method: "POST",
        body: JSON.stringify(body),
      })
      toast.success("Survey submitted. Thank you!")
      onSubmit?.()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit survey"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          This survey has no questions yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-foreground">
            {answeredAll} of {totalQuestions} answered
          </span>
          <span className="text-muted-foreground">
            {totalRequired > 0 &&
              `${answeredRequired}/${totalRequired} required · `}
            {progressPct}%
          </span>
        </div>
        <Progress
          value={progressPct}
          className="h-2 bg-emerald-100 dark:bg-emerald-950"
        />
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const a = answers[q.id] ?? emptyAnswer()
          const isMissing =
            q.required && !isAnswered(q, a) && submitting === false
          return (
            <Card
              key={q.id}
              className={cn(
                "border-slate-200 dark:border-slate-800",
                isMissing &&
                  "border-amber-300 dark:border-amber-800 ring-1 ring-amber-200 dark:ring-amber-900",
              )}
            >
              <CardContent className="space-y-3 p-4 sm:p-5">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Label className="text-base font-semibold leading-tight text-foreground sm:text-lg">
                      {q.text}
                      {q.required && (
                        <span className="ml-1 text-red-500" aria-label="Required">
                          *
                        </span>
                      )}
                    </Label>
                  </div>
                </div>
                <QuestionInput
                  question={q}
                  answer={a}
                  onChange={(patch) => update(q.id, patch)}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Submit */}
      <div className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {missingRequired.length > 0
            ? `${missingRequired.length} required question${missingRequired.length === 1 ? "" : "s"} unanswered`
            : "All set — submit when ready."}
        </p>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-emerald-600 text-white hover:bg-emerald-700 sm:min-w-[180px]"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Submitting…
            </>
          ) : (
            <>
              <Send className="size-4" /> Submit Survey
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

interface QuestionInputProps {
  question: ActivityQuestionDto
  answer: AnswerState
  onChange: (patch: Partial<AnswerState>) => void
}

function QuestionInput({ question, answer, onChange }: QuestionInputProps) {
  const q = question
  const a = answer

  if (q.type === "SINGLE_CHOICE") {
    return (
      <div className="grid gap-2" role="radiogroup" aria-label={q.text}>
        {q.options.map((opt, idx) => {
          const isSelected = a.selectedOptions[0] === idx
          return (
            <button
              key={idx}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange({ selectedOptions: [idx] })}
              className={cn(
                "flex min-h-[48px] w-full items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-all",
                "hover:border-emerald-300 hover:bg-emerald-50/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                "dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30",
                isSelected
                  ? "border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/40"
                  : "border-slate-200 dark:border-slate-800",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-all",
                  isSelected
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-slate-300 dark:border-slate-600",
                )}
              >
                {isSelected && <span className="size-2 rounded-full bg-white" />}
              </span>
              <span
                className={cn(
                  "text-sm font-medium sm:text-base",
                  isSelected
                    ? "text-emerald-900 dark:text-emerald-100"
                    : "text-foreground",
                )}
              >
                {opt}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === "MULTIPLE_CHOICE") {
    return (
      <div className="grid gap-2" role="group" aria-label={q.text}>
        {q.options.map((opt, idx) => {
          const isSelected = a.selectedOptions.includes(idx)
          return (
            <button
              key={idx}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() =>
                onChange({
                  selectedOptions: isSelected
                    ? a.selectedOptions.filter((i) => i !== idx)
                    : [...a.selectedOptions, idx],
                })
              }
              className={cn(
                "flex min-h-[48px] w-full items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-all",
                "hover:border-emerald-300 hover:bg-emerald-50/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                "dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30",
                isSelected
                  ? "border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/40"
                  : "border-slate-200 dark:border-slate-800",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-md border-2 transition-all",
                  isSelected
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300 text-transparent dark:border-slate-600",
                )}
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <span
                className={cn(
                  "text-sm font-medium sm:text-base",
                  isSelected
                    ? "text-emerald-900 dark:text-emerald-100"
                    : "text-foreground",
                )}
              >
                {opt}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === "RATING") {
    return (
      <div className="flex flex-col items-start gap-2">
        <div
          className="flex items-center gap-1.5"
          role="radiogroup"
          aria-label={`${q.text} rating`}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = a.ratingValue >= star
            return (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={filled}
                aria-label={`${star} star${star === 1 ? "" : "s"}`}
                onClick={() => onChange({ ratingValue: star })}
                className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Star
                  className={cn(
                    "size-8 transition-all sm:size-9",
                    filled
                      ? "fill-amber-400 text-amber-400"
                      : "fill-transparent text-slate-300 dark:text-slate-600",
                  )}
                  strokeWidth={2}
                />
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {a.ratingValue > 0
            ? `You rated ${a.ratingValue}/5`
            : "Tap a star to rate"}
        </p>
      </div>
    )
  }

  if (q.type === "TEXT" || q.type === "OPEN") {
    return (
      <Textarea
        value={a.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="Type your answer…"
        rows={4}
        className="min-h-[120px] resize-y"
      />
    )
  }

  if (q.type === "NUMBER") {
    return (
      <Input
        type="number"
        inputMode="decimal"
        value={a.numberValue}
        onChange={(e) => onChange({ numberValue: e.target.value })}
        placeholder="Enter a number"
        className="max-w-xs"
      />
    )
  }

  if (q.type === "YES_NO") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((val) => {
          const selected = a.yesNo === val
          const label = val ? "Yes" : "No"
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ yesNo: val })}
              className={cn(
                "flex min-h-[56px] items-center justify-center rounded-lg border-2 px-4 py-3 text-base font-semibold transition-all",
                "hover:border-emerald-300 hover:bg-emerald-50/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                "dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30",
                selected
                  ? val
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-slate-500 bg-slate-100 text-slate-700 dark:border-slate-500 dark:bg-slate-800/60 dark:text-slate-200"
                  : "border-slate-200 text-foreground dark:border-slate-800",
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
    )
  }

  // Fallback — should not normally happen
  return (
    <p className="text-sm text-muted-foreground">
      Unsupported question type: {q.type}
    </p>
  )
}
