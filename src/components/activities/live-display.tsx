"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowBigUp, Pin, X } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { api } from "./api"
import type { ActivityResultsDto, ActivityType } from "./api"

export interface LiveDisplayProps {
  activityId: string
  /** Optional type hint. If omitted, derived from ActivityResultsDto.type. */
  type?: ActivityType
  onExit?: () => void
}

/**
 * LiveDisplay — full-screen projector view.
 *
 * - Dark background (slate-900), white text, emerald accents.
 * - Large typography (text-4xl / text-5xl / text-6xl).
 * - Auto-refreshes every 3s via refetchInterval.
 * - No admin controls, no chrome — just a small "Exit" button.
 * - Fits on one screen (no scroll).
 */
export function LiveDisplay({ activityId, type, onExit }: LiveDisplayProps) {
  const resultsQuery = useQuery<ActivityResultsDto>({
    queryKey: ["live-display", activityId],
    queryFn: () =>
      api<ActivityResultsDto>(`/api/activities/${activityId}/results`),
    refetchInterval: 3_000,
  })

  const effectiveType: ActivityType | undefined =
    type ?? resultsQuery.data?.type

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      {/* Exit button — top-right, semi-transparent */}
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit live display"
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <X className="size-5" />
        </button>
      )}

      {/* Status badge — top-left, live indicator */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 text-xs text-white/60">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
        </span>
        LIVE · Refreshes every 3s
      </div>

      <div className="flex flex-1 flex-col overflow-hidden p-6 sm:p-10">
        {resultsQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Skeleton className="h-32 w-3/4 bg-white/10" />
          </div>
        ) : resultsQuery.isError || !resultsQuery.data ? (
          <div className="flex flex-1 items-center justify-center text-center">
            <p className="text-2xl font-semibold text-white/70">
              Could not load live results.
            </p>
          </div>
        ) : effectiveType ? (
          <LiveBody type={effectiveType} data={resultsQuery.data} />
        ) : null}
      </div>
    </div>
  )
}

function LiveBody({ type, data }: { type: ActivityType; data: ActivityResultsDto }) {
  if (type === "POLL" || type === "VOTING") {
    return <PollLiveBody data={data} />
  }
  if (type === "Q_AND_A") {
    return <QaLiveBody data={data} />
  }
  if (type === "SURVEY" || type === "FEEDBACK") {
    return <SurveyLiveBody data={data} />
  }
  return (
    <div className="flex flex-1 items-center justify-center text-center">
      <p className="text-3xl font-semibold text-white/70">
        Live display not available for this activity type.
      </p>
    </div>
  )
}

function PollLiveBody({ data }: { data: ActivityResultsDto }) {
  const options = data.options ?? []
  const maxCount = Math.max(1, ...options.map((o) => o.count))
  const total = data.totalResponses ?? 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-6 text-center">
        <p className="mb-2 text-base font-medium uppercase tracking-[0.2em] text-emerald-400">
          Live Poll
        </p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
          Live Results
        </h1>
      </div>

      {/* Bars */}
      <div className="flex flex-1 flex-col justify-center gap-4 sm:gap-5">
        {options.length === 0 ? (
          <p className="text-center text-2xl text-white/60">
            Waiting for the first vote…
          </p>
        ) : (
          options.map((opt, idx) => {
            const widthPct = (opt.count / maxCount) * 100
            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-2xl font-semibold sm:text-3xl">
                    {opt.label}
                  </span>
                  <span className="tabular-nums text-2xl font-bold text-emerald-400 sm:text-3xl">
                    {opt.percentage.toFixed(0)}%
                    <span className="ml-2 text-base font-normal text-white/60">
                      ({opt.count} {opt.count === 1 ? "vote" : "votes"})
                    </span>
                  </span>
                </div>
                <div className="h-6 w-full overflow-hidden rounded-full bg-white/10 sm:h-8">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 border-t border-white/10 pt-4 text-center">
        <p className="text-xl text-white/70 sm:text-2xl">
          <span className="font-bold tabular-nums text-white">{total}</span>{" "}
          total {total === 1 ? "response" : "responses"}
        </p>
      </div>
    </div>
  )
}

function QaLiveBody({ data }: { data: ActivityResultsDto }) {
  const qs = [...(data.questions ?? [])].sort((a, b) => {
    const pa = a.metadata.pinned ? 1 : 0
    const pb = b.metadata.pinned ? 1 : 0
    if (pa !== pb) return pb - pa
    return (b.metadata.upvotes ?? 0) - (a.metadata.upvotes ?? 0)
  })
  const visible = qs.slice(0, 5)

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 text-center">
        <p className="mb-2 text-base font-medium uppercase tracking-[0.2em] text-emerald-400">
          Q&amp;A
        </p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
          Audience Questions
        </h1>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 overflow-hidden sm:gap-4">
        {visible.length === 0 ? (
          <p className="text-center text-2xl text-white/60">
            No questions yet. Be the first to ask!
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {visible.map((q) => {
              const pinned = !!q.metadata.pinned
              const upvotes = q.metadata.upvotes ?? 0
              return (
                <motion.div
                  key={q.id}
                  layout
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "flex items-start gap-4 rounded-2xl border-2 p-4 sm:p-5",
                    pinned
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-white/10 bg-white/5",
                  )}
                >
                  <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-white/10 py-2">
                    <ArrowBigUp className="size-6 text-emerald-400" />
                    <span className="text-3xl font-bold tabular-nums text-emerald-400 sm:text-4xl">
                      {upvotes}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {pinned && (
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                        <Pin className="size-3" /> Pinned
                      </span>
                    )}
                    <p className="text-xl font-semibold leading-snug sm:text-2xl lg:text-3xl">
                      {q.text}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      <div className="mt-6 border-t border-white/10 pt-4 text-center">
        <p className="text-lg text-white/70 sm:text-xl">
          <span className="font-bold tabular-nums text-white">
            {data.totalResponses ?? qs.length}
          </span>{" "}
          questions asked
        </p>
      </div>
    </div>
  )
}

function SurveyLiveBody({ data }: { data: ActivityResultsDto }) {
  const items = data.questionResults ?? []
  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 text-center">
        <p className="mb-2 text-base font-medium uppercase tracking-[0.2em] text-emerald-400">
          Survey
        </p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
          Live Survey
        </h1>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
        <StatCard
          label="Total Responses"
          value={String(data.totalResponses ?? 0)}
        />
        {items
          .filter((q) => q.averageRating != null)
          .slice(0, 5)
          .map((q) => (
            <StatCard
              key={q.questionId}
              label={q.questionText}
              value={q.averageRating!.toFixed(1)}
              suffix="/5"
            />
          ))}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string
  value: string
  suffix?: string
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm font-medium uppercase tracking-wide text-white/60 sm:text-base">
        {label}
      </p>
      <p className="mt-3 text-4xl font-bold tabular-nums text-emerald-400 sm:text-5xl lg:text-6xl">
        {value}
        {suffix && (
          <span className="ml-1 text-xl font-normal text-white/60 sm:text-2xl">
            {suffix}
          </span>
        )}
      </p>
    </div>
  )
}
