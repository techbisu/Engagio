"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageCircleQuestion,
  MonitorPlay,
  Play,
  Vote,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type {
  ActivityDto,
  ActivityType,
  SafeUser,
} from "@/types"

import { api } from "./api"
import type { ActivityBySlugResponse } from "./api"
import { isQuizLike } from "./api"

import { PollVote } from "./poll-vote"
import { SurveyForm } from "./survey-form"
import { QASubmit } from "./qa-submit"
import { ActivityResultsView } from "./activity-results-view"

// ─── Activity type → icon mapping ────────────────────────────────────────────
const ACTIVITY_ICON: Record<ActivityType, typeof Vote> = {
  QUIZ: HelpCircle,
  LIVE_QUIZ: HelpCircle,
  POLL: Vote,
  SURVEY: ClipboardList,
  FEEDBACK: ListChecks,
  Q_AND_A: MessageCircleQuestion,
  VOTING: Vote,
  KNOWLEDGE_CHECK: HelpCircle,
  PRE_POST_ASSESSMENT: HelpCircle,
}

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  QUIZ: "Quiz",
  LIVE_QUIZ: "Live Quiz",
  POLL: "Poll",
  SURVEY: "Survey",
  FEEDBACK: "Feedback",
  Q_AND_A: "Q&A",
  VOTING: "Voting",
  KNOWLEDGE_CHECK: "Knowledge Check",
  PRE_POST_ASSESSMENT: "Assessment",
}

export interface ActivityJoinProps {
  slug: string
  user: SafeUser
  onExit: () => void
  /** Optional: called when user wants to open the projector view. */
  onOpenLiveDisplay?: (activityId: string, type: ActivityType) => void
  /** Optional: called when this activity is a quiz-type and we want to
   *  route to the existing quiz flow. */
  onQuizRedirect?: (quizSlug: string) => void
}

type Phase = "pre" | "active" | "submitted" | "view-results"

/**
 * ActivityJoin — orchestrates the participant flow for any activity type.
 *
 * 1. Fetches the activity by slug.
 * 2. Renders a pre-activity screen with title, type icon, status, and CTA.
 * 3. Renders the appropriate participation component based on type.
 * 4. After submitting: shows success state + "View Results" button (if showResults).
 */
export function ActivityJoin({
  slug,
  user,
  onExit,
  onOpenLiveDisplay,
  onQuizRedirect,
}: ActivityJoinProps) {
  // Discard `user` — present in the props for future use (e.g., showing
  // participant name in the Q&A submission) but not currently needed here.
  void user

  const queryClient = useQueryClient()
  const [phase, setPhase] = React.useState<Phase>("pre")

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<ActivityBySlugResponse>({
    queryKey: ["activity-by-slug", slug],
    queryFn: () =>
      api<ActivityBySlugResponse>(
        `/api/activities/by-slug/${encodeURIComponent(slug)}`,
      ),
    retry: false,
  })

  // ─── Quiz-type redirect (top-level effect, no hooks violations) ─────────
  // If the fetched activity is a QUIZ/KNOWLEDGE_CHECK/PRE_POST_ASSESSMENT,
  // redirect to the existing quiz flow once.
  const quizSlug = data?.activity ? data.activity.quizLink?.slug : undefined
  const isQuizType =
    !!data?.activity && isQuizLike(data.activity.type) && !!quizSlug

  React.useEffect(() => {
    if (!isQuizType || !quizSlug) return
    if (onQuizRedirect) {
      onQuizRedirect(quizSlug)
      return
    }
    if (typeof window !== "undefined") {
      window.location.href = `/quiz/${encodeURIComponent(quizSlug)}`
    }
  }, [isQuizType, quizSlug, onQuizRedirect])

  // ─── Loading state ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="mb-4 text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="mt-2 h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Error / not found ──────────────────────────────────────────────────
  if (isError || !data) {
    const msg =
      error instanceof Error
        ? error.message
        : "We couldn't load this activity. Please check the link and try again."
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="mb-4 text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              <h2 className="text-lg font-semibold">Activity unavailable</h2>
            </div>
            <p className="text-sm text-muted-foreground">{msg}</p>
          </CardHeader>
          <CardContent>
            <Button onClick={onExit} variant="outline">
              <ArrowLeft className="size-4" /> Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { activity, questions, hasResponded } = data
  const Icon = ACTIVITY_ICON[activity.type] ?? HelpCircle
  const showResults = activity.settings.showResults !== false
  const isOneResponseActivity =
    activity.type === "POLL" ||
    activity.type === "VOTING" ||
    activity.type === "SURVEY" ||
    activity.type === "FEEDBACK"

  // ─── Quiz-type redirect placeholder ─────────────────────────────────────
  // (The actual redirect fires from the top-level effect above.)
  if (isQuizLike(activity.type)) {
    if (!quizSlug) {
      return (
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="mb-4 text-muted-foreground"
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500" />
                <h2 className="text-lg font-semibold">Quiz not linked</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                This activity is configured as a quiz but doesn&apos;t have a
                quiz link attached. Please contact the organizer.
              </p>
            </CardHeader>
          </Card>
        </div>
      )
    }
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-center">
        <Loader2 className="mx-auto size-6 animate-spin text-emerald-500" />
        <p className="mt-3 text-sm text-muted-foreground">
          Redirecting you to the quiz…
        </p>
      </div>
    )
  }

  // ─── Live quiz — MVP placeholder ────────────────────────────────────────
  if (activity.type === "LIVE_QUIZ") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="mb-4 text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <PreActivityCard
          activity={activity}
          icon={Icon}
          title="Live quiz starting soon…"
          subtitle="Hang tight — the host will start the quiz in a moment."
          showResults={showResults}
          onViewResults={() => setPhase("view-results")}
          onOpenLiveDisplay={onOpenLiveDisplay}
        />
      </div>
    )
  }

  // ─── View-results state ─────────────────────────────────────────────────
  if (phase === "view-results") {
    return (
      <ActivityResultsView
        activityId={activity.id}
        type={activity.type}
        onBack={() => {
          // For Q&A (multiple submissions allowed) → back to active.
          // For one-response activities that already submitted → back to
          // the submitted success card.
          setPhase(activity.type === "Q_AND_A" ? "active" : "submitted")
        }}
      />
    )
  }

  // ─── Submitted success state ───────────────────────────────────────────
  if (phase === "submitted") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Card className="border-emerald-200 dark:border-emerald-900">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <motion.span
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              className="grid size-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 className="size-9" />
            </motion.span>
            <h2 className="text-2xl font-bold text-foreground">Thank you!</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Your {ACTIVITY_LABEL[activity.type].toLowerCase()} response has been
              recorded successfully.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {showResults && (
                <Button
                  onClick={() => setPhase("view-results")}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <BarChart3 className="size-4" /> View Results
                </Button>
              )}
              <Button variant="ghost" onClick={onExit}>
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Already-responded gate (one-response activities only) ──────────────
  const alreadyResponded = isOneResponseActivity && hasResponded
  if (phase === "pre" && alreadyResponded) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="mb-4 text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <PreActivityCard
          activity={activity}
          icon={Icon}
          title="You've already responded."
          subtitle="Thanks for participating! You can view the live results below."
          showResults={showResults}
          onViewResults={() => setPhase("view-results")}
          onOpenLiveDisplay={onOpenLiveDisplay}
        />
      </div>
    )
  }

  // ─── Pre-activity card ──────────────────────────────────────────────────
  if (phase === "pre") {
    const status = activity.status
    let primaryCta: React.ReactNode = null
    let subtitle: string = activity.description || ""

    if (status === "SCHEDULED") {
      primaryCta = null
      subtitle =
        "This activity starts soon. Check back later." +
        (activity.startsAt
          ? ` Scheduled to start at ${formatDateTime(activity.startsAt)}.`
          : "")
    } else if (status === "CLOSED" || status === "COMPLETED") {
      primaryCta = showResults ? (
        <Button
          onClick={() => setPhase("view-results")}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <BarChart3 className="size-4" /> View Results
        </Button>
      ) : null
      subtitle = "This activity has ended."
    } else if (status === "LIVE" || status === "DRAFT") {
      primaryCta = (
        <Button
          onClick={() => setPhase("active")}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Play className="size-4" /> Join Now
        </Button>
      )
    }

    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="mb-4 text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <PreActivityCard
          activity={activity}
          icon={Icon}
          title={activity.title}
          subtitle={subtitle}
          primaryCta={primaryCta}
          showResults={showResults}
          onViewResults={() => setPhase("view-results")}
          onOpenLiveDisplay={onOpenLiveDisplay}
          countdownTarget={activity.startsAt ?? undefined}
        />
      </div>
    )
  }

  // ─── Active participation ───────────────────────────────────────────────
  const handleSubmitted = () => {
    queryClient.invalidateQueries({
      queryKey: ["activity-by-slug", slug],
    })
    if (activity.type === "Q_AND_A") {
      // Q&A: keep them in the active view (multiple submissions allowed).
      toast.info("Your question was sent for moderation.")
    } else {
      setPhase("submitted")
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
      {/* Compact header */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPhase("pre")}
          className="text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <h1 className="flex-1 truncate text-base font-semibold text-foreground sm:text-lg">
          {activity.title}
        </h1>
      </div>

      {activity.type === "POLL" || activity.type === "VOTING" ? (
        questions.length > 0 ? (
          <PollVote
            activity={activity}
            question={questions[0]}
            onSubmit={handleSubmitted}
          />
        ) : (
          <EmptyQuestion />
        )
      ) : activity.type === "SURVEY" || activity.type === "FEEDBACK" ? (
        <SurveyForm
          activity={activity}
          questions={questions}
          onSubmit={handleSubmitted}
        />
      ) : activity.type === "Q_AND_A" ? (
        <QASubmit activity={activity} onSubmit={handleSubmitted} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            This activity type ({activity.type}) is not yet supported.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

interface PreActivityCardProps {
  activity: ActivityDto
  icon: typeof Vote
  title: string
  subtitle: string
  primaryCta?: React.ReactNode
  showResults: boolean
  onViewResults: () => void
  onOpenLiveDisplay?: (activityId: string, type: ActivityType) => void
  countdownTarget?: string
}

function PreActivityCard({
  activity,
  icon: Icon,
  title,
  subtitle,
  primaryCta,
  showResults,
  onViewResults,
  onOpenLiveDisplay,
  countdownTarget,
}: PreActivityCardProps) {
  const isLive = activity.status === "LIVE"
  const isEnded =
    activity.status === "CLOSED" || activity.status === "COMPLETED"
  const isScheduled = activity.status === "SCHEDULED"

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "gap-1",
              isLive
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                : isEnded
                  ? "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
            )}
          >
            <Icon className="size-3" />
            {ACTIVITY_LABEL[activity.type]}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              isLive
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
                : isEnded
                  ? "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
            )}
          >
            <span
              className={cn(
                "mr-1 inline-block size-1.5 rounded-full",
                isLive
                  ? "animate-pulse bg-emerald-500"
                  : isEnded
                    ? "bg-slate-400"
                    : "bg-amber-500",
              )}
            />
            {activity.status}
          </Badge>
          {activity.slug && (
            <Badge variant="outline" className="text-muted-foreground">
              Code: {activity.slug}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Live countdown */}
        {isScheduled && countdownTarget && (
          <CountdownRow targetIso={countdownTarget} />
        )}

        {/* Live display link */}
        {isLive && onOpenLiveDisplay && (
          <Button
            variant="outline"
            onClick={() => onOpenLiveDisplay(activity.id, activity.type)}
            className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40 sm:w-auto"
          >
            <MonitorPlay className="size-4" /> Open Projector View
          </Button>
        )}

        {/* Primary CTA + optional View Results secondary */}
        {primaryCta ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            {primaryCta}
            {showResults && (
              <Button
                variant="ghost"
                onClick={onViewResults}
                className="text-muted-foreground"
              >
                <BarChart3 className="size-4" /> View Results
              </Button>
            )}
          </div>
        ) : showResults ? (
          // No primary CTA (e.g. SCHEDULED or CLOSED) — show View Results
          // prominently if results are visible.
          <Button
            onClick={onViewResults}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
          >
            <BarChart3 className="size-4" /> View Results
          </Button>
        ) : null}

        {/* Host hint */}
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900/40">
          <p className="flex items-center gap-1.5">
            <Lightbulb className="size-3.5 text-amber-500" />
            {isLive
              ? "Join now to participate. Your response will be counted immediately."
              : isEnded
                ? "This activity is no longer accepting responses."
                : isScheduled
                  ? "This activity hasn't started yet. Please wait for the host to open it."
                  : "This activity is not yet live. Please wait for the host to start it."}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function CountdownRow({ targetIso }: { targetIso: string }) {
  const target = React.useMemo(() => new Date(targetIso).getTime(), [targetIso])
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const remaining = Math.max(0, target - now)
  if (remaining <= 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
        <CalendarClock className="size-4" />
        This activity should be starting now. Refresh the page.
      </div>
    )
  }

  const { d, h, m, s } = splitDuration(remaining)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
      <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
        <Clock className="size-4" /> Starts in
      </p>
      <div className="flex items-center gap-2">
        {d > 0 && <CountdownUnit label="days" value={d} />}
        <CountdownUnit label="hrs" value={h} />
        <CountdownUnit label="min" value={m} />
        <CountdownUnit label="sec" value={s} />
      </div>
    </div>
  )
}

function CountdownUnit({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center rounded-md bg-white/70 px-3 py-1.5 dark:bg-slate-900/60">
      <span className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

function splitDuration(ms: number): {
  d: number
  h: number
  m: number
  s: number
} {
  const total = Math.floor(ms / 1000)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return { d, h, m, s }
}

function EmptyQuestion() {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        This activity doesn&apos;t have any questions yet. Check back later.
      </CardContent>
    </Card>
  )
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}
