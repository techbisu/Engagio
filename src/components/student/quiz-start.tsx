"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Clock,
  HelpCircle,
  Layers,
  Maximize,
  PlayCircle,
  ShieldAlert,
  Target,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

import { api } from "./api"
import type { AttemptListResponse, QuizLinkBySlugResponse } from "./api"
import { cn } from "@/lib/utils"
import type { SafeUser } from "@/types"

export interface QuizStartProps {
  slug: string
  user: SafeUser
  onBegin: (meta: QuizLinkBySlugResponse) => void
  onBack: () => void
}

export function QuizStart({ slug, user, onBegin, onBack }: QuizStartProps) {
  const {
    data: meta,
    isLoading,
    isError,
    error,
  } = useQuery<QuizLinkBySlugResponse>({
    queryKey: ["quiz-link", slug],
    queryFn: () => api<QuizLinkBySlugResponse>(`/api/quiz-links/by-slug/${encodeURIComponent(slug)}`),
    retry: false,
  })

  // Fetch the user's attempts to figure out remaining attempts (only if logged in)
  const { data: attemptsData } = useQuery<AttemptListResponse>({
    queryKey: ["attempts", "list"],
    queryFn: () => api<AttemptListResponse>("/api/attempts/list"),
    enabled: !!user,
  })

  const usedAttempts = React.useMemo(() => {
    if (!attemptsData?.attempts || !meta) return 0
    return attemptsData.attempts.filter(
      (a) =>
        a.quizLink?.slug === meta.quizLink.slug &&
        a.status !== "IN_PROGRESS",
    ).length
  }, [attemptsData, meta])

  const maxAttempts = meta?.maxAttempts ?? 0
  const remaining =
    maxAttempts > 0 ? Math.max(0, maxAttempts - usedAttempts) : Infinity
  const maxReached = maxAttempts > 0 && remaining <= 0

  // Loading state
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 text-muted-foreground">
          <ArrowLeft className="size-4" /> Back to Dashboard
        </Button>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error / not found / inactive / expired
  if (isError || !meta) {
    const message =
      error instanceof Error
        ? error.message
        : "We couldn't load this quiz. Please check the code and try again."
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 text-muted-foreground">
          <ArrowLeft className="size-4" /> Back to Dashboard
        </Button>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              <CardTitle>Quiz unavailable</CardTitle>
            </div>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBack} variant="outline">
              <ArrowLeft className="size-4" /> Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const event = meta.event
  const quizLink = meta.quizLink
  const hasImage = !!event?.image

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 text-muted-foreground">
        <ArrowLeft className="size-4" /> Back to Dashboard
      </Button>

      {/* Hero card */}
      <Card className="overflow-hidden">
        {hasImage && (
          <div className="relative aspect-[16/7] w-full bg-slate-100 dark:bg-slate-800">
            <img
              src={event!.image!}
              alt={event!.title}
              className="size-full object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = "none"
              }}
            />
          </div>
        )}
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
              Quiz code: {quizLink.slug}
            </Badge>
            {meta.requireFullscreen && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                <Maximize className="size-3" /> Fullscreen required
              </Badge>
            )}
          </div>
          <CardTitle className="text-2xl">{event?.title ?? "Quiz"}</CardTitle>
          {event?.description && (
            <CardDescription className="text-sm leading-relaxed sm:text-base">
              {event.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Summary grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryItem
              icon={HelpCircle}
              label="Questions"
              value={String(meta.questionCount)}
            />
            <SummaryItem
              icon={Clock}
              label="Time limit"
              value={meta.timeLimit > 0 ? `${meta.timeLimit} min` : "No limit"}
            />
            <SummaryItem
              icon={Target}
              label="Pass mark"
              value={`${meta.passThreshold}%`}
            />
            <SummaryItem
              icon={Layers}
              label="Max attempts"
              value={meta.maxAttempts > 0 ? String(meta.maxAttempts) : "∞"}
            />
          </div>

          <Separator />

          {/* Anti-cheat warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Anti-cheat protection enabled
                </p>
                <p className="text-amber-800 dark:text-amber-300">
                  You&apos;ll need to enter fullscreen mode. Switching tabs,
                  copying, or right-clicking will be flagged. Your IP and device
                  info will be logged.
                </p>
              </div>
            </div>
          </div>

          {/* Attempts info */}
          {maxAttempts > 0 && (
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4",
                maxReached
                  ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
              )}
            >
              <Award
                className={cn(
                  "size-5 shrink-0",
                  maxReached
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              />
              <div className="flex-1 text-sm">
                {maxReached ? (
                  <>
                    <p className="font-semibold text-red-900 dark:text-red-200">
                      Max attempts reached
                    </p>
                    <p className="text-red-700 dark:text-red-300">
                      You&apos;ve used all {maxAttempts} attempt
                      {maxAttempts === 1 ? "" : "s"} for this quiz.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                      {remaining} attempt{remaining === 1 ? "" : "s"} remaining
                    </p>
                    <p className="text-emerald-700 dark:text-emerald-300">
                      You&apos;ve used {usedAttempts} of {maxAttempts}.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onBack} className="sm:order-1">
              <ArrowLeft className="size-4" /> Back to Dashboard
            </Button>
            <Button
              onClick={() => meta && onBegin(meta)}
              disabled={maxReached}
              className="bg-emerald-600 text-white hover:bg-emerald-700 sm:order-2"
            >
              {maxReached ? (
                <>
                  <AlertTriangle className="size-4" /> Max attempts reached
                </>
              ) : (
                <>
                  <PlayCircle className="size-4" /> Begin Quiz
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <Icon className="mx-auto mb-1 size-4 text-emerald-600 dark:text-emerald-400" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
