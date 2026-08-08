"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  CalendarDays,
  ClipboardCheck,
  FileQuestion,
  Link2,
  ClipboardList,
  ShieldAlert,
  Target,
  Trophy,
  TrendingUp,
  Activity,
} from "lucide-react"
import { format, parseISO, subDays } from "date-fns"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { cn, formatDateTime, formatDuration, initials, truncate } from "@/lib/utils"

import { api, type AnalyticsPayload } from "./api"
import { StatCard } from "./stat-card"
import type { AttemptStatus, QuizAttemptDto } from "@/types"

const statusColor: Record<AttemptStatus, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
  IN_PROGRESS: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  CHEAT_DETECTED: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30",
  TIMEOUT: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/30",
}

export function Dashboard({
  onViewAttempts,
}: {
  onViewAttempts?: () => void
}) {
  const { data, isLoading, isError, error } = useQuery<AnalyticsPayload>({
    queryKey: ["analytics"],
    queryFn: () => api<AnalyticsPayload>("/api/analytics"),
    retry: 1,
  })

  // Recent attempts (separate query for richer data — analytics may only return ids).
  // The API returns `{ attempts: QuizAttemptDto[], total: number }`.
  const recentQuery = useQuery<{ attempts: QuizAttemptDto[]; total: number }>({
    queryKey: ["attempts", "recent"],
    queryFn: () =>
      api<{ attempts: QuizAttemptDto[]; total: number }>(
        `/api/attempts/list?all=true&limit=5`,
      ),
    retry: 1,
  })
  const recentAttempts = recentQuery.data?.attempts ?? []

  const a = data
  const totalAttempts = a?.totalAttempts ?? 0
  const completed = a?.completedAttempts ?? 0
  // Backwards-compat field aliases — the API returns `cheatDetectedAttempts`
  // and `averageScore`, but older Dashboards expected `cheatDetected`/`avgScore`.
  const cheat = (a as any)?.cheatDetected ?? (a as any)?.cheatDetectedAttempts ?? 0
  const passRate = a?.passRate ?? null
  const avgScore = (a as any)?.avgScore ?? (a as any)?.averageScore ?? null

  // Build attempts-over-time series — use provided series, else aggregate from
  // recent attempts (fallback), else generate an empty 14-day window.
  const areaData = React.useMemo(() => {
    if (a?.attemptsOverTime && a.attemptsOverTime.length > 0) {
      return a.attemptsOverTime.map((d) => ({
        date: format(parseISO(d.date), "MMM d"),
        attempts: d.count,
      }))
    }
    if (recentAttempts.length > 0) {
      // Bucket by day for last 14 days
      const buckets: Record<string, number> = {}
      const today = new Date()
      for (let i = 13; i >= 0; i--) {
        const d = subDays(today, i)
        buckets[format(d, "yyyy-MM-dd")] = 0
      }
      for (const at of recentAttempts) {
        const key = format(parseISO(at.startedAt), "yyyy-MM-dd")
        if (key in buckets) buckets[key]++
      }
      return Object.entries(buckets).map(([k, v]) => ({
        date: format(parseISO(k), "MMM d"),
        attempts: v,
      }))
    }
    // Empty window
    return Array.from({ length: 14 }).map((_, i) => {
      const d = subDays(new Date(), 13 - i)
      return { date: format(d, "MMM d"), attempts: 0 }
    })
  }, [a, recentAttempts])

  // Score buckets — use provided, else mock empty 5 buckets
  const scoreBuckets = React.useMemo(() => {
    if (a?.scoreBuckets && a.scoreBuckets.length > 0) return a.scoreBuckets
    return [
      { bucket: "0-20%", count: 0 },
      { bucket: "20-40%", count: 0 },
      { bucket: "40-60%", count: 0 },
      { bucket: "60-80%", count: 0 },
      { bucket: "80-100%", count: 0 },
    ]
  }, [a])

  // Top events: normalize `eventId` → `id` for rendering keys (the API
  // returns `eventId`, but the legacy type used `id`).
  const topEvents = (a?.topEvents ?? []).map((e: any) => ({
    id: e.id ?? e.eventId,
    title: e.title,
    attemptCount: e.attemptCount,
  }))

  if (isError) {
    return (
      <Card className="border-rose-200 dark:border-rose-500/30">
        <CardContent className="pt-6">
          <p className="text-sm text-rose-600 dark:text-rose-400">
            Failed to load analytics: {(error as Error)?.message || "Unknown error"}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              icon={CalendarDays}
              label="Total Events"
              value={a?.totalEvents ?? 0}
              hint="Across all time"
            />
            <StatCard
              icon={FileQuestion}
              label="Total Questions"
              value={a?.totalQuestions ?? 0}
              hint="Linked to events"
            />
            <StatCard
              icon={Link2}
              label="Quiz Links"
              value={a?.totalQuizLinks ?? 0}
              hint="Active + inactive"
            />
            <StatCard
              icon={ClipboardList}
              label="Total Attempts"
              value={totalAttempts}
              hint={`${completed} completed`}
            />
            <StatCard
              icon={ClipboardCheck}
              label="Completed"
              value={completed}
              hint={
                totalAttempts
                  ? `${Math.round((completed / totalAttempts) * 100)}% of total`
                  : "—"
              }
            />
            <StatCard
              icon={ShieldAlert}
              label="Cheat Detected"
              value={cheat}
              hint={
                totalAttempts
                  ? `${Math.round((cheat / totalAttempts) * 100)}% of total`
                  : "—"
              }
            />
            <StatCard
              icon={Target}
              label="Avg Score"
              value={avgScore == null ? "—" : `${Math.round(avgScore)}%`}
              hint="Across completed attempts"
            />
            <StatCard
              icon={Trophy}
              label="Pass Rate"
              value={passRate == null ? "—" : `${Math.round(passRate)}%`}
              hint="Of completed attempts"
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-emerald-600" />
              Attempts Over Time
            </CardTitle>
            <CardDescription>Last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ left: -20, right: 8, top: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attemptsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="attempts"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#attemptsGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-emerald-600" />
              Score Distribution
            </CardTitle>
            <CardDescription>Percentage buckets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreBuckets} margin={{ left: -20, right: 8, top: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent attempts + Top events */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Attempts</CardTitle>
              <CardDescription>Latest 5 participant attempts</CardDescription>
            </div>
            {onViewAttempts && (
              <Button variant="outline" size="sm" onClick={onViewAttempts}>
                View all
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {recentQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentQuery.isError ? (
              <p className="text-sm text-rose-500">
                Failed to load attempts.
              </p>
            ) : recentAttempts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No attempts yet.
              </div>
            ) : (
              <ul className="divide-y">
                {recentAttempts.slice(0, 5).map((at) => (
                  <li
                    key={at.id}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <Avatar className="size-9">
                      {at.user?.image ? (
                        <AvatarImage src={at.user.image} alt={at.user.name || ""} />
                      ) : null}
                      <AvatarFallback className="bg-emerald-50 text-emerald-700 text-xs dark:bg-emerald-500/10 dark:text-emerald-400">
                        {initials(at.user?.name || at.user?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {at.user?.name || at.user?.email || "Unknown"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {at.event?.title || "—"}
                      </p>
                    </div>
                    <div className="hidden sm:block text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {at.percentage == null ? "—" : `${at.percentage}%`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(at.startedAt)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "ring-1 shrink-0",
                        statusColor[at.status] || statusColor.IN_PROGRESS
                      )}
                    >
                      {at.status.replace("_", " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Events</CardTitle>
            <CardDescription>By attempt count</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : topEvents.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No events yet.
              </div>
            ) : (
              <ul className="space-y-1">
                {topEvents.map((ev, i) => (
                  <li
                    key={ev.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/60"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">
                      {truncate(ev.title, 28)}
                    </span>
                    <Badge variant="secondary" className="tabular-nums">
                      {ev.attemptCount}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
