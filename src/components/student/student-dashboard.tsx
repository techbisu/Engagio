"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Award,
  BarChart3,
  ClipboardList,
  Clock,
  KeyRound,
  Link2,
  PlayCircle,
  Share2,
  Sparkles,
  Trophy,
  Users,
  FileQuestion,
  Zap,
  MessageSquare,
  Vote,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Calendar,
  Building2,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ShareCertificateButton } from "@/components/student/share-certificate-button"

import { api } from "./api"
import type { AttemptListResponse, AttemptListItem } from "./api"
import { cn, formatDuration } from "@/lib/utils"
import { getOrgSlug } from "@/components/organization/api"
import type { SafeUser } from "@/types"

// Demo quiz removed for production

interface StudentDashboardProps {
  user: SafeUser
  onStartQuiz: (slug: string) => void
  onViewLeaderboard: (slug: string) => void
  /** The current org slug (from the URL route param). Passed to the API as
   *  ?org= so the backend scopes events/activities to this org only.
   *  Also included in query keys so TanStack Query re-fetches when the org
   *  changes. */
  orgSlug?: string
}

// ─── Types for registered events with activities ───────────────────────────
interface RegisteredActivity {
  id: string
  type: string
  title: string
  description: string | null
  status: string
  slug: string | null
  scheduledAt: string | null
  endsAt: string | null
  isAcceptingResponses: boolean
  questionCount: number
  participantCount: number
  quizLink: { slug: string; timeLimit: number; passThreshold: number; questionCount?: number } | null
}

interface RegisteredEvent {
  event: {
    id: string
    title: string
    slug: string
    image: string | null
    startDate: string
    endDate: string
    isActive: boolean
    organization: {
      id: string
      name: string
      slug: string
      logoUrl: string | null
    }
  }
  activities: RegisteredActivity[]
}

const ACTIVITY_TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  QUIZ: { label: "Quiz", icon: FileQuestion, color: "text-emerald-600" },
  LIVE_QUIZ: { label: "Live Quiz", icon: Zap, color: "text-amber-600" },
  POLL: { label: "Poll", icon: BarChart3, color: "text-teal-600" },
  SURVEY: { label: "Survey", icon: ClipboardList, color: "text-blue-600" },
  FEEDBACK: { label: "Feedback", icon: MessageSquare, color: "text-purple-600" },
  Q_AND_A: { label: "Q&A", icon: HelpCircle, color: "text-rose-600" },
  VOTING: { label: "Voting", icon: Vote, color: "text-orange-600" },
  KNOWLEDGE_CHECK: { label: "Knowledge Check", icon: CheckCircle, color: "text-emerald-600" },
  PRE_POST_ASSESSMENT: { label: "Assessment", icon: FileQuestion, color: "text-teal-600" },
}

export function StudentDashboard({ user, onStartQuiz, onViewLeaderboard, orgSlug }: StudentDashboardProps) {
  const [slugInput, setSlugInput] = React.useState("")
  const [leaderboardInput, setLeaderboardInput] = React.useState("")

  // Build the org-scoped query string. When orgSlug is present, the API
  // filters events/activities/attempts to this org only. We also include
  // orgSlug in the query key so TanStack Query re-fetches when the org
  // changes (e.g. user switches org via the org switcher).
  const orgQuery = orgSlug ? `?org=${encodeURIComponent(orgSlug)}` : ""

  const { data, isLoading, isError, error } = useQuery<AttemptListResponse>({
    // Include user.id + orgSlug in the key so the cache is per-user + per-org.
    queryKey: ["attempts", "list", user.id, orgSlug ?? "no-org"],
    queryFn: () => api<AttemptListResponse>(`/api/attempts/list${orgQuery}`),
  })

  // Fetch registered events with their current/upcoming activities
  const { data: registeredData } = useQuery<{ events: RegisteredEvent[] }>({
    queryKey: ["me", "activities", user.id, orgSlug ?? "no-org"],
    queryFn: () => api<{ events: RegisteredEvent[] }>(`/api/me/activities${orgQuery}`),
    staleTime: 60_000,
  })
  const registeredEvents = registeredData?.events ?? []

  const attempts = data?.attempts ?? []
  const completed = attempts.filter(
    (a) => a.status === "COMPLETED" || a.status === "TIMEOUT" || a.status === "CHEAT_DETECTED",
  )
  const totalAttempts = attempts.length
  const quizzesPassed = completed.filter((a) => a.passed).length
  const avgScore =
    completed.length > 0
      ? Math.round(
          completed.reduce((s, a) => s + (a.percentage ?? 0), 0) / completed.length,
        )
      : 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const slug = normalizeSlug(slugInput)
    if (!slug) return
    onStartQuiz(slug)
  }

  const handleLeaderboard = (e: React.FormEvent) => {
    e.preventDefault()
    const slug = normalizeSlug(leaderboardInput)
    if (!slug) return
    onViewLeaderboard(slug)
  }

  return (
    <div className="space-y-6">
      {/* Stats summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={ClipboardList}
          label="Total attempts"
          value={isLoading ? "…" : String(totalAttempts)}
          tone="emerald"
        />
        <StatCard
          icon={BarChart3}
          label="Average score"
          value={isLoading ? "…" : `${avgScore}%`}
          tone="teal"
        />
        <StatCard
          icon={Trophy}
          label="Quizzes passed"
          value={isLoading ? "…" : String(quizzesPassed)}
          tone="amber"
        />
      </div>

      {/* My Registered Events — simple list with action buttons */}
      {registeredEvents.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Calendar className="size-4" />
              </span>
              <div>
                <CardTitle>My Registered Events</CardTitle>
                <CardDescription>Events you're registered for. Click to view activities.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {registeredEvents.map(({ event, activities }) => {
                const liveCount = activities.filter(a => a.status === "LIVE").length
                const upcomingCount = activities.filter(a => a.status === "SCHEDULED").length
                const quizActivities = activities.filter(a => a.quizLink?.slug)
                return (
                  <div
                    key={event.id}
                    className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-lg border p-4 transition hover:border-emerald-500/40 hover:shadow-sm"
                  >
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug" title={event.title}>
                          {event.title}
                        </p>
                        {event.organization && (
                          <p className="truncate text-xs text-muted-foreground">
                            {event.organization.name}
                          </p>
                        )}
                      </div>
                      {liveCount > 0 && (
                        <Badge className="shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> {liveCount} LIVE
                        </Badge>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {activities.length > 0 && <span>{activities.length} activities</span>}
                      {upcomingCount > 0 && <span>· {upcomingCount} upcoming</span>}
                      <span>· {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>

                    {/* Quiz link cards with Start button */}
                    {quizActivities.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {quizActivities.map(a => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/60"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{a.title || "Quiz"}</p>
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                                {a.quizLink?.questionCount !== undefined && a.quizLink.questionCount > 0 && (
                                  <span>{a.quizLink.questionCount} Qs</span>
                                )}
                                {a.quizLink?.timeLimit !== undefined && a.quizLink.timeLimit > 0 && (
                                  <span>· {a.quizLink.timeLimit} min</span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="shrink-0 bg-emerald-600 text-white text-xs hover:bg-emerald-700"
                              onClick={() => onStartQuiz(a.quizLink!.slug)}
                            >
                              Start
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current & Upcoming Activities (for registered events only) */}
      {registeredEvents.length > 0 && (() => {
        // Find the most active event (most LIVE activities, or first one)
        const featuredIdx = registeredEvents.findIndex(({ activities }) =>
          activities.some(a => a.status === "LIVE")
        )
        const featured = featuredIdx >= 0 ? registeredEvents[featuredIdx] : registeredEvents[0]
        const rest = registeredEvents.filter((_, i) => i !== (featuredIdx >= 0 ? featuredIdx : 0))
        const hasLive = featured.activities.some(a => a.status === "LIVE")

        return (
          <>
            {/* Featured event - large prominent card */}
            <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-6 dark:from-emerald-950/30 dark:to-teal-950/20 dark:border-emerald-500/10">
              {hasLive && (
                <div className="absolute right-4 top-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-lg shadow-emerald-500/30">
                    <span className="size-1.5 animate-pulse rounded-full bg-white" />
                    LIVE NOW
                  </span>
                </div>
              )}
              <div className="mb-4 flex items-center gap-3">
                {featured.event.organization?.logoUrl ? (
                  <img src={featured.event.organization.logoUrl} alt="" className="size-8 shrink-0 rounded-lg" />
                ) : (
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                    <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-bold leading-tight text-foreground" title={featured.event.title}>
                    {featured.event.title}
                  </h3>
                  <p className="truncate text-sm text-muted-foreground">{featured.event.organization?.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {featured.activities.map((act) => {
                  const meta = ACTIVITY_TYPE_META[act.type] ?? { label: act.type, icon: FileQuestion, color: "text-emerald-600" }
                  const Icon = meta.icon
                  const isLive = act.status === "LIVE"
                  return (
                    <div
                      key={act.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (act.quizLink?.slug) onStartQuiz(act.quizLink.slug)
                        else if (act.slug) { const s = getOrgSlug(); window.location.href = s ? "/org/" + s + "/participant/dashboard?sub=activity&activity=" + act.slug : "/dashboard?sub=activity&activity=" + act.slug }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          if (act.quizLink?.slug) onStartQuiz(act.quizLink.slug)
                          else if (act.slug) { const s = getOrgSlug(); window.location.href = s ? "/org/" + s + "/participant/dashboard?sub=activity&activity=" + act.slug : "/dashboard?sub=activity&activity=" + act.slug }
                        }
                      }}
                      className="group flex flex-col rounded-lg border border-white/60 bg-white/80 p-4 text-left shadow-sm transition hover:border-emerald-500/40 hover:bg-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 cursor-pointer"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={"grid size-8 place-items-center rounded-lg " + (isLive ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-muted")}>
                            <Icon className={"size-4 " + meta.color} />
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                            <p className="text-sm font-semibold leading-tight">{act.title}</p>
                          </div>
                        </div>
                        {isLive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                            <span className="size-1 animate-pulse rounded-full bg-emerald-500" />
                            LIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400">
                            <Clock className="size-2.5" />
                            SOON
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                        {act.questionCount > 0 && <span>{act.questionCount} Questions</span>}
                        {act.quizLink?.timeLimit && act.quizLink.timeLimit > 0 && (
                          <span>{act.quizLink.timeLimit} min</span>
                        )}
                        <span className="ml-auto flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                          {isLive ? "Start Now" : "View"}
                          <ArrowRight className="size-3 transition group-hover:translate-x-0.5" />
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const s = getOrgSlug()
                            const link = act.quizLink?.slug
                              ? window.location.origin + (s ? "/org/" + s + "/" + (act.eventSlug || "event") + "/quiz/" : "/quiz/") + act.quizLink.slug
                              : act.slug
                                ? window.location.origin + "/activity/" + act.slug
                                : null
                            if (link) {
                              navigator.clipboard.writeText(link)
                              toast.success("Link copied to clipboard!")
                            }
                          }}
                          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                          title="Copy activity link"
                          aria-label="Copy activity link"
                        >
                          <Share2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Other registered events - compact list */}
            {rest.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-300">
                      <Calendar className="size-3.5" />
                    </span>
                    <div>
                      <CardTitle className="text-base">Your Other Events</CardTitle>
                      <CardDescription className="text-xs">
                        {rest.length} more registered {rest.length === 1 ? "event" : "events"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {rest.map(({ event, activities }) => {
                      const liveCount = activities.filter(a => a.status === "LIVE").length
                      return (
                        <div key={event.id} className="flex items-center gap-3 rounded-lg border p-3 transition hover:bg-muted/50">
                          {event.organization?.logoUrl ? (
                            <img src={event.organization.logoUrl} alt="" className="size-6 rounded" />
                          ) : (
                            <div className="grid size-6 place-items-center rounded bg-muted">
                              <Building2 className="size-3 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{event.organization?.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {liveCount > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                                <span className="size-1 animate-pulse rounded-full bg-emerald-500" />
                                {liveCount} LIVE
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">{activities.length} {activities.length === 1 ? "activity" : "activities"}</span>
                            <ArrowRight className="size-4 text-muted-foreground" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )
      })()}


      {/* Take a quiz */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
              <KeyRound className="size-4" />
            </span>
            <div>
              <CardTitle>Take a Quiz</CardTitle>
              <CardDescription>
                Enter the quiz code your instructor shared (e.g. ABC123) or
                paste the full quiz link.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <Label htmlFor="quiz-slug" className="sr-only">
                  Quiz code or link
                </Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="quiz-slug"
                    value={slugInput}
                    onChange={(e) => setSlugInput(e.target.value)}
                    placeholder="Enter quiz code"
                    className="pl-9"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={!slugInput.trim()}
                className="bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
              >
                <PlayCircle className="size-4" /> Start Quiz
              </Button>
            </div>
            </form>
        </CardContent>
      </Card>

      {/* View leaderboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
              <Trophy className="size-4" />
            </span>
            <div>
              <CardTitle>View Leaderboard</CardTitle>
              <CardDescription>
                Enter a quiz code to see the top 20 scores for that quiz.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLeaderboard} className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <Label htmlFor="leaderboard-slug" className="sr-only">
                  Quiz code for leaderboard
                </Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="leaderboard-slug"
                    value={leaderboardInput}
                    onChange={(e) => setLeaderboardInput(e.target.value)}
                    placeholder="Enter quiz code"
                    className="pl-9"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={!leaderboardInput.trim()}
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40 sm:w-auto"
              >
                <Trophy className="size-4" /> View Leaderboard
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent attempts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Clock className="size-4" />
              </span>
              <div>
                <CardTitle>My Recent Attempts</CardTitle>
                <CardDescription>
                  Your last {attempts.length || 0} quiz attempt
                  {attempts.length === 1 ? "" : "s"}.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <AttemptsSkeleton />
          ) : isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              Failed to load attempts:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : attempts.length === 0 ? (
            <EmptyAttempts />
          ) : (
            <AttemptsTable attempts={attempts} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Award
  label: string
  value: string
  tone: "emerald" | "teal" | "amber"
}) {
  const tones = {
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300",
    teal: "bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-300",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300",
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4 sm:p-5">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", tones[tone])}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function AttemptsTable({ attempts }: { attempts: AttemptListItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      {/* Desktop table */}
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Event</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Score</th>
              <th className="px-4 py-2.5 text-center font-medium">Result</th>
              <th className="px-4 py-2.5 text-right font-medium">Time</th>
              <th className="px-4 py-2.5 text-right font-medium">Date</th>
              <th className="px-4 py-2.5 text-center font-medium">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {attempts.map((a) => (
              <tr key={a.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground line-clamp-1">
                    {a.event?.title || "Untitled quiz"}
                  </div>
                  {a.quizLink?.slug && (
                    <div className="text-xs text-muted-foreground">
                      Code: {a.quizLink.slug}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={a.status} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {a.published === false ? <span className="text-muted-foreground">Hidden</span> : a.percentage != null ? `${a.percentage}%` : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {a.published === false ? <span className="text-muted-foreground">—</span> : a.passed === true ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <Award className="size-3" /> Pass
                    </Badge>
                  ) : a.passed === false ? (
                    <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-300">
                      Fail
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {a.timeTaken != null ? formatDuration(a.timeTaken) : "—"}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {a.startedAt
                    ? formatDistanceToNow(new Date(a.startedAt), { addSuffix: true })
                    : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {(a.status === "COMPLETED" || a.status === "TIMEOUT" || a.status === "CHEAT_DETECTED") && a.published !== false ? (
                    <ShareCertificateButton
                      attemptId={a.id}
                      eventName={a.event?.title}
                      label=""
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-border sm:hidden">
        {attempts.map((a) => (
          <div key={a.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {a.event?.title || "Untitled quiz"}
                </p>
                {a.quizLink?.slug && (
                  <p className="text-xs text-muted-foreground">Code: {a.quizLink.slug}</p>
                )}
              </div>
              <StatusBadge status={a.status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Score:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {a.published === false ? "Hidden" : a.percentage != null ? `${a.percentage}%` : "—"}
                </span>
              </span>
              {a.published === false ? (
                <Badge variant="outline" className="text-muted-foreground">
                  Pending
                </Badge>
              ) : a.passed === true ? (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Pass
                </Badge>
              ) : a.passed === false ? (
                <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-300">
                  Fail
                </Badge>
              ) : null}
            </div>
            <Separator className="my-2" />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {a.timeTaken != null ? formatDuration(a.timeTaken) : "—"}
                </span>
                <span>·</span>
                <span>
                  {a.startedAt
                    ? formatDistanceToNow(new Date(a.startedAt), { addSuffix: true })
                    : "—"}
                </span>
              </div>
              {(a.status === "COMPLETED" || a.status === "TIMEOUT" || a.status === "CHEAT_DETECTED") && a.published !== false && (
                <ShareCertificateButton
                  attemptId={a.id}
                  eventName={a.event?.title}
                  label="Share"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: AttemptListItem["status"] }) {
  switch (status) {
    case "COMPLETED":
      return (
        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Completed
        </Badge>
      )
    case "TIMEOUT":
      return (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Timed out
        </Badge>
      )
    case "CHEAT_DETECTED":
      return (
        <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          Flagged
        </Badge>
      )
    case "IN_PROGRESS":
      return (
        <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          In progress
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function AttemptsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function EmptyAttempts() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
        <ClipboardList className="size-6" />
      </span>
      <h3 className="text-base font-semibold text-foreground">No attempts yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Enter a quiz code above to take your first quiz. Ask your instructor for
        the code or try the demo.
      </p>
    </div>
  )
}

/** Extract the slug from either a raw slug or a full URL like
 * `https://host/quiz/R85XSX` (new route) or `https://host/?quiz=R85XSX` (legacy).
 * The legacy format is still supported for backward compatibility —
 * old shared links will keep working thanks to the middleware 301 redirects. */
function normalizeSlug(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""
  // If it contains a query param `quiz=`, extract it
  try {
    const url = new URL(trimmed)
    const q = url.searchParams.get("quiz")
    if (q) return q.toUpperCase()
    // Try last path segment
    const parts = url.pathname.split("/").filter(Boolean)
    const last = parts[parts.length - 1]
    if (last) return last.toUpperCase()
    return trimmed.toUpperCase()
  } catch {
    // Not a URL — treat as raw slug
    return trimmed.toUpperCase()
  }
}
