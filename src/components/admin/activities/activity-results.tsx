"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  ThumbsUp,
  Star,
  MessageSquare,
  TrendingUp,
  FileQuestion,
  BarChart3,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, truncate } from "@/lib/utils"

import { api, ACTIVITY_TYPE_META, ACTIVITY_STATUS_META } from "./api"
import type {
  ActivityDto,
  ActivityResultsDto,
  ActivityResponseDto,
  PollOptionResult,
} from "@/types"

interface ActivityResultsProps {
  activity: ActivityDto
  onBack: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildShareUrl(slug?: string | null): string {
  if (typeof window === "undefined") return ""
  if (!slug) return ""
  return `${window.location.origin}/?activity=${slug}`
}

function buildExportUrl(id: string): string {
  return `/api/activities/${id}/export`
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return "0%"
  return `${Math.round(n * 10) / 10}%`
}

// A deterministic color from the emerald/teal/amber/slate palette.
const PALETTE = [
  "bg-emerald-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-slate-500",
  "bg-rose-500",
  "bg-emerald-400",
  "bg-teal-400",
  "bg-amber-400",
]

function pickColor(i: number): string {
  return PALETTE[i % PALETTE.length]
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ActivityResults({ activity, onBack }: ActivityResultsProps) {
  const qc = useQueryClient()
  const isLive = activity.status === "LIVE"

  const { data, isLoading, isError, error, refetch } =
    useQuery<ActivityResultsDto>({
      queryKey: ["activity-results", activity.id],
      queryFn: () =>
        api<ActivityResultsDto>(`/api/activities/${activity.id}/results`),
      // Auto-refresh while LIVE.
      refetchInterval: isLive ? 5000 : false,
    })

  function exportCsv() {
    const url = buildExportUrl(activity.id)
    // Use a hidden anchor to trigger download (preserves cookies).
    const a = document.createElement("a")
    a.href = url
    a.rel = "noopener noreferrer"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success("Export started")
  }

  function openLiveDisplay() {
    const url = buildShareUrl(activity.slug)
    if (!url) {
      toast.error("No share URL available")
      return
    }
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const typeMeta = ACTIVITY_TYPE_META[activity.type]
  const statusMeta = ACTIVITY_STATUS_META[activity.status]
  const TypeIcon = typeMeta.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-4"
    >
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={openLiveDisplay}
          >
            <ExternalLink className="size-4" /> Open Live Display
          </Button>
        </div>
      </div>

      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-lg ring-1",
                typeMeta.iconWrap
              )}
            >
              <TypeIcon className="size-4" />
            </span>
            <Badge className={cn(typeMeta.badgeClass)}>{typeMeta.label}</Badge>
            <Badge className={cn(statusMeta.badgeClass, "gap-1.5")}>
              {statusMeta.pulse && (
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
              )}
              {statusMeta.label}
            </Badge>
            {isLive && (
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
              >
                Auto-refresh 5s
              </Badge>
            )}
          </div>
          <CardTitle className="mt-2 text-xl">{activity.title}</CardTitle>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {typeof data?.totalResponses === "number" && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" /> {data.totalResponses} responses
              </span>
            )}
            {typeof data?.totalParticipants === "number" &&
              data.totalParticipants > 0 && (
                <span className="inline-flex items-center gap-1">
                  <BarChart3 className="size-3" /> {data.totalParticipants}{" "}
                  participants
                </span>
              )}
            {activity.session && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="size-3" /> {activity.session}
              </span>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Body */}
      {isLoading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : isError ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-rose-600">
              Could not load results: {(error as Error).message}
            </p>
            <Button variant="outline" className="mt-3" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : !data ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No results available.
          </CardContent>
        </Card>
      ) : (
        <ResultsBody activity={activity} data={data} />
      )}

      {/* Q&A moderation */}
      {activity.type === "Q_AND_A" && data?.questions && (
        <QAndAModeration
          activityId={activity.id}
          questions={data.questions}
        />
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Results body — switches by activity type
// ---------------------------------------------------------------------------

function ResultsBody({
  activity,
  data,
}: {
  activity: ActivityDto
  data: ActivityResultsDto
}) {
  if (activity.type === "QUIZ" || activity.type === "LIVE_QUIZ") {
    return <QuizResultsCard activity={activity} />
  }

  if (activity.type === "Q_AND_A") {
    if (!data.questions || data.questions.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No questions submitted yet.
          </CardContent>
        </Card>
      )
    }
    return null // Rendered via the Q&A moderation block below.
  }

  // POLL / VOTING / KNOWLEDGE_CHECK: simple option breakdown.
  if (
    (activity.type === "POLL" ||
      activity.type === "VOTING" ||
      activity.type === "KNOWLEDGE_CHECK") &&
    data.options
  ) {
    return (
      <OptionsResultsCard
        options={data.options}
        total={data.totalResponses}
      />
    )
  }

  // SURVEY / FEEDBACK / PRE_POST_ASSESSMENT: per-question breakdown.
  if (data.questionResults && data.questionResults.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        {data.questionResults.map((q, i) => (
          <QuestionResultCard
            key={q.questionId}
            index={i}
            text={q.questionText}
            type={q.questionType}
            options={q.optionResults}
            averageRating={q.averageRating}
            textResponses={q.textResponses}
            responseCount={q.responseCount}
          />
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        No results available yet.
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Quiz results card
// ---------------------------------------------------------------------------

function QuizResultsCard({ activity }: { activity: ActivityDto }) {
  function viewAttempts() {
    if (activity.quizLink?.slug) {
      // Open in new tab — participant attempts table is admin-only, so route
      // via /admin?tab=attempts&slug=... (best-effort; admin-shell handles tab).
      const url = `${window.location.origin}/?adminTab=attempts&slug=${activity.quizLink!.slug}`
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-6">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/30">
          <FileQuestion className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium">Quiz attempts & results</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Quiz-type activities reuse the existing Quiz Attempts system. View
            per-participant attempts, scores, and analytics on the Attempts tab
            filtered by the linked quiz link.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={viewAttempts} disabled={!activity.quizLink?.slug}>
            <TrendingUp className="size-4" />
            View Quiz Results
          </Button>
        </div>
        {!activity.quizLink?.slug && (
          <p className="text-xs text-amber-600">
            This QUIZ activity has no linked quiz link.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Poll / Voting results — horizontal bar chart with bars + percentages.
// ---------------------------------------------------------------------------

function OptionsResultsCard({
  options,
  total,
}: {
  options: PollOptionResult[]
  total: number
}) {
  const sorted = [...options].sort((a, b) => b.count - a.count)
  const max = Math.max(1, ...sorted.map((o) => o.count))
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <BarChart3 className="size-4 text-emerald-600 dark:text-emerald-400" />
            Results
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {total} responses
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No responses yet.
          </p>
        ) : (
          sorted.map((opt, i) => {
            const color = pickColor(i)
            return (
              <div key={opt.index} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {truncate(opt.label, 80)}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {opt.count} {opt.count === 1 ? "vote" : "votes"} ·{" "}
                    {formatPct(opt.percentage)}
                  </span>
                </div>
                <div className="relative h-7 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800/60">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(opt.count / max) * 100}%`,
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={cn("h-full rounded-md", color)}
                  />
                  <span className="absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-white mix-blend-difference">
                    {formatPct(opt.percentage)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Survey / Feedback — per-question breakdown
// ---------------------------------------------------------------------------

function QuestionResultCard({
  index,
  text,
  type,
  options,
  averageRating,
  textResponses,
  responseCount,
}: {
  index: number
  text: string
  type: string
  options?: PollOptionResult[]
  averageRating?: number
  textResponses?: string[]
  responseCount: number
}) {
  const hasOptions =
    type === "SINGLE_CHOICE" ||
    type === "MULTIPLE_CHOICE" ||
    type === "YES_NO"
  const isRating = type === "RATING"
  const isText = type === "TEXT" || type === "OPEN"
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm whitespace-pre-wrap break-words">
              {text}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {responseCount} {responseCount === 1 ? "response" : "responses"}
              {" · "}
              <span className="uppercase tracking-wide">{type.replace("_", " ")}</span>
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {hasOptions && options && options.length > 0 && (
          <OptionsBreakdown options={options} total={responseCount} />
        )}
        {isRating && typeof averageRating === "number" && (
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Star className="size-4 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                Average: {averageRating.toFixed(2)} / 5
              </p>
              <RatingDistribution
                options={options ?? []}
                total={responseCount}
              />
            </div>
          </div>
        )}
        {isText && textResponses && textResponses.length > 0 && (
          <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
            {textResponses.map((r, i) => (
              <li
                key={i}
                className="rounded-md border bg-slate-50 p-2 text-sm text-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
              >
                {r}
              </li>
            ))}
          </ul>
        )}
        {type === "NUMBER" && typeof averageRating === "number" && (
          <div className="rounded-lg border p-3">
            <p className="text-sm">
              Average:{" "}
              <span className="font-semibold">{averageRating.toFixed(2)}</span>
            </p>
          </div>
        )}
        {responseCount === 0 && (
          <p className="py-3 text-center text-sm text-muted-foreground">
            No responses yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function OptionsBreakdown({
  options,
  total,
}: {
  options: PollOptionResult[]
  total: number
}) {
  const sorted = [...options].sort((a, b) => b.count - a.count)
  const max = Math.max(1, ...sorted.map((o) => o.count))
  return (
    <div className="flex flex-col gap-2">
      {sorted.map((opt, i) => (
        <div key={opt.index} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-700 dark:text-slate-300 truncate pr-2">
              {truncate(opt.label, 80)}
            </span>
            <span className="text-muted-foreground shrink-0">
              {opt.count} · {formatPct(opt.percentage)}
            </span>
          </div>
          <div className="relative h-5 w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-800/60">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(opt.count / max) * 100}%` }}
              transition={{ duration: 0.4 }}
              className={cn("h-full rounded", pickColor(i))}
            />
          </div>
        </div>
      ))}
      {total === 0 && (
        <p className="text-xs text-muted-foreground">No responses yet.</p>
      )}
    </div>
  )
}

function RatingDistribution({
  options,
  total,
}: {
  options: PollOptionResult[]
  total: number
}) {
  if (!options || options.length === 0) return null
  // Sort by rating descending (option label is the rating number).
  const sorted = [...options].sort((a, b) => {
    const ai = parseInt(a.label, 10) || 0
    const bi = parseInt(b.label, 10) || 0
    return bi - ai
  })
  const max = Math.max(1, ...sorted.map((o) => o.count))
  return (
    <div className="mt-2 flex flex-col gap-1">
      {sorted.map((opt, i) => (
        <div key={opt.index} className="flex items-center gap-2 text-xs">
          <span className="w-6 text-right font-mono text-muted-foreground">
            {opt.label}★
          </span>
          <div className="relative h-3 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800/60">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(opt.count / max) * 100}%` }}
              transition={{ duration: 0.4, delay: i * 0.03 }}
              className={cn("h-full rounded", pickColor(i))}
            />
          </div>
          <span className="w-14 text-right text-muted-foreground">
            {opt.count} · {formatPct(opt.percentage)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Q&A moderation
// ---------------------------------------------------------------------------

function QAndAModeration({
  activityId,
  questions,
}: {
  activityId: string
  questions: ActivityResponseDto[]
}) {
  const qc = useQueryClient()
  const moderateMutation = useMutation({
    mutationFn: ({
      responseId,
      action,
    }: {
      responseId: string
      action: "approve" | "hide" | "pin" | "answered"
    }) =>
      api(`/api/activities/${activityId}/qa/moderate`, {
        method: "POST",
        body: JSON.stringify({ responseId, action }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity-results", activityId] })
    },
    onError: (e: Error) => toast.error("Moderation failed: " + e.message),
  })

  // Sort: pinned first, then by upvotes descending, hidden at the end.
  const sorted = [...questions].sort((a, b) => {
    const ah = a.metadata?.hidden ? 1 : 0
    const bh = b.metadata?.hidden ? 1 : 0
    if (ah !== bh) return ah - bh
    const ap = a.metadata?.pinned ? 0 : 1
    const bp = b.metadata?.pinned ? 0 : 1
    if (ap !== bp) return ap - bp
    const au = a.metadata?.upvotes ?? 0
    const bu = b.metadata?.upvotes ?? 0
    return bu - au
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MessageSquare className="size-4 text-teal-600 dark:text-teal-400" />
            Submitted Questions
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {questions.length} total
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 max-h-[28rem] overflow-y-auto pr-1">
        {sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No questions submitted yet.
          </p>
        ) : (
          sorted.map((q) => {
            const meta = q.metadata ?? {}
            const hidden = Boolean(meta.hidden)
            const pinned = Boolean(meta.pinned)
            const answered = Boolean(meta.answered)
            const approved = meta.approved !== false // approved defaults to true if undefined
            const dim = hidden || !approved
            return (
              <motion.div
                key={q.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: dim ? 0.5 : 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "rounded-lg border p-3",
                  pinned &&
                    "border-amber-300 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/5",
                  hidden &&
                    "border-rose-200 bg-rose-50/30 dark:border-rose-500/30 dark:bg-rose-500/5"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <ThumbsUp className="size-3" />
                    {meta.upvotes ?? 0}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm whitespace-pre-wrap break-words",
                        dim && "line-through"
                      )}
                    >
                      {q.text || "(no text)"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {q.participantName || "Anonymous"}
                      {pinned && (
                        <Badge
                          variant="outline"
                          className="ml-2 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                        >
                          <Pin className="size-3" /> Pinned
                        </Badge>
                      )}
                      {answered && (
                        <Badge
                          variant="outline"
                          className="ml-2 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                        >
                          <CheckCircle2 className="size-3" /> Answered
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <ModButton
                    active={pinned}
                    onClick={() =>
                      moderateMutation.mutate({
                        responseId: q.id,
                        action: "pin",
                      })
                    }
                    loading={moderateMutation.isPending}
                    icon={pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
                    label={pinned ? "Unpin" : "Pin"}
                  />
                  <ModButton
                    active={answered}
                    onClick={() =>
                      moderateMutation.mutate({
                        responseId: q.id,
                        action: "answered",
                      })
                    }
                    loading={moderateMutation.isPending}
                    icon={
                      answered ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <Circle className="size-3" />
                      )
                    }
                    label={answered ? "Mark unanswered" : "Mark answered"}
                  />
                  <ModButton
                    active={approved}
                    onClick={() =>
                      moderateMutation.mutate({
                        responseId: q.id,
                        action: "approve",
                      })
                    }
                    loading={moderateMutation.isPending}
                    icon={
                      approved ? (
                        <EyeOff className="size-3" />
                      ) : (
                        <Eye className="size-3" />
                      )
                    }
                    label={approved ? "Hide" : "Approve"}
                  />
                  <ModButton
                    active={!hidden}
                    onClick={() =>
                      moderateMutation.mutate({
                        responseId: q.id,
                        action: "hide",
                      })
                    }
                    loading={moderateMutation.isPending}
                    icon={
                      hidden ? (
                        <Eye className="size-3" />
                      ) : (
                        <EyeOff className="size-3" />
                      )
                    }
                    label={hidden ? "Show" : "Hide"}
                  />
                </div>
              </motion.div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function ModButton({
  active,
  onClick,
  loading,
  icon,
  label,
}: {
  active?: boolean
  onClick: () => void
  loading: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "outline"}
      onClick={onClick}
      disabled={loading}
      className="h-7 gap-1 px-2 text-xs"
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : icon}
      {label}
    </Button>
  )
}
