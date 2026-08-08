"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Play,
  Square,
  ExternalLink,
  Settings2,
  CalendarDays,
  Loader2,
  Sparkles,
  Eye,
  FileQuestion,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn, truncate } from "@/lib/utils"

import { api, ACTIVITY_TYPE_META, ACTIVITY_STATUS_META } from "./api"
import { CreateActivityDialog } from "./create-activity-dialog"
import { ActivityEditor } from "./activity-editor"
import { ActivityResults } from "./activity-results"
import type { ActivityDto, EventDto } from "@/types"

interface ActivitiesPanelProps {
  eventId?: string
  eventTitle?: string
  onBack?: () => void
  onManageQuizLinks?: (quizLinkId: string) => void
}

interface SubView {
  mode: "editor" | "results"
  activity: ActivityDto
}

export function ActivitiesPanel({
  eventId,
  eventTitle,
  onBack,
  onManageQuizLinks,
}: ActivitiesPanelProps) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<ActivityDto | null>(
    null
  )
  const [subView, setSubView] = React.useState<SubView | null>(null)

  // Event picker — fetched only when no eventId provided.
  const eventsQuery = useQuery<EventDto[]>({
    queryKey: ["events"],
    queryFn: () => api<EventDto[]>("/api/events"),
    enabled: !eventId,
  })

  // Local picker state (when no eventId provided as prop).
  const [pickedEventId, setPickedEventId] = React.useState<string | undefined>(
    undefined
  )
  const effectiveEventId = eventId || pickedEventId

  const activitiesQuery = useQuery<ActivityDto[]>({
    queryKey: ["activities", effectiveEventId],
    queryFn: () =>
      api<ActivityDto[]>(
        `/api/activities?eventId=${encodeURIComponent(effectiveEventId!)}`
      ),
    enabled: !!effectiveEventId,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/activities/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities", effectiveEventId] })
      toast.success("Activity deleted")
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error("Could not delete: " + e.message),
  })

  const duplicateMutation = useMutation({
    mutationFn: (id: string) =>
      api<ActivityDto>(`/api/activities/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities", effectiveEventId] })
      toast.success("Activity duplicated")
    },
    onError: (e: Error) => toast.error("Could not duplicate: " + e.message),
  })

  const startMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/activities/${id}/start`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities", effectiveEventId] })
      toast.success("Activity is now LIVE")
    },
    onError: (e: Error) => toast.error("Could not start: " + e.message),
  })

  const closeMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/activities/${id}/close`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities", effectiveEventId] })
      toast.success("Activity closed")
    },
    onError: (e: Error) => toast.error("Could not close: " + e.message),
  })

  // --- Sub-view rendering -------------------------------------------------

  if (subView) {
    if (subView.mode === "editor") {
      return (
        <ActivityEditor
          activity={subView.activity}
          onBack={() => setSubView(null)}
          onManageQuizLinks={(quizLinkId) => {
            setSubView(null)
            onManageQuizLinks?.(quizLinkId)
          }}
          onDeleted={() => {
            setSubView(null)
          }}
          onDuplicated={(dup) => {
            setSubView(null)
            // Open the duplicate in the editor for easy renaming.
            setSubView({ mode: "editor", activity: dup })
          }}
        />
      )
    }
    return (
      <ActivityResults
        activity={subView.activity}
        onBack={() => setSubView(null)}
      />
    )
  }

  // --- Event picker (no event selected) ----------------------------------

  if (!effectiveEventId) {
    return (
      <EventPicker
        events={eventsQuery.data ?? []}
        loading={eventsQuery.isLoading}
        error={eventsQuery.isError ? eventsQuery.error : null}
        onPick={setPickedEventId}
      />
    )
  }

  const activities = activitiesQuery.data ?? []
  const title = eventTitle ?? eventsQuery.data?.find((e) => e.id === effectiveEventId)?.title ?? "Event"

  // Group by session label.
  const groups = groupBySession(activities)

  function openEditor(a: ActivityDto) {
    setSubView({ mode: "editor", activity: a })
  }
  function openResults(a: ActivityDto) {
    setSubView({ mode: "results", activity: a })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Activities
          </p>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {truncate(title, 60)}
          </h2>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              Back
            </Button>
          )}
          {!eventId && pickedEventId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPickedEventId(undefined)}
            >
              Switch event
            </Button>
          )}
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" /> Add activity
          </Button>
        </div>
      </div>

      {/* List */}
      {activitiesQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : activitiesQuery.isError ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-rose-600">
              Could not load activities:{" "}
              {(activitiesQuery.error as Error).message}
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => activitiesQuery.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : activities.length === 0 ? (
        <EmptyState onAdd={() => setCreateOpen(true)} />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.session ?? "_default"} className="flex flex-col gap-2">
              {g.session && (
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  {g.session}
                  <span className="text-muted-foreground/70 font-normal normal-case tracking-normal">
                    ({g.items.length})
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {g.items.map((a, idx) => (
                  <ActivityTile
                    key={a.id}
                    activity={a}
                    index={idx}
                    onManage={() => openEditor(a)}
                    onViewResults={() => openResults(a)}
                    onDuplicate={() => duplicateMutation.mutate(a.id)}
                    onDelete={() => setDeleteTarget(a)}
                    onStart={() => startMutation.mutate(a.id)}
                    onClose={() => closeMutation.mutate(a.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <CreateActivityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        eventId={effectiveEventId}
        onCreated={(created) => {
          // For POLL/VOTING: immediately open the editor to add questions.
          if (
            created.type === "POLL" ||
            created.type === "VOTING" ||
            created.type === "SURVEY" ||
            created.type === "FEEDBACK" ||
            created.type === "KNOWLEDGE_CHECK"
          ) {
            setTimeout(() => openEditor(created), 100)
          }
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete activity?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.title}&quot; and
              all responses. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Session grouping
// ---------------------------------------------------------------------------

interface SessionGroup {
  session: string | null
  items: ActivityDto[]
}

function groupBySession(activities: ActivityDto[]): SessionGroup[] {
  const map = new Map<string, ActivityDto[]>()
  for (const a of activities) {
    const key = a.session ?? "_default_"
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  }
  // Sort items within a session by sortOrder, then createdAt.
  for (const arr of map.values()) {
    arr.sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        (a.createdAt || "").localeCompare(b.createdAt || "")
    )
  }
  // Sessions without a label go last.
  const groups: SessionGroup[] = []
  for (const [key, items] of map.entries()) {
    const session = key === "_default_" ? null : key
    groups.push({ session, items })
  }
  groups.sort((a, b) => {
    if (a.session === null) return 1
    if (b.session === null) return -1
    return a.session.localeCompare(b.session)
  })
  return groups
}

// ---------------------------------------------------------------------------
// Activity tile
// ---------------------------------------------------------------------------

function ActivityTile({
  activity,
  index,
  onManage,
  onViewResults,
  onDuplicate,
  onDelete,
  onStart,
  onClose,
}: {
  activity: ActivityDto
  index: number
  onManage: () => void
  onViewResults: () => void
  onDuplicate: () => void
  onDelete: () => void
  onStart: () => void
  onClose: () => void
}) {
  const typeMeta = ACTIVITY_TYPE_META[activity.type]
  const statusMeta = ACTIVITY_STATUS_META[activity.status]
  const Icon = typeMeta.icon
  const isLive = activity.status === "LIVE"
  const responses = activity.responseCount ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: Math.min(index * 0.025, 0.2) }}
    >
      <Card
        className={cn(
          "group overflow-hidden py-0 transition-all hover:shadow-md",
          isLive && "ring-1 ring-emerald-300 dark:ring-emerald-500/40"
        )}
      >
        <CardContent className="flex flex-col gap-3 p-4">
          {/* Top: icon + badges */}
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "inline-flex size-10 shrink-0 items-center justify-center rounded-lg ring-1",
                typeMeta.iconWrap
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
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
                {!activity.isEnabled && (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                  >
                    Disabled
                  </Badge>
                )}
              </div>
              <h3 className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                {activity.title}
              </h3>
              {activity.description && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                  {activity.description}
                </p>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {typeof activity.questionCount === "number" &&
              activity.questionCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <FileQuestion className="size-3" /> {activity.questionCount} Qs
                </span>
              )}
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3" /> {responses}{" "}
              {responses === 1 ? "response" : "responses"}
            </span>
            {activity.slug && (
              <span className="font-mono truncate">/{activity.slug}</span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-1 flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={onManage}
            >
              <Settings2 className="size-3.5" />
              Manage
            </Button>
            {(isLive || responses > 0) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1"
                onClick={onViewResults}
              >
                {isLive ? (
                  <>
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                    </span>
                    View Live
                  </>
                ) : (
                  <>
                    <ExternalLink className="size-3.5" />
                    Results
                  </>
                )}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto size-8 p-0"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={onManage}>
                  <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="size-4" /> Duplicate
                </DropdownMenuItem>
                {!isLive ? (
                  <DropdownMenuItem
                    onClick={onStart}
                    className="text-emerald-700 focus:text-emerald-800 dark:text-emerald-400"
                  >
                    <Play className="size-4" /> Start
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={onClose}
                    className="text-rose-700 focus:text-rose-800 dark:text-rose-400"
                  >
                    <Square className="size-4" /> Close
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-rose-700 focus:text-rose-800 dark:text-rose-400"
                >
                  <Trash2 className="size-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
        <Sparkles className="size-7" />
      </span>
      <h3 className="text-base font-semibold">No activities yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Engage your participants with polls, quizzes, Q&amp;A and feedback.
      </p>
      <Button
        onClick={onAdd}
        className="mt-5 bg-emerald-600 text-white hover:bg-emerald-700"
      >
        <Plus className="size-4" /> Add activity
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Event picker (used when no eventId provided as prop)
// ---------------------------------------------------------------------------

function EventPicker({
  events,
  loading,
  error,
  onPick,
}: {
  events: EventDto[]
  loading: boolean
  error: Error | null
  onPick: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Activities
        </p>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Select an event
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick an event to manage its activities — polls, surveys, Q&amp;A and more.
        </p>
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-rose-600">
            Could not load events: {error.message}
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No events yet. Create one in the Events tab first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onPick(e.id)}
              className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/30 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700/60 dark:hover:bg-emerald-500/5"
            >
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30">
                <CalendarDays className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {e.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.isActive ? "Active" : "Inactive"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
