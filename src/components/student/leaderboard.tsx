"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Award,
  Clock,
  Medal,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatDuration, initials } from "@/lib/utils"
import { useAppStore } from "@/store/app-store"
import { api } from "./api"

// ---------------------------------------------------------------------------
// DTOs returned by GET /api/leaderboard/[slug]
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  rank: number
  userId: string
  name: string | null
  image: string | null
  score: number
  totalMarks: number
  percentage: number
  passed: boolean
  timeTaken: number
  completedAt: string | null
}

export interface LeaderboardResponse {
  quizLink: {
    slug: string
    event: { id: string; title: string } | null
  }
  leaderboard: LeaderboardEntry[]
  published: boolean
  totalAttempts: number
}

interface LeaderboardProps {
  slug: string
  onBack: () => void
}

// ---------------------------------------------------------------------------
// Podium tones per rank
// ---------------------------------------------------------------------------

const PODIUM_TONES: Record<
  1 | 2 | 3,
  { ring: string; chip: string; bar: string; icon: LucideIcon; label: string }
> = {
  1: {
    ring: "ring-amber-400/70",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    bar: "bg-gradient-to-br from-amber-400 to-amber-500",
    icon: Trophy,
    label: "1st",
  },
  2: {
    ring: "ring-slate-400/70",
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
    bar: "bg-gradient-to-br from-slate-400 to-slate-500",
    icon: Medal,
    label: "2nd",
  },
  3: {
    ring: "ring-orange-400/70",
    chip: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
    bar: "bg-gradient-to-br from-orange-400 to-orange-500",
    icon: Award,
    label: "3rd",
  },
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Leaderboard({ slug, onBack }: LeaderboardProps) {
  const { user } = useAppStore()

  const { data, isLoading, isError, error } = useQuery<LeaderboardResponse>({
    queryKey: ["leaderboard", slug],
    queryFn: () => api<LeaderboardResponse>(`/api/leaderboard/${slug}`),
    enabled: !!slug,
  })

  const eventTitle = data?.quizLink?.event?.title ?? "Quiz Leaderboard"
  const totalAttempts = data?.totalAttempts ?? 0
  const leaderboard = data?.leaderboard ?? []
  const published = data?.published ?? true

  const participants = React.useMemo(
    () => new Set(leaderboard.map((l) => l.userId)).size,
    [leaderboard],
  )
  const avgScore =
    leaderboard.length > 0
      ? Math.round(
          leaderboard.reduce((sum, l) => sum + l.percentage, 0) /
            leaderboard.length,
        )
      : 0

  const podium = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)

  // Reorder podium for visual layout: 2nd | 1st | 3rd
  const podiumLayout = [podium[1], podium[0], podium[2]].filter(Boolean)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground"
          >
            <ArrowLeft className="size-4" /> Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Trophy className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                Leaderboard
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {eventTitle}
              </p>
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 sm:inline-flex"
        >
          <code className="font-mono text-xs">{slug}</code>
        </Badge>
      </div>

      {/* Stats row */}
      {isLoading ? (
        <StatsSkeleton />
      ) : !published ? (
        <PendingCard />
      ) : leaderboard.length === 0 ? (
        <EmptyLeaderboard />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              icon={Users}
              tone="emerald"
              label="Total attempts"
              value={String(totalAttempts)}
            />
            <StatTile
              icon={Award}
              tone="teal"
              label="Top participants"
              value={String(participants)}
            />
            <StatTile
              icon={Trophy}
              tone="amber"
              label="Average score (top 20)"
              value={`${avgScore}%`}
            />
          </div>

          {/* Podium */}
          {podium.length >= 3 ? (
            <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-900/60">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="size-4 text-amber-500" /> Top 3
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
                  {podiumLayout.map((entry) => {
                    const tone = PODIUM_TONES[entry.rank as 1 | 2 | 3]
                    const heightClass =
                      entry.rank === 1
                        ? "h-32 sm:h-40"
                        : entry.rank === 2
                          ? "h-24 sm:h-32"
                          : "h-20 sm:h-28"
                    return (
                      <motion.div
                        key={entry.userId}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * entry.rank, duration: 0.3 }}
                        className="flex flex-col items-center text-center"
                      >
                        <Avatar
                          className={cn(
                            "size-12 ring-2 sm:size-16",
                            tone.ring,
                          )}
                        >
                          {entry.image ? (
                            <AvatarImage
                              src={entry.image}
                              alt={entry.name || "Student"}
                            />
                          ) : null}
                          <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {initials(entry.name) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <p className="mt-2 max-w-full truncate text-xs font-medium sm:text-sm">
                          {entry.name || "Anonymous"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.score}/{entry.totalMarks}
                        </p>
                        <span
                          className={cn(
                            "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            tone.chip,
                          )}
                        >
                          <tone.icon className="size-3" />
                          {entry.percentage}%
                        </span>
                        <div
                          className={cn(
                            "mt-2 w-full rounded-t-lg",
                            heightClass,
                            tone.bar,
                          )}
                        >
                          <span className="flex h-full items-center justify-center text-xs font-bold text-white sm:text-sm">
                            {entry.rank}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ) : podium.length >= 1 ? (
            <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-900/60">
              <CardContent className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-3">
                {podium.map((entry) => {
                  const tone = PODIUM_TONES[entry.rank as 1 | 2 | 3] ?? PODIUM_TONES[1]
                  return (
                    <PodiumRowSmall
                      key={entry.userId}
                      entry={entry}
                      tone={tone}
                      isCurrentUser={user?.id === entry.userId}
                    />
                  )
                })}
              </CardContent>
            </Card>
          ) : null}

          {/* Rank list 4..20 */}
          {rest.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Rankings
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Positions 4 - {4 + rest.length - 1}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {rest.map((entry, idx) => {
                  const isCurrentUser = user?.id === entry.userId
                  return (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 * idx, duration: 0.2 }}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                        isCurrentUser
                          ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
                          : "border-border bg-card hover:bg-muted/40",
                      )}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {entry.rank}
                      </span>
                      <Avatar className="size-8">
                        {entry.image ? (
                          <AvatarImage
                            src={entry.image}
                            alt={entry.name || "Student"}
                          />
                        ) : null}
                        <AvatarFallback className="bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {initials(entry.name) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {entry.name || "Anonymous"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Score {entry.score}/{entry.totalMarks}
                          {entry.completedAt
                            ? ` · ${format(new Date(entry.completedAt), "MMM d, HH:mm")}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {isCurrentUser && (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300">
                            You
                          </Badge>
                        )}
                        <span className="hidden text-muted-foreground tabular-nums sm:inline">
                          <Clock className="mr-1 inline size-3" />
                          {formatDuration(entry.timeTaken)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "tabular-nums font-semibold",
                            entry.percentage >= 70
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                              : entry.percentage >= 40
                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300",
                          )}
                        >
                          {entry.percentage}%
                        </Badge>
                      </div>
                    </motion.div>
                  )
                })}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      {isError && (
        <Card>
          <CardContent className="py-6 text-sm text-rose-600 dark:text-rose-400">
            Failed to load leaderboard:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  tone: "emerald" | "teal" | "amber"
}) {
  const tones = {
    emerald:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300",
    teal: "bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-300",
    amber:
      "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300",
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg",
            tones[tone],
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50 sm:text-2xl">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function PodiumRowSmall({
  entry,
  tone,
  isCurrentUser,
}: {
  entry: LeaderboardEntry
  tone: (typeof PODIUM_TONES)[1]
  isCurrentUser: boolean
}) {
  const ToneIcon = tone.icon
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3",
        isCurrentUser
          ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          tone.chip,
        )}
      >
        <ToneIcon className="size-4" />
      </span>
      <Avatar className="size-9">
        {entry.image ? (
          <AvatarImage src={entry.image} alt={entry.name || "Student"} />
        ) : null}
        <AvatarFallback className="bg-emerald-100 text-[10px] text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          {initials(entry.name) || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {entry.name || "Anonymous"}
          {isCurrentUser && (
            <Badge className="ml-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300">
              You
            </Badge>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {entry.score}/{entry.totalMarks} · {formatDuration(entry.timeTaken)}
        </p>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
          tone.chip,
        )}
      >
        {entry.percentage}%
      </span>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  )
}

function PendingCard() {
  return (
    <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20">
      <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <span className="mb-3 grid size-14 place-items-center rounded-full bg-amber-100 text-amber-600 ring-1 ring-amber-500/20 dark:bg-amber-950/60 dark:text-amber-300">
          <Clock className="size-7" />
        </span>
        <h3 className="text-lg font-semibold">Results haven&apos;t been published yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Check back later — your instructor will publish the leaderboard once
          results are released.
        </p>
      </CardContent>
    </Card>
  )
}

function EmptyLeaderboard() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <span className="mb-3 grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Trophy className="size-7" />
        </span>
        <h3 className="text-lg font-semibold">No completed attempts yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Be the first to take this quiz and claim the top spot!
        </p>
      </CardContent>
    </Card>
  )
}
