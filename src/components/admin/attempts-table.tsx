"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Download,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  ShieldAlert,
  Monitor,
  Smartphone,
  ExternalLink,
  Flag,
  Keyboard,
  Camera,
  EyeOff,
  Users,
  ScanFace,
  Send,
  Lock,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { cn, formatDateTime, formatDuration, initials, truncate } from "@/lib/utils"
import { buildCsv, downloadCsv } from "@/lib/csv"

import { api } from "./api"
import type { AttemptStatus, EventDto, QuestionDto, QuizAttemptDto } from "@/types"

interface AttemptsTableProps {
  eventId?: string
  preselectedSlug?: string
}

const PAGE_SIZE = 10

const statusMeta: Record<
  AttemptStatus,
  { label: string; className: string }
> = {
  COMPLETED: {
    label: "Completed",
    className:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  },
  CHEAT_DETECTED: {
    label: "Cheat Detected",
    className:
      "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30",
  },
  TIMEOUT: {
    label: "Timeout",
    className:
      "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/30",
  },
}

const ALL_STATUSES: (AttemptStatus | "ALL")[] = [
  "ALL",
  "COMPLETED",
  "IN_PROGRESS",
  "CHEAT_DETECTED",
  "TIMEOUT",
]

type PublishedFilter = "ALL" | "PUBLISHED" | "UNPUBLISHED"

const LETTERS = ["A", "B", "C", "D", "E", "F"]

/** Security violation column definitions (used in the table header). */
interface ViolationColumn {
  key:
    | "devtoolsOpen"
    | "screenshotAttempts"
    | "keyboardViolations"
    | "faceNotDetected"
    | "multiFaceAlerts"
    | "lookAwayAlerts"
  label: string
  Icon: LucideIcon
  /** Threshold at which the count turns amber (rather than slate). */
  warn?: number
}

const VIOLATION_COLUMNS: ViolationColumn[] = [
  { key: "devtoolsOpen", label: "DevTools", Icon: Monitor, warn: 1 },
  { key: "screenshotAttempts", label: "Screenshots", Icon: Camera, warn: 1 },
  { key: "keyboardViolations", label: "Keyboard", Icon: Keyboard, warn: 1 },
  { key: "faceNotDetected", label: "Face ✗", Icon: ScanFace, warn: 1 },
  { key: "multiFaceAlerts", label: "MultiFace", Icon: Users, warn: 1 },
  { key: "lookAwayAlerts", label: "LookAway", Icon: EyeOff, warn: 1 },
]

export function AttemptsTable({ eventId, preselectedSlug }: AttemptsTableProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<AttemptStatus | "ALL">("ALL")
  const [publishedFilter, setPublishedFilter] = React.useState<PublishedFilter>("ALL")
  const [eventFilter, setEventFilter] = React.useState<string>(eventId || "ALL")
  const [page, setPage] = React.useState(0)
  const [selected, setSelected] = React.useState<QuizAttemptDto | null>(null)

  // Reset page on filter changes
  React.useEffect(() => {
    setPage(0)
  }, [search, statusFilter, publishedFilter, eventFilter])

  const eventsQuery = useQuery<EventDto[]>({
    queryKey: ["events"],
    queryFn: () => api<EventDto[]>("/api/events"),
  })

  const effectiveEventId =
    eventFilter && eventFilter !== "ALL" ? eventFilter : undefined

  const { data, isLoading, isError, error } = useQuery<{
    attempts: QuizAttemptDto[]
    total: number
  }>({
    queryKey: ["attempts", "all", effectiveEventId],
    queryFn: () =>
      api<{ attempts: QuizAttemptDto[]; total: number }>(
        `/api/attempts/list?all=true${
          effectiveEventId ? `&eventId=${effectiveEventId}` : ""
        }`
      ),
  })

  const attemptsList = data?.attempts ?? []

  const filtered = React.useMemo(() => {
    if (!attemptsList) return []
    return attemptsList.filter((a) => {
      if (
        preselectedSlug &&
        a.quizLink?.slug &&
        a.quizLink.slug !== preselectedSlug
      ) {
        return false
      }
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false
      if (publishedFilter !== "ALL") {
        const isPublished = a.published ?? !!a.publishedAt
        if (publishedFilter === "PUBLISHED" && !isPublished) return false
        if (publishedFilter === "UNPUBLISHED" && isPublished) return false
      }
      if (search) {
        const s = search.toLowerCase()
        const matchesEmail = a.user?.email?.toLowerCase().includes(s)
        const matchesName = a.user?.name?.toLowerCase().includes(s)
        if (!matchesEmail && !matchesName) return false
      }
      return true
    })
  }, [attemptsList, statusFilter, publishedFilter, search, preselectedSlug])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ---- Publish / Unpublish mutations ----
  const publishMutation = useMutation({
    mutationFn: (body: { quizLinkId?: string; attemptId?: string }) =>
      api<{ published: number }>("/api/attempts/publish", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data, vars) => {
      toast.success(
        vars.attemptId
          ? "Attempt published."
          : `${data.published} attempt${data.published === 1 ? "" : "s"} published.`,
      )
      queryClient.invalidateQueries({ queryKey: ["attempts", "all"] })
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to publish"),
  })

  const unpublishMutation = useMutation({
    mutationFn: (body: { quizLinkId?: string; attemptId?: string }) =>
      api<{ unpublished: number }>("/api/attempts/publish", {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    onSuccess: (data, vars) => {
      toast.success(
        vars.attemptId
          ? "Attempt unpublished."
          : `${data.unpublished} attempt${data.unpublished === 1 ? "" : "s"} unpublished.`,
      )
      queryClient.invalidateQueries({ queryKey: ["attempts", "all"] })
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to unpublish"),
  })

  // Bulk-publish the unpublished completed attempts in the current filtered set.
  const unpublishedCompleted = filtered.filter(
    (a) =>
      a.status === "COMPLETED" && !(a.published ?? !!a.publishedAt),
  )
  const unpublishedQuizLinkIds = Array.from(
    new Set(unpublishedCompleted.map((a) => a.quizLinkId).filter(Boolean) as string[]),
  )

  function handleBulkPublish() {
    if (unpublishedQuizLinkIds.length === 0) {
      toast.info("No unpublished attempts to publish.")
      return
    }
    // Publish for each unique quiz link id (the endpoint is per-link).
    Promise.all(
      unpublishedQuizLinkIds.map((quizLinkId) =>
        api<{ published: number }>("/api/attempts/publish", {
          method: "POST",
          body: JSON.stringify({ quizLinkId }),
        }),
      ),
    )
      .then((results) => {
        const total = results.reduce((s, r) => s + (r.published ?? 0), 0)
        toast.success(`Published ${total} attempt${total === 1 ? "" : "s"}.`)
        queryClient.invalidateQueries({ queryKey: ["attempts", "all"] })
      })
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Failed to publish"),
      )
  }

  function exportCsv() {
    if (filtered.length === 0) {
      toast.error("Nothing to export")
      return
    }
    const headers = [
      "participant_name",
      "participant_email",
      "event",
      "quiz_slug",
      "status",
      "score",
      "total_marks",
      "percentage",
      "passed",
      "time_taken_seconds",
      "tab_switches",
      "fullscreen_exits",
      "copy_attempts",
      "right_clicks",
      "devtools_open",
      "screenshot_attempts",
      "keyboard_violations",
      "face_not_detected",
      "multi_face_alerts",
      "look_away_alerts",
      "flagged_questions",
      "published",
      "published_at",
      "started_at",
      "completed_at",
    ]
    const rows = filtered.map((a) => {
      const flagged = Array.isArray(a.flaggedQuestions)
        ? a.flaggedQuestions.length
        : 0
      const published = a.published ?? !!a.publishedAt
      return [
        a.user?.name || "",
        a.user?.email || "",
        a.event?.title || "",
        a.quizLink?.slug || "",
        a.status,
        a.score ?? "",
        a.totalMarks ?? "",
        a.percentage ?? "",
        a.passed == null ? "" : a.passed ? "yes" : "no",
        a.timeTaken ?? "",
        a.tabSwitches,
        a.fullscreenExits,
        a.copyAttempts,
        a.rightClicks,
        a.devtoolsOpen,
        a.screenshotAttempts,
        a.keyboardViolations,
        a.faceNotDetected,
        a.multiFaceAlerts,
        a.lookAwayAlerts,
        flagged,
        published ? "yes" : "no",
        a.publishedAt || "",
        a.startedAt,
        a.completedAt || "",
      ]
    })
    const csv = buildCsv(headers, rows)
    downloadCsv(csv, `attempts-${format(new Date(), "yyyyMMdd-HHmm")}.csv`)
    toast.success(`Exported ${filtered.length} attempts`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Attempts</h2>
          <p className="text-sm text-muted-foreground">
            All quiz attempts across events. {filtered.length} shown.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unpublishedCompleted.length > 0 && (
            <Button
              variant="outline"
              onClick={handleBulkPublish}
              disabled={publishMutation.isPending}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              <Send className="size-4" />
              Publish {unpublishedCompleted.length} unpublished
            </Button>
          )}
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={eventFilter}
              onValueChange={(v) => setEventFilter(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All events</SelectItem>
                {(eventsQuery.data || []).map((ev) => (
                  <SelectItem key={ev.id} value={ev.id}>
                    {truncate(ev.title, 40)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as AttemptStatus | "ALL")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "ALL" ? "All statuses" : statusMeta[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={publishedFilter}
              onValueChange={(v) => setPublishedFilter(v as PublishedFilter)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Publish state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All publish states</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="UNPUBLISHED">Unpublished</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        {isError ? (
          <CardContent className="py-6 text-sm text-rose-600 dark:text-rose-400">
            Failed to load attempts: {(error as Error)?.message || "Unknown error"}
          </CardContent>
        ) : isLoading ? (
          <CardContent className="py-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        ) : pageData.length === 0 ? (
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Search className="size-7" />
            </div>
            <p className="mt-4 text-lg font-semibold">No attempts found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting filters or check back after participants take a quiz.
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead className="hidden md:table-cell">Event</TableHead>
                  <TableHead className="hidden lg:table-cell">Slug</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Pass</TableHead>
                  <TableHead className="text-center hidden md:table-cell">Time</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">Tabs</TableHead>
                  {/* New security violation columns (desktop only) */}
                  {VIOLATION_COLUMNS.map((col) => (
                    <TableHead
                      key={col.key}
                      className="hidden xl:table-cell text-center"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center">
                            <col.Icon className="size-3.5 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{col.label}</TooltipContent>
                      </Tooltip>
                    </TableHead>
                  ))}
                  <TableHead className="text-center hidden lg:table-cell">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center">
                          <Flag className="size-3.5 text-muted-foreground" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Flagged questions</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="text-center hidden lg:table-cell">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center">
                          <Lock className="size-3.5 text-muted-foreground" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Published state</TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">Started</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.map((a) => {
                  const meta = statusMeta[a.status] || statusMeta.IN_PROGRESS
                  const flaggedCount = Array.isArray(a.flaggedQuestions)
                    ? a.flaggedQuestions.length
                    : 0
                  const isPublished = a.published ?? !!a.publishedAt
                  return (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelected(a)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8">
                            {a.user?.image ? (
                              <AvatarImage src={a.user.image} alt={a.user.name || ""} />
                            ) : null}
                            <AvatarFallback className="bg-emerald-50 text-emerald-700 text-[10px] dark:bg-emerald-500/10 dark:text-emerald-400">
                              {initials(a.user?.name || a.user?.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {a.user?.name || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {a.user?.email || "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm max-w-[180px] truncate">
                        {a.event?.title || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {a.quizLink?.slug ? (
                          <code className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                            {a.quizLink.slug}
                          </code>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn("ring-1", meta.className)}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">
                        {a.score == null ? "—" : `${a.score}/${a.totalMarks ?? "?"}`}
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        {a.passed == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : a.passed ? (
                          <Check className="size-4 inline text-emerald-600" />
                        ) : (
                          <X className="size-4 inline text-rose-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-center hidden md:table-cell text-xs tabular-nums">
                        {a.timeTaken == null ? "—" : formatDuration(a.timeTaken)}
                      </TableCell>
                      <TableCell className="text-center hidden lg:table-cell tabular-nums text-sm">
                        <span
                          className={cn(
                            a.tabSwitches > 0
                              ? "text-rose-600 font-semibold"
                              : "text-muted-foreground"
                          )}
                        >
                          {a.tabSwitches}
                        </span>
                      </TableCell>
                      {/* Security violation count cells */}
                      {VIOLATION_COLUMNS.map((col) => {
                        const value = (a[col.key] ?? 0) as number
                        const warn = col.warn ?? 1
                        return (
                          <TableCell
                            key={col.key}
                            className="hidden xl:table-cell text-center text-xs tabular-nums"
                          >
                            <span
                              className={cn(
                                value >= warn
                                  ? value >= 3
                                    ? "text-rose-600 font-semibold"
                                    : "text-amber-600 font-medium"
                                  : "text-muted-foreground",
                              )}
                            >
                              {value}
                            </span>
                          </TableCell>
                        )
                      })}
                      {/* Flagged questions */}
                      <TableCell className="text-center hidden lg:table-cell">
                        {flaggedCount > 0 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                                <Flag className="size-3" />
                                {flaggedCount}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {flaggedCount} question{flaggedCount === 1 ? "" : "s"} flagged for review
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {/* Published badge */}
                      <TableCell className="text-center hidden lg:table-cell">
                        <PublishBadge published={isPublished} />
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                        {formatDateTime(a.startedAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelected(a)
                          }}
                        >
                          <Eye className="size-4" />
                          <span className="sr-only">View details</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="size-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail dialog */}
      <AttemptDetailDialog
        attempt={selected}
        onClose={() => setSelected(null)}
        onPublish={(attemptId) =>
          publishMutation.mutate({ attemptId })
        }
        onUnpublish={(attemptId) =>
          unpublishMutation.mutate({ attemptId })
        }
        publishPending={publishMutation.isPending}
        unpublishPending={unpublishMutation.isPending}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Publish badge
// ---------------------------------------------------------------------------

function PublishBadge({ published }: { published: boolean }) {
  return published ? (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    >
      <Check className="size-3" /> Published
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
    >
      <Lock className="size-3" /> Unpublished
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Attempt detail dialog with per-question breakdown
// ---------------------------------------------------------------------------

function AttemptDetailDialog({
  attempt,
  onClose,
  onPublish,
  onUnpublish,
  publishPending,
  unpublishPending,
}: {
  attempt: QuizAttemptDto | null
  onClose: () => void
  onPublish: (attemptId: string) => void
  onUnpublish: (attemptId: string) => void
  publishPending: boolean
  unpublishPending: boolean
}) {
  const open = !!attempt
  const { data: questions, isLoading } = useQuery<QuestionDto[]>({
    queryKey: ["questions", attempt?.eventId],
    queryFn: () =>
      api<QuestionDto[]>(`/api/questions?eventId=${attempt!.eventId}`),
    enabled: !!attempt?.eventId,
  })

  if (!attempt) return null

  const meta = statusMeta[attempt.status] || statusMeta.IN_PROGRESS
  const answers = attempt.answers || {}
  const order = attempt.questionOrder || questions?.map((q) => q.id) || []
  const ua = attempt as QuizAttemptDto & { ipAddress?: string | null; userAgent?: string | null }
  const isMobile = /mobile|android|iphone|ipad/i.test(ua.userAgent || "")
  const isPublished = attempt.published ?? !!attempt.publishedAt
  const flaggedCount = Array.isArray(attempt.flaggedQuestions)
    ? attempt.flaggedQuestions.length
    : 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>Attempt Details</span>
            <Badge variant="outline" className={cn("ring-1", meta.className)}>
              {meta.label}
            </Badge>
            <PublishBadge published={isPublished} />
          </DialogTitle>
          <DialogDescription>
            Started {formatDateTime(attempt.startedAt)}
            {attempt.completedAt ? ` · Completed ${formatDateTime(attempt.completedAt)}` : ""}
            {attempt.publishedAt
              ? ` · Published ${formatDateTime(attempt.publishedAt)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {/* Participant + summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Participant</p>
            <div className="flex items-center gap-2.5">
              <Avatar className="size-9">
                {attempt.user?.image ? (
                  <AvatarImage src={attempt.user.image} alt={attempt.user.name || ""} />
                ) : null}
                <AvatarFallback className="bg-emerald-50 text-emerald-700 text-xs dark:bg-emerald-500/10 dark:text-emerald-400">
                  {initials(attempt.user?.name || attempt.user?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {attempt.user?.name || "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {attempt.user?.email || "—"}
                </p>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Field label="Event" value={attempt.event?.title || "—"} />
              <Field label="Slug" value={attempt.quizLink?.slug || "—"} mono />
              <Field
                label="Score"
                value={
                  attempt.score == null
                    ? "—"
                    : `${attempt.score} / ${attempt.totalMarks ?? "?"}`
                }
              />
              <Field
                label="Percentage"
                value={attempt.percentage == null ? "—" : `${attempt.percentage}%`}
              />
              <Field
                label="Passed"
                value={
                  attempt.passed == null
                    ? "—"
                    : attempt.passed
                    ? "Yes"
                    : "No"
                }
              />
              <Field
                label="Time taken"
                value={
                  attempt.timeTaken == null ? "—" : formatDuration(attempt.timeTaken)
                }
              />
              {attempt.publishedAt && (
                <Field
                  label="Published at"
                  value={formatDateTime(attempt.publishedAt)}
                />
              )}
              {flaggedCount > 0 && (
                <Field
                  label="Flagged"
                  value={`${flaggedCount} question${flaggedCount === 1 ? "" : "s"}`}
                />
              )}
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="size-3.5" /> Anti-cheat metrics
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric
                label="Tab switches"
                value={attempt.tabSwitches}
                warn={attempt.tabSwitches > 0}
              />
              <Metric
                label="Fullscreen exits"
                value={attempt.fullscreenExits}
                warn={attempt.fullscreenExits > 0}
              />
              <Metric
                label="Copy attempts"
                value={attempt.copyAttempts}
                warn={attempt.copyAttempts > 0}
              />
              <Metric
                label="Right clicks"
                value={attempt.rightClicks}
                warn={attempt.rightClicks > 0}
              />
              <Metric
                label="DevTools open"
                value={attempt.devtoolsOpen}
                warn={attempt.devtoolsOpen > 0}
              />
              <Metric
                label="Screenshots"
                value={attempt.screenshotAttempts}
                warn={attempt.screenshotAttempts > 0}
              />
              <Metric
                label="Keyboard violations"
                value={attempt.keyboardViolations}
                warn={attempt.keyboardViolations > 0}
              />
              <Metric
                label="Face not detected"
                value={attempt.faceNotDetected}
                warn={attempt.faceNotDetected > 0}
              />
              <Metric
                label="Multi-face alerts"
                value={attempt.multiFaceAlerts}
                warn={attempt.multiFaceAlerts > 0}
              />
              <Metric
                label="Look-away alerts"
                value={attempt.lookAwayAlerts}
                warn={attempt.lookAwayAlerts > 0}
              />
            </div>
            <Separator />
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  {isMobile ? <Smartphone className="size-3" /> : <Monitor className="size-3" />}
                  IP address
                </span>
                <span className="font-mono">{ua.ipAddress || "—"}</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-muted-foreground whitespace-nowrap">User agent</span>
                <span className="font-mono text-[10px] text-right break-all">
                  {ua.userAgent || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Per-question answers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Answers breakdown</p>
            <span className="text-xs text-muted-foreground">
              {order.length} question{order.length === 1 ? "" : "s"}
            </span>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : questions && questions.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {order.map((qid, idx) => {
                const q = questions.find((x) => x.id === qid)
                if (!q) {
                  return (
                    <div
                      key={qid || idx}
                      className="rounded-lg border p-3 text-xs text-muted-foreground"
                    >
                      Question {idx + 1} is no longer available.
                    </div>
                  )
                }
                const selIdx = answers[qid]
                const sel =
                  typeof selIdx === "number" ? q.options[selIdx] : undefined
                const isCorrect = typeof selIdx === "number" && selIdx === q.correctAnswer
                const isUnanswered = selIdx == null
                return (
                  <div
                    key={q.id}
                    className="rounded-lg border p-3 space-y-1.5"
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        {idx + 1}
                      </span>
                      <p className="text-sm font-medium flex-1">{q.question}</p>
                      {isUnanswered ? (
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400">
                          Skipped
                        </Badge>
                      ) : isCorrect ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          <Check className="size-3" /> Correct
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                          <X className="size-3" /> Wrong
                        </Badge>
                      )}
                    </div>
                    <div className="grid gap-1 pl-7">
                      {q.options.map((opt, i) => {
                        const isSel = i === selIdx
                        const isAns = i === q.correctAnswer
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex items-center gap-2 rounded px-2 py-1 text-xs",
                              isAns
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                : isSel
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                                : "text-muted-foreground"
                            )}
                          >
                            <span className="font-mono font-semibold">
                              {LETTERS[i]}.
                            </span>
                            <span className="flex-1">{opt}</span>
                            {isAns && <Check className="size-3" />}
                            {isSel && !isAns && <X className="size-3" />}
                          </div>
                        )
                      })}
                      {isUnanswered && (
                        <p className="text-xs italic text-muted-foreground pl-1">
                          No answer recorded.
                        </p>
                      )}
                      {!isUnanswered && !isCorrect && sel && (
                        <p className="text-xs text-muted-foreground pl-1">
                          Selected: <span className="font-medium">{LETTERS[selIdx as number]}. {sel}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No question data available for this event.
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {attempt.status === "COMPLETED" && (
            isPublished ? (
              <Button
                variant="outline"
                onClick={() => onUnpublish(attempt.id)}
                disabled={unpublishPending}
                className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
              >
                <Lock className="size-4" /> Unpublish
              </Button>
            ) : (
              <Button
                onClick={() => onPublish(attempt.id)}
                disabled={publishPending}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Send className="size-4" /> Publish attempt
              </Button>
            )
          )}
          <Button variant="outline" onClick={onClose}>
            <ExternalLink className="size-4" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={cn("font-medium truncate", mono && "font-mono")}>{value}</p>
    </div>
  )
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string
  value: number
  warn?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5",
        warn && "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/5"
      )}
    >
      <p className="text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          warn ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-50"
        )}
      >
        {value}
      </p>
    </div>
  )
}
