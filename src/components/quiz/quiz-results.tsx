"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  MousePointerClick,
  Trophy,
  X,
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn, formatDuration } from "@/lib/utils"
import { api } from "@/components/student/api"
import type { AttemptReviewPayload } from "@/components/student/api"

interface QuizResultsProps {
  attemptId: string
  onBack: () => void
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"]

export function QuizResults({ attemptId, onBack }: QuizResultsProps) {
  const [reviewOpen, setReviewOpen] = useState(false)

  const { data, isLoading, isError, error } = useQuery<AttemptReviewPayload>({
    queryKey: ["attempt", attemptId],
    queryFn: () => api<AttemptReviewPayload>(`/api/attempts/${attemptId}`),
    enabled: !!attemptId,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">Loading your results…</p>
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              <CardTitle>Couldn&apos;t load results</CardTitle>
            </div>
            <CardDescription>
              {error instanceof Error
                ? error.message
                : "Please try again later."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBack} variant="outline" className="w-full">
              <ArrowLeft className="size-4" /> Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If the quiz is configured to hide results, show a holding message.
  if (data.showResults === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <CheckCircle2 className="size-7 text-emerald-600" />
            </div>
            <CardTitle>Quiz submitted successfully</CardTitle>
            <CardDescription>
              Your answers have been recorded. Your instructor will share the
              results soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={onBack}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <ArrowLeft className="size-4" /> Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const status = data.status
  const isPassed = status === "COMPLETED" && data.passed
  const isCheat = status === "CHEAT_DETECTED"
  const isTimeout = status === "TIMEOUT"

  const statusMeta = isPassed
    ? {
        label: "Passed",
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        border: "border-emerald-200 dark:border-emerald-900",
        ring: "ring-emerald-500/30",
        Icon: CheckCircle2,
      }
    : isCheat
      ? {
          label: "Cheat Detected",
          color: "text-red-600 dark:text-red-400",
          bg: "bg-red-50 dark:bg-red-950/40",
          border: "border-red-200 dark:border-red-900",
          ring: "ring-red-500/30",
          Icon: AlertTriangle,
        }
      : isTimeout
        ? {
            label: "Time Out",
            color: "text-amber-600 dark:text-amber-400",
            bg: "bg-amber-50 dark:bg-amber-950/40",
            border: "border-amber-200 dark:border-amber-900",
            ring: "ring-amber-500/30",
            Icon: Clock,
          }
        : {
            label: "Failed",
            color: "text-red-600 dark:text-red-400",
            bg: "bg-red-50 dark:bg-red-950/40",
            border: "border-red-200 dark:border-red-900",
            ring: "ring-red-500/30",
            Icon: X,
          }

  const percentage = data.percentage ?? 0
  const passThreshold = data.quizLink?.passThreshold ?? 0
  const score = data.score ?? 0
  const totalMarks = data.totalMarks ?? 0
  const timeTaken = data.timeTaken ?? 0

  const questions = data.questions ?? []
  const correctCount = questions.filter((q) => q.isCorrect).length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
            <ArrowLeft className="size-4" /> Dashboard
          </Button>
          {data.event?.title && (
            <Badge variant="outline" className="hidden sm:inline-flex">
              {data.event.title}
            </Badge>
          )}
        </div>

        {/* Result card */}
        <Card className={cn("border-t-4", statusMeta.border)}>
          <CardHeader className={cn("items-center text-center", statusMeta.bg)}>
            <div
              className={cn(
                "mb-2 flex size-16 items-center justify-center rounded-full ring-4",
                statusMeta.bg,
                statusMeta.ring,
              )}
            >
              <statusMeta.Icon className={cn("size-8", statusMeta.color)} />
            </div>
            <Badge
              variant="outline"
              className={cn("mx-auto mb-1 border font-semibold", statusMeta.border, statusMeta.color, statusMeta.bg)}
            >
              {statusMeta.label}
            </Badge>
            <CardTitle className="text-2xl">
              {data.event?.title ?? "Quiz Results"}
            </CardTitle>
            <CardDescription>
              Completed{" "}
              {data.completedAt
                ? formatDistanceToNow(new Date(data.completedAt), { addSuffix: true })
                : "recently"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {/* Score + Percentage */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Score
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums">
                  <span className={statusMeta.color}>{score}</span>
                  <span className="text-muted-foreground"> / {totalMarks}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {correctCount} of {questions.length} correct
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Percentage
                </p>
                <p className={cn("mt-1 text-3xl font-bold tabular-nums", statusMeta.color)}>
                  {percentage}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pass mark: {passThreshold}%
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <Progress
                value={percentage}
                className={cn(
                  "h-3",
                  isPassed && "[&>[data-slot=progress-indicator]]:bg-emerald-500",
                  (isCheat || (!isPassed && !isTimeout)) && "[&>[data-slot=progress-indicator]]:bg-red-500",
                  isTimeout && "[&>[data-slot=progress-indicator]]:bg-amber-500",
                )}
              />
              {passThreshold > 0 && (
                <div className="relative h-0">
                  <div
                    className="absolute -top-3 flex flex-col items-center"
                    style={{ left: `${passThreshold}%` }}
                  >
                    <div className="h-3 w-0.5 bg-slate-400" />
                    <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                      pass
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" />
                Time: {formatDuration(timeTaken)}
              </span>
              <span className="text-border">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="size-4" />
                {questions.length} questions
              </span>
              {data.completedAt && (
                <>
                  <span className="text-border">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    {format(new Date(data.completedAt), "MMM d, yyyy HH:mm")}
                  </span>
                </>
              )}
            </div>

            <Separator />

            {/* Anti-cheat summary */}
            <div>
              <p className="mb-3 text-sm font-semibold">Anti-cheat summary</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <AntiCheatBadge
                  icon={Eye}
                  label="Tab switches"
                  value={data.tabSwitches}
                />
                <AntiCheatBadge
                  icon={Copy}
                  label="Copy attempts"
                  value={data.copyAttempts}
                />
                <AntiCheatBadge
                  icon={MousePointerClick}
                  label="Right-clicks"
                  value={data.rightClicks}
                />
                <AntiCheatBadge
                  icon={EyeOff}
                  label="Fullscreen exits"
                  value={data.fullscreenExits}
                />
              </div>
            </div>

            {/* Review answers */}
            {questions.length > 0 && (
              <Collapsible open={reviewOpen} onOpenChange={setReviewOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform",
                        reviewOpen && "rotate-180",
                      )}
                    />
                    {reviewOpen ? "Hide" : "Review"} answers
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2">
                  {questions.map((q, idx) => (
                    <ReviewQuestion key={q.id} q={q} idx={idx} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            <Button
              onClick={onBack}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <ArrowLeft className="size-4" /> Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AntiCheatBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye
  label: string
  value: number
}) {
  const ok = value === 0
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2.5",
        ok
          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30"
          : "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          ok
            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300"
            : "bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300",
        )}
      >
        {ok ? <Check className="size-4" /> : <AlertTriangle className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{value}</p>
      </div>
      <Icon className="size-4 text-muted-foreground" />
    </div>
  )
}

function ReviewQuestion({
  q,
  idx,
}: {
  q: AttemptReviewPayload["questions"] extends (infer T)[] | undefined ? T : never
  idx: number
}) {
  if (!q) return null
  const chosen = q.chosenIndex
  const correct = q.correctIndex
  const answeredCorrectly = q.isCorrect
  const unanswered = chosen === null

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-start gap-3">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            answeredCorrectly
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
          )}
        >
          {answeredCorrectly ? (
            <Check className="size-4" />
          ) : unanswered ? (
            "?"
          ) : (
            <X className="size-4" />
          )}
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Q{idx + 1}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {q.marksAwarded} / {q.marks} marks
            </Badge>
          </div>
          <p className="mt-2 text-sm font-medium leading-snug">{q.question}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {q.options.map((opt, i) => {
          const isCorrectOption = i === correct
          const isChosenOption = i === chosen
          return (
            <li
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-md border p-2.5 text-sm",
                isCorrectOption
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                  : isChosenOption && !isCorrectOption
                    ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
                    : "border-border bg-muted/30",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  isCorrectOption
                    ? "bg-emerald-600 text-white"
                    : isChosenOption && !isCorrectOption
                      ? "bg-red-600 text-white"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                )}
              >
                {LETTERS[i] ?? String(i + 1)}
              </span>
              <span className="flex-1 leading-relaxed">{opt}</span>
              {isCorrectOption && (
                <Check className="size-4 shrink-0 text-emerald-600" />
              )}
              {!isCorrectOption && isChosenOption && (
                <X className="size-4 shrink-0 text-red-600" />
              )}
            </li>
          )
        })}
      </ul>

      {q.explanation && (
        <div className="mt-3 rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Explanation: </span>
          {q.explanation}
        </div>
      )}
    </div>
  )
}
