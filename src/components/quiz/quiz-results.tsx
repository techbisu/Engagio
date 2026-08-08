"use client"

import * as React from "react"
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
  Download,
  Eye,
  EyeOff,
  Loader2,
  Minus,
  MousePointerClick,
  Trophy,
  X,
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

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
import type {
  AttemptCategoryStat,
  AttemptReviewPayload,
  AttemptReviewQuestion,
} from "@/components/student/api"
import type { SafeUser } from "@/types"
import { ShareAchievementButton } from "@/components/achievements/share-achievement-button"

interface QuizResultsProps {
  attemptId: string
  user?: SafeUser
  onBack: () => void
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"]

export function QuizResults({ attemptId, user, onBack }: QuizResultsProps) {
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

  // Case A: instructor has hidden results entirely (showResults === false).
  if (data.showResults === false) {
    return (
      <Shell onBack={onBack}>
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
      </Shell>
    )
  }

  // Case B: results pending publication (publishResults === true && publishedAt === null).
  // The backend returns `published: false` along with score=null/totalMarks=null/etc.
  if (data.published === false && data.publishResults === true) {
    return (
      <Shell onBack={onBack}>
        <Card className="w-full max-w-md border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-amber-100 ring-1 ring-amber-500/30 dark:bg-amber-950/60 dark:text-amber-300">
              <Clock className="size-7 text-amber-600" />
            </div>
            <CardTitle>Results Pending</CardTitle>
            <CardDescription>
              Your quiz has been submitted. The instructor will publish results
              soon. You&apos;ll be able to see your score and review answers
              once published.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {data.event?.title && (
              <div className="rounded-md border bg-card p-3 text-foreground">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Event
                </p>
                <p className="font-medium">{data.event.title}</p>
              </div>
            )}
            <Button
              onClick={onBack}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <ArrowLeft className="size-4" /> Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </Shell>
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

  // Category breakdown (skip if no entries).
  const categoryStats: AttemptCategoryStat[] =
    data.categoryStats && data.categoryStats.length > 0
      ? data.categoryStats
      : []

  const handleDownload = async () => {
    try {
      const blob = await buildReportPng({
        studentName:
          user?.name ||
          user?.email?.split("@")[0] ||
          "Participant",
        eventTitle: data.event?.title ?? "Quiz",
        score,
        totalMarks,
        percentage,
        passed: !!isPassed,
        status: statusMeta.label,
        completedAt: data.completedAt,
        timeTaken,
        categoryStats,
      })
      if (!blob) {
        toast.error("Couldn't generate the report image.")
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const slug = (data.event?.title || "quiz")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
      a.download = `quiz-report-${slug || "result"}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Report downloaded.")
    } catch (e) {
      toast.error("Failed to generate report.")
      console.error(e)
    }
  }

  return (
    <Shell onBack={onBack}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="size-4" /> Dashboard
        </Button>
        <div className="flex items-center gap-2">
          {data.event?.title && (
            <Badge variant="outline" className="hidden sm:inline-flex">
              {data.event.title}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownload()}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            <Download className="size-4" /> Download Report (PNG)
          </Button>
        </div>
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

          {/* Performance by Category */}
          {categoryStats.length > 0 && (
            <CategoryBreakdown stats={categoryStats} />
          )}

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
              {(data.devtoolsOpen ?? 0) > 0 && (
                <AntiCheatBadge
                  icon={MonitorIcon}
                  label="DevTools open"
                  value={data.devtoolsOpen ?? 0}
                />
              )}
              {(data.screenshotAttempts ?? 0) > 0 && (
                <AntiCheatBadge
                  icon={CameraIcon}
                  label="Screenshots"
                  value={data.screenshotAttempts ?? 0}
                />
              )}
              {(data.keyboardViolations ?? 0) > 0 && (
                <AntiCheatBadge
                  icon={KeyboardIcon}
                  label="Keyboard violations"
                  value={data.keyboardViolations ?? 0}
                />
              )}
              {(data.lookAwayAlerts ?? 0) > 0 && (
                <AntiCheatBadge
                  icon={EyeOff}
                  label="Look-away alerts"
                  value={data.lookAwayAlerts ?? 0}
                />
              )}
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

          {/* Share achievement CTA — only shown when results are published */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Share your achievement
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              Show off your {data.event?.title ?? "quiz"} result with a
              polished, shareable card.
            </p>
            <ShareAchievementButton
              achievementInput={{
                type: "QUIZ_RESULT",
                eventId: data.event?.id,
                title: data.event?.title
                  ? `${data.event.title} · Quiz Result`
                  : "Quiz Result",
                subtitle: data.event?.title ?? undefined,
                score: data.score ?? undefined,
                totalScore: data.totalMarks ?? undefined,
                percentage: data.percentage ?? undefined,
                achievementData: {
                  eventTitle: data.event?.title,
                },
                templateId: "modern",
                visibility: "LINK_ONLY",
              }}
              className="w-full sm:w-auto"
            />
          </div>

          <Button
            onClick={onBack}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <ArrowLeft className="size-4" /> Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </Shell>
  )
}

function Shell({
  onBack,
  children,
}: {
  onBack: () => void
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category breakdown (recharts horizontal bar chart + table)
// ---------------------------------------------------------------------------

function CategoryBreakdown({ stats }: { stats: AttemptCategoryStat[] }) {
  const data = stats.map((s) => {
    const pct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0
    return {
      category: s.category,
      pct,
      score: s.score,
      maxScore: s.maxScore,
      total: s.total,
      correct: s.correct,
    }
  })

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Performance by Category</p>
      <div className="h-[max(180px,calc(36px_*_var(--rows)))] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fontSize: 11 }}
              width={100}
              stroke="currentColor"
              className="fill-muted-foreground"
            />
            <Bar dataKey="pct" radius={[6, 6, 6, 6]} barSize={18}>
              {data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={
                    entry.pct >= 70
                      ? "#10b981" // emerald-500
                      : entry.pct >= 40
                        ? "#f59e0b" // amber-500
                        : "#f43f5e" // rose-500
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {data.map((entry, idx) => {
          const tone =
            entry.pct >= 70
              ? {
                  text: "text-emerald-700 dark:text-emerald-300",
                  bar: "bg-emerald-500",
                  bg: "bg-emerald-50 dark:bg-emerald-950/40",
                  border: "border-emerald-200 dark:border-emerald-900",
                  badge:
                    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                  label: "Strength",
                }
              : entry.pct >= 40
                ? {
                    text: "text-amber-700 dark:text-amber-300",
                    bar: "bg-amber-500",
                    bg: "bg-amber-50 dark:bg-amber-950/40",
                    border: "border-amber-200 dark:border-amber-900",
                    badge:
                      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
                    label: "Average",
                  }
                : {
                    text: "text-rose-700 dark:text-rose-300",
                    bar: "bg-rose-500",
                    bg: "bg-rose-50 dark:bg-rose-950/40",
                    border: "border-rose-200 dark:border-rose-900",
                    badge:
                      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
                    label: "Weak Area",
                  }
          return (
            <div
              key={idx}
              className={cn(
                "rounded-lg border p-3",
                tone.border,
                tone.bg,
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{entry.category}</p>
                <Badge variant="outline" className={cn("text-[10px]", tone.badge)}>
                  {tone.label}
                </Badge>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Score:{" "}
                  <span className={cn("font-semibold tabular-nums", tone.text)}>
                    {entry.score}/{entry.maxScore}
                  </span>
                </span>
                <span>
                  {entry.correct}/{entry.total} correct
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", tone.bar)}
                  style={{ width: `${entry.pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Anti-cheat badges
// ---------------------------------------------------------------------------

function AntiCheatBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
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

// ---------------------------------------------------------------------------
// Review question (with negative-marks display)
// ---------------------------------------------------------------------------

function ReviewQuestion({
  q,
  idx,
}: {
  q: AttemptReviewQuestion
  idx: number
}) {
  const chosen = q.chosenIndex
  const correct = q.correctIndex
  const answeredCorrectly = q.isCorrect
  const unanswered = chosen === null && q.type !== "FILL_BLANK" && q.type !== "CODING" && q.type !== "MATCHING"

  // For text/matching types: chosen text / matches presence
  const hasTextAnswer =
    q.type === "FILL_BLANK" || q.type === "CODING"
      ? !!(q.chosenText && q.chosenText.trim().length > 0)
      : q.type === "MATCHING"
        ? !!(q.chosenMatches && Object.keys(q.chosenMatches).length > 0)
        : chosen !== null

  const marksAwarded = q.marksAwarded ?? 0
  const isNegative = marksAwarded < 0
  const negMarks = q.negativeMarks ?? 0

  const typeLabel =
    q.type && q.type !== "MCQ"
      ? q.type.replace("_", " ").toLowerCase()
      : null

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
            {typeLabel && (
              <Badge variant="secondary" className="text-[10px] uppercase">
                {typeLabel}
              </Badge>
            )}
            {q.category && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {q.category}
              </Badge>
            )}
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                isNegative
                  ? "bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300"
                  : answeredCorrectly
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "",
              )}
            >
              {isNegative ? (
                <>
                  <Minus className="size-3" />
                  {Math.abs(marksAwarded).toFixed(2).replace(/\.?0+$/, "")} /
                  {q.marks}
                </>
              ) : (
                <>
                  {marksAwarded} / {q.marks} marks
                </>
              )}
            </Badge>
            {isNegative && negMarks > 0 && (
              <Badge
                variant="outline"
                className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              >
                -{negMarks} penalty
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm font-medium leading-snug">{q.question}</p>
        </div>
      </div>

      {/* MCQ / TRUE_FALSE options */}
      {q.options && q.options.length > 0 && (
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
      )}

      {/* FILL_BLANK / CODING */}
      {(q.type === "FILL_BLANK" || q.type === "CODING") && (
        <div className="space-y-2 text-sm">
          <div
            className={cn(
              "rounded-md border p-2.5",
              answeredCorrectly
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Your answer
            </p>
            <p className="mt-1 font-mono text-xs whitespace-pre-wrap break-words">
              {q.chosenText || <span className="italic text-muted-foreground">— No answer —</span>}
            </p>
          </div>
          {!answeredCorrectly && q.correctText && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5 dark:border-emerald-800 dark:bg-emerald-950/40">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Correct answer
              </p>
              <p className="mt-1 font-mono text-xs whitespace-pre-wrap break-words">
                {q.correctText}
              </p>
            </div>
          )}
        </div>
      )}

      {/* MATCHING */}
      {q.type === "MATCHING" && q.matchPairs && q.matchPairs.length > 0 && (
        <div className="space-y-1.5 text-sm">
          {q.matchPairs.map((pair, i) => {
            const chosenRight = q.chosenMatches?.[pair.left]
            const isMatch = chosenRight === pair.right
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded-md border p-2 text-xs",
                  isMatch
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                    : chosenRight
                      ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
                      : "border-border bg-muted/30",
                )}
              >
                <span className="flex-1 font-medium">{pair.left}</span>
                <span className="text-muted-foreground">→</span>
                <span className="flex-1 font-mono">
                  {chosenRight || <span className="italic text-muted-foreground">—</span>}
                </span>
                <span className="text-muted-foreground">/ {pair.right}</span>
                {isMatch ? (
                  <Check className="size-3 text-emerald-600" />
                ) : (
                  <X className="size-3 text-red-600" />
                )}
              </div>
            )
          })}
        </div>
      )}

      {unanswered && !hasTextAnswer && (
        <p className="mt-2 text-xs italic text-muted-foreground">
          No answer recorded.
        </p>
      )}

      {q.explanation && (
        <div className="mt-3 rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Explanation: </span>
          {q.explanation}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tiny icon shims (avoids importing more lucide-react icons at the top).
// We use these for the optional new anti-cheat badges.
// ---------------------------------------------------------------------------

function MonitorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  )
}
function CameraIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}
function KeyboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M8 14h8" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// PNG report generator (Canvas 2D)
// ---------------------------------------------------------------------------

function buildReportPng(input: {
  studentName: string
  eventTitle: string
  score: number
  totalMarks: number
  percentage: number
  passed: boolean
  status: string
  completedAt: string | null
  timeTaken: number
  categoryStats: AttemptCategoryStat[]
}): Promise<Blob | null> {
  const W = 800
  const H = 1000
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) return Promise.resolve(null)

  // Background
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, H)

  // Emerald border
  ctx.strokeStyle = "#10b981"
  ctx.lineWidth = 6
  ctx.strokeRect(20, 20, W - 40, H - 40)

  // Inner subtle border
  ctx.strokeStyle = "#d1fae5"
  ctx.lineWidth = 1
  ctx.strokeRect(34, 34, W - 68, H - 68)

  // Top accent bar
  ctx.fillStyle = "#10b981"
  ctx.fillRect(40, 50, W - 80, 4)

  // Header / brand
  ctx.fillStyle = "#064e3b"
  ctx.font = "bold 28px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("Engagio", W / 2, 110)

  ctx.fillStyle = "#6b7280"
  ctx.font = "16px sans-serif"
  ctx.fillText("Result Report", W / 2, 138)

  // Divider
  ctx.strokeStyle = "#e5e7eb"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(120, 160)
  ctx.lineTo(W - 120, 160)
  ctx.stroke()

  // Event title
  ctx.fillStyle = "#6b7280"
  ctx.font = "12px sans-serif"
  ctx.fillText("EVENT", W / 2, 190)
  ctx.fillStyle = "#0f172a"
  ctx.font = "bold 22px sans-serif"
  // Wrap event title if too long
  const eventTitle = truncateText(ctx, input.eventTitle, W - 160)
  ctx.fillText(eventTitle, W / 2, 220)

  // Participant name
  ctx.fillStyle = "#6b7280"
  ctx.font = "12px sans-serif"
  ctx.fillText("PARTICIPANT", W / 2, 270)
  ctx.fillStyle = "#0f172a"
  ctx.font = "bold 20px sans-serif"
  ctx.fillText(truncateText(ctx, input.studentName, W - 160), W / 2, 298)

  // Score block
  const scoreY = 360
  // Score circle background
  const passed = input.passed
  const circleColor = passed ? "#10b981" : "#f43f5e"

  // Big percentage in center
  ctx.fillStyle = circleColor
  ctx.font = "bold 84px sans-serif"
  ctx.fillText(`${input.percentage}%`, W / 2, scoreY + 20)

  // Score text
  ctx.fillStyle = "#374151"
  ctx.font = "20px sans-serif"
  ctx.fillText(
    `${input.score} / ${input.totalMarks} marks`,
    W / 2,
    scoreY + 60,
  )

  // Pass/Fail badge
  const badgeY = scoreY + 90
  const badgeLabel = passed ? "PASSED" : (input.status || "FAILED").toUpperCase()
  const badgeColor = passed ? "#10b981" : input.status === "Time Out" ? "#f59e0b" : "#f43f5e"
  ctx.fillStyle = badgeColor
  const badgeWidth = 160
  const badgeHeight = 36
  const badgeX = W / 2 - badgeWidth / 2
  // rounded rect
  roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 8)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 16px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(badgeLabel, W / 2, badgeY + badgeHeight / 2 + 1)
  ctx.textBaseline = "alphabetic"

  // Meta row (date + time)
  const metaY = badgeY + 80
  ctx.fillStyle = "#6b7280"
  ctx.font = "13px sans-serif"
  const dateStr = input.completedAt
    ? format(new Date(input.completedAt), "MMM d, yyyy · HH:mm")
    : format(new Date(), "MMM d, yyyy · HH:mm")
  ctx.fillText(
    `Completed: ${dateStr}`,
    W / 2,
    metaY,
  )
  ctx.fillText(
    `Time taken: ${formatDuration(input.timeTaken)}`,
    W / 2,
    metaY + 22,
  )

  // Category breakdown table
  const tableY = metaY + 60
  ctx.fillStyle = "#064e3b"
  ctx.font = "bold 16px sans-serif"
  ctx.textAlign = "left"
  ctx.fillText("Performance by Category", 80, tableY)

  // Table header
  const headerY = tableY + 24
  ctx.fillStyle = "#f1f5f9"
  ctx.fillRect(80, headerY, W - 160, 28)
  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 1
  ctx.strokeRect(80, headerY, W - 160, 28)

  ctx.fillStyle = "#0f172a"
  ctx.font = "bold 12px sans-serif"
  ctx.textAlign = "left"
  ctx.fillText("CATEGORY", 90, headerY + 19)
  ctx.fillText("SCORE", 380, headerY + 19)
  ctx.fillText("CORRECT", 490, headerY + 19)
  ctx.fillText("PCT", 620, headerY + 19)
  ctx.textAlign = "right"
  ctx.fillText("%", W - 90, headerY + 19)
  ctx.textAlign = "left"

  // Rows
  const rows = input.categoryStats.slice(0, 6)
  let rowY = headerY + 28
  for (const row of rows) {
    const pct = row.maxScore > 0 ? Math.round((row.score / row.maxScore) * 100) : 0
    // Alternating bg
    if ((rows.indexOf(row) % 2) === 1) {
      ctx.fillStyle = "#fafafa"
      ctx.fillRect(80, rowY, W - 160, 26)
    }
    ctx.strokeStyle = "#e2e8f0"
    ctx.strokeRect(80, rowY, W - 160, 26)

    ctx.fillStyle = "#0f172a"
    ctx.font = "12px sans-serif"
    ctx.textAlign = "left"
    ctx.fillText(truncateText(ctx, row.category, 280), 90, rowY + 18)
    ctx.fillText(`${row.score}/${row.maxScore}`, 380, rowY + 18)
    ctx.fillText(`${row.correct}/${row.total}`, 490, rowY + 18)

    // Pct bar
    const barX = 620
    const barWidth = 60
    ctx.fillStyle = "#e5e7eb"
    ctx.fillRect(barX, rowY + 8, barWidth, 10)
    const barColor =
      pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#f43f5e"
    ctx.fillStyle = barColor
    ctx.fillRect(barX, rowY + 8, Math.max(2, (pct / 100) * barWidth), 10)

    ctx.fillStyle = barColor
    ctx.font = "bold 12px sans-serif"
    ctx.textAlign = "right"
    ctx.fillText(`${pct}%`, W - 90, rowY + 18)
    ctx.textAlign = "left"

    rowY += 26
  }

  // Footer
  ctx.fillStyle = "#9ca3af"
  ctx.font = "11px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText(
    "Generated by Engagio — This report is for informational purposes only.",
    W / 2,
    H - 60,
  )
  ctx.fillText(
    `© ${new Date().getFullYear()} Engagio`,
    W / 2,
    H - 42,
  )

  // Convert to blob asynchronously via canvas.toBlob.
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png")
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let truncated = text
  while (
    truncated.length > 1 &&
    ctx.measureText(truncated + "…").width > maxWidth
  ) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + "…"
}
