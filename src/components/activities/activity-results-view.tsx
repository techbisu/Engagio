"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  ArrowBigUp,
  BarChart3,
  Pin,
  RefreshCw,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { api } from "./api"
import type { ActivityResultsDto, ActivityType } from "./api"

export interface ActivityResultsViewProps {
  activityId: string
  type: ActivityType
  onBack?: () => void
}

/**
 * ActivityResultsView — participant-facing, read-only view of live results.
 *
 * - POLL / VOTING → animated horizontal bar chart with percentages.
 * - SURVEY / FEEDBACK → per-question breakdown (aggregates only).
 * - Q_AND_A → list of approved questions sorted by upvotes.
 * - QUIZ / KNOWLEDGE_CHECK / PRE_POST_ASSESSMENT → caller should redirect.
 *
 * Auto-refreshes every 5s via refetchInterval.
 */
export function ActivityResultsView({
  activityId,
  type,
  onBack,
}: ActivityResultsViewProps) {
  const resultsQuery = useQuery<ActivityResultsDto>({
    queryKey: ["activity-results", activityId],
    queryFn: () =>
      api<ActivityResultsDto>(`/api/activities/${activityId}/results`),
    refetchInterval: 5_000,
  })

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      {onBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4 text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <BarChart3 className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">
              Live Results
            </h1>
            <p className="text-xs text-muted-foreground">
              Updates every 5 seconds
            </p>
          </div>
        </div>
        {resultsQuery.isFetching && !resultsQuery.isLoading && (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <RefreshCw className="size-3 animate-spin" /> Refreshing
          </Badge>
        )}
      </div>

      {resultsQuery.isLoading ? (
        <ResultsSkeleton />
      ) : resultsQuery.isError ? (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="py-8 text-center text-sm text-red-600 dark:text-red-400">
            Could not load results. Please try again.
          </CardContent>
        </Card>
      ) : !resultsQuery.data ? null : (
        <ResultsBody type={type} data={resultsQuery.data} />
      )}
    </div>
  )
}

function ResultsBody({
  type,
  data,
}: {
  type: ActivityType
  data: ActivityResultsDto
}) {
  // POLL or VOTING → single-question bar chart
  if (type === "POLL" || type === "VOTING") {
    const options = data.options ?? []
    const maxCount = Math.max(1, ...options.map((o) => o.count))
    return (
      <div className="space-y-4">
        <StatRow
          totalResponses={data.totalResponses}
          totalParticipants={data.totalParticipants}
        />
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              Results
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground">No votes yet.</p>
            ) : (
              options.map((opt, idx) => {
                const widthPct = (opt.count / maxCount) * 100
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-foreground">
                        {opt.label}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {opt.count}
                        </span>{" "}
                        ({opt.percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Q_AND_A → sorted list of approved questions
  if (type === "Q_AND_A") {
    const qs = [...(data.questions ?? [])].sort((a, b) => {
      const pa = a.metadata.pinned ? 1 : 0
      const pb = b.metadata.pinned ? 1 : 0
      if (pa !== pb) return pb - pa
      return (b.metadata.upvotes ?? 0) - (a.metadata.upvotes ?? 0)
    })
    return (
      <div className="space-y-4">
        <StatRow
          totalResponses={data.totalResponses}
          totalParticipants={data.totalParticipants}
        />
        <div className="space-y-2">
          {qs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No approved questions yet.
              </CardContent>
            </Card>
          ) : (
            qs.map((q) => {
              const pinned = !!q.metadata.pinned
              const upvotes = q.metadata.upvotes ?? 0
              return (
                <Card
                  key={q.id}
                  className={cn(
                    pinned
                      ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                      : "border-slate-200 dark:border-slate-800",
                  )}
                >
                  <CardContent className="flex items-start gap-3 p-3 sm:p-4">
                    <div className="flex min-w-[52px] flex-col items-center rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-700">
                      <ArrowBigUp className="size-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {upvotes}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      {pinned && (
                        <Badge
                          variant="outline"
                          className="mb-1 border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          <Pin className="size-3" /> Pinned
                        </Badge>
                      )}
                      <p className="break-words text-sm leading-relaxed text-foreground sm:text-base">
                        {q.text}
                      </p>
                      {q.participantName && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          — {q.participantName}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    )
  }

  // SURVEY / FEEDBACK → per-question aggregate breakdown
  if (type === "SURVEY" || type === "FEEDBACK") {
    const items = data.questionResults ?? []
    return (
      <div className="space-y-4">
        <StatRow
          totalResponses={data.totalResponses}
          totalParticipants={data.totalParticipants}
        />
        <div className="space-y-3">
          {items.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No responses yet.
              </CardContent>
            </Card>
          ) : (
            items.map((q, idx) => (
              <Card key={q.questionId}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-semibold leading-tight text-foreground sm:text-base">
                      {q.questionText}
                    </h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <p className="text-xs text-muted-foreground">
                    {q.responseCount} response{q.responseCount === 1 ? "" : "s"}
                  </p>
                  {q.averageRating != null && (
                    <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/20">
                      <p className="text-xs text-muted-foreground">
                        Average rating
                      </p>
                      <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                        {q.averageRating.toFixed(1)}
                        <span className="text-base text-muted-foreground">/5</span>
                      </p>
                    </div>
                  )}
                  {q.optionResults && q.optionResults.length > 0 && (
                    <div className="space-y-1.5">
                      {q.optionResults.map((opt) => (
                        <div key={opt.index} className="space-y-1">
                          <div className="flex justify-between gap-2 text-xs">
                            <span className="font-medium text-foreground">
                              {opt.label}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {opt.count} ({opt.percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${opt.percentage}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    )
  }

  // LIVE_QUIZ etc — caller should route elsewhere.
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">
        Live results are not available for this activity type.
      </CardContent>
    </Card>
  )
}

function StatRow({
  totalResponses,
  totalParticipants,
}: {
  totalResponses: number
  totalParticipants?: number
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <CardContent className="flex items-center gap-3 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Users className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Responses</p>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {totalResponses}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <BarChart3 className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Participants</p>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {totalParticipants ?? "—"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ResultsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
