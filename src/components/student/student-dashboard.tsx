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
import { ShareAchievementButton } from "@/components/achievements/share-achievement-button"

import { api } from "./api"
import type { AttemptListResponse, AttemptListItem } from "./api"
import { cn, formatDuration } from "@/lib/utils"
import type { SafeUser } from "@/types"

// Demo quiz removed for production

interface StudentDashboardProps {
  user: SafeUser
  onStartQuiz: (slug: string) => void
  onViewLeaderboard: (slug: string) => void
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
  quizLink: { slug: string; timeLimit: number; passThreshold: number } | null
}

interface RegisteredEvent {
  registration: { id: string; createdAt: string }
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

export function StudentDashboard({ user, onStartQuiz, onViewLeaderboard }: StudentDashboardProps) {
  const [slugInput, setSlugInput] = React.useState("")
  const [leaderboardInput, setLeaderboardInput] = React.useState("")

  const { data, isLoading, isError, error } = useQuery<AttemptListResponse>({
    // Include user.id in the key so the cache is per-user (avoids showing
    // a previous user's attempts after sign-out + sign-in as someone else).
    queryKey: ["attempts", "list", user.id],
    queryFn: () => api<AttemptListResponse>("/api/attempts/list"),
  })

  // Fetch registered events with their current/upcoming activities
  const { data: registeredData } = useQuery<{ events: RegisteredEvent[] }>({
    queryKey: ["me", "activities", user.id],
    queryFn: () => api<{ events: RegisteredEvent[] }>("/api/me/activities"),
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

      {/* Current & Upcoming Activities (for registered events only) */}
      {registeredEvents.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-950/60 dark:text-teal-300">
                <Calendar className="size-4" />
              </span>
              <div>
                <CardTitle>Current & Upcoming Activities</CardTitle>
                <CardDescription>
                  Live and upcoming activities from events you&apos;ve registered for.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {registeredEvents.map(({ event, activities }) => (
                <div key={event.id} className="rounded-lg border p-4">
                  {/* Event header */}
                  <div className="mb-3 flex items-center gap-2">
                    {event.organization?.logoUrl ? (
                      <img src={event.organization.logoUrl} alt="" className="size-5 rounded" />
                    ) : (
                      <div className="grid size-5 place-items-center rounded bg-muted">
                        <Building2 className="size-3 text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-sm font-semibold">{event.title}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{event.organization?.name}</span>
                  </div>
                  {/* Activity cards */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {activities.map((act) => {
                      const meta = ACTIVITY_TYPE_META[act.type] ?? { label: act.type, icon: FileQuestion, color: "text-emerald-600" }
                      const Icon = meta.icon
                      const isLive = act.status === "LIVE"
                      const href = act.quizLink?.slug
                        ? `/quiz/${act.quizLink.slug}`
                        : act.slug
                          ? `/dashboard?sub=activity&activity=${act.slug}`
                          : null
                      return (
                        <button
                          key={act.id}
                          onClick={() => {
                            if (act.quizLink?.slug) onStartQuiz(act.quizLink.slug)
                            else if (act.slug) window.location.href = `/dashboard?sub=activity&activity=${act.slug}`
                          }}
                          className="group flex flex-col rounded-lg border p-3 text-left transition hover:border-emerald-500/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Icon className={`size-4 ${meta.color}`} />
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {meta.label}
                              </span>
                            </div>
                            {isLive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                                <span className="size-1 animate-pulse rounded-full bg-emerald-500" />
                                LIVE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                <Clock className="size-2.5" />
                                UPCOMING
                              </span>
                            )}
                          </div>
                          <p className="mb-1 line-clamp-1 text-sm font-medium">{act.title}</p>
                          <div className="mt-auto flex items-center gap-2 text-[10px] text-muted-foreground">
                            {act.questionCount > 0 && <span>{act.questionCount} Qs</span>}
                            {act.quizLink?.timeLimit && act.quizLink.timeLimit > 0 && (
                              <span>{act.quizLink.timeLimit} min</span>
                            )}
                            <span className="ml-auto flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                              {isLive ? "Start" : "View"}
                              <ArrowRight className="size-3 transition group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  {a.percentage != null ? `${a.percentage}%` : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {a.passed === true ? (
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
                  {a.status === "COMPLETED" || a.status === "TIMEOUT" || a.status === "CHEAT_DETECTED" ? (
                    <ShareAchievementButton
                      achievementInput={{
                        type: "QUIZ_RESULT",
                        eventId: a.event?.id,
                        title: a.event?.title
                          ? `${a.event.title} · Quiz Result`
                          : "Quiz Result",
                        subtitle: a.event?.title ?? undefined,
                        score: a.score ?? undefined,
                        totalScore: a.totalMarks ?? undefined,
                        percentage: a.percentage ?? undefined,
                        achievementData: {
                          eventTitle: a.event?.title,
                        },
                        templateId: "modern",
                        visibility: "LINK_ONLY",
                      }}
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
                  {a.percentage != null ? `${a.percentage}%` : "—"}
                </span>
              </span>
              {a.passed === true && (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Pass
                </Badge>
              )}
              {a.passed === false && (
                <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-300">
                  Fail
                </Badge>
              )}
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
              {(a.status === "COMPLETED" || a.status === "TIMEOUT" || a.status === "CHEAT_DETECTED") && (
                <ShareAchievementButton
                  achievementInput={{
                    type: "QUIZ_RESULT",
                    eventId: a.event?.id,
                    title: a.event?.title
                      ? `${a.event.title} · Quiz Result`
                      : "Quiz Result",
                    subtitle: a.event?.title ?? undefined,
                    score: a.score ?? undefined,
                    totalScore: a.totalMarks ?? undefined,
                    percentage: a.percentage ?? undefined,
                    achievementData: {
                      eventTitle: a.event?.title,
                    },
                    templateId: "modern",
                    visibility: "LINK_ONLY",
                  }}
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
