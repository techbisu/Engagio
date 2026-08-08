"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  Award,
  CalendarDays,
  ClipboardList,
  History,
  LayoutDashboard,
  Loader2,
  Plus,
  Sparkles,
  Users,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { format, parseISO, isAfter } from "date-fns"

import { cn, formatDate, formatDateTime, timeAgo, truncate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/shared/empty-state"

import {
  api,
  type AuditLogDto,
  type OrganizationDto,
  type OrgStatsDto,
  ROLE_LABEL,
} from "./api"
import type { EventDto } from "@/types"

interface OrgDashboardProps {
  /** The organization to display. */
  org: OrganizationDto
  /** Called when the user clicks "Create Event". */
  onCreateEvent?: () => void
  /** Called when the user clicks "Manage members". */
  onOpenMembers?: () => void
  /** Called when the user clicks an event row. */
  onOpenEvent?: (eventId: string) => void
  /** Called when the user clicks "View all activity". */
  onViewAllActivity?: () => void
}

export function OrgDashboard({
  org,
  onCreateEvent,
  onOpenMembers,
  onOpenEvent,
  onViewAllActivity,
}: OrgDashboardProps) {
  // ─── Stats ────────────────────────────────────────────────────────────
  const statsQuery = useQuery<OrgStatsDto>({
    queryKey: ["organizations", org.id, "stats"],
    queryFn: () => api<OrgStatsDto>(`/api/organizations/${org.id}/stats`),
    retry: 1,
    staleTime: 60_000,
  })

  // ─── Recent audit activity ────────────────────────────────────────────
  const auditQuery = useQuery<{ logs: AuditLogDto[] }>({
    queryKey: ["organizations", org.id, "audit-log", { limit: 5 }],
    queryFn: () =>
      api<{ logs: AuditLogDto[] }>(
        `/api/organizations/${org.id}/audit-log?limit=5`,
      ),
    retry: 1,
    staleTime: 30_000,
  })

  // ─── Upcoming events (org-scoped) ─────────────────────────────────────
  // Reuse the existing /api/events query (already org-scoped via the
  // x-org-slug header). Only show upcoming or active events.
  const eventsQuery = useQuery<EventDto[]>({
    queryKey: ["events"],
    queryFn: () => api<EventDto[]>("/api/events"),
    retry: 1,
    staleTime: 60_000,
  })

  const upcomingEvents = React.useMemo(() => {
    const all = eventsQuery.data ?? []
    const now = new Date()
    return all
      .filter((e) => isAfter(new Date(e.endDate), now))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5)
  }, [eventsQuery.data])

  const planName = org.plan?.displayName ?? "Free"

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white via-emerald-50/40 to-teal-50/30 p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 sm:p-6"
      >
        {/* Accent bar */}
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 h-full w-1"
          style={{ background: `linear-gradient(180deg, ${org.primaryColor}, ${org.secondaryColor})` }}
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <OrgLogo
              name={org.name}
              logoUrl={org.logoUrl}
              color={org.primaryColor}
              className="size-14 shrink-0 sm:size-16"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
                  {org.name}
                </h1>
                <Badge
                  variant="outline"
                  className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <Sparkles className="size-3" />
                  {planName}
                </Badge>
              </div>
              {org.description ? (
                <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                  {org.description}
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Organization overview & analytics
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onOpenMembers && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenMembers}
                className="gap-1.5 border-slate-200 dark:border-slate-800"
              >
                <UserPlus className="size-4" />
                <span className="hidden sm:inline">Members</span>
              </Button>
            )}
            {onCreateEvent && (
              <Button
                type="button"
                size="sm"
                onClick={onCreateEvent}
                className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700"
              >
                <Plus className="size-4" />
                Create Event
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ─── Stats grid ──────────────────────────────────────────────────── */}
      <section aria-label="Organization stats">
        <StatsGrid
          query={statsQuery}
          onOpenMembers={onOpenMembers}
        />
      </section>

      {/* ─── Two-column layout: recent activity + upcoming events ────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent activity */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <History className="size-4 text-emerald-600 dark:text-emerald-400" />
                Recent activity
              </span>
              {onViewAllActivity && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onViewAllActivity}
                  className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  View all
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivity query={auditQuery} />
          </CardContent>
        </Card>

        {/* Upcoming events */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-emerald-600 dark:text-emerald-400" />
              Upcoming events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UpcomingEvents
              isLoading={eventsQuery.isLoading}
              events={upcomingEvents}
              onOpenEvent={onOpenEvent}
              onCreateEvent={onCreateEvent}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatsGrid({
  query,
  onOpenMembers,
}: {
  query: ReturnType<typeof useQuery<OrgStatsDto>>
  onOpenMembers?: () => void
}) {
  const stats: Array<{
    key: keyof OrgStatsDto
    label: string
    icon: LucideIcon
    hint?: string
  }> = [
    { key: "eventCount", label: "Events", icon: CalendarDays, hint: "Total events" },
    { key: "participantCount", label: "Participants", icon: Users, hint: "Unique participants" },
    { key: "activityCount", label: "Activities", icon: Sparkles, hint: "Live polls & Q&A" },
    { key: "assessmentCount", label: "Assessments", icon: ClipboardList, hint: "Quiz attempts" },
    { key: "certificateCount", label: "Certificates", icon: Award, hint: "Issued certificates" },
    { key: "memberCount", label: "Members", icon: UserPlus, hint: "Team members" },
  ]

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Skeleton key={s.key} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
        Failed to load stats. Please try again later.
      </div>
    )
  }

  const data = query.data

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((s, i) => {
        const value = data?.[s.key] ?? 0
        const Icon = s.icon
        const isMembers = s.key === "memberCount"
        return (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900",
              isMembers && onOpenMembers && "cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-800",
            )}
            onClick={isMembers && onOpenMembers ? onOpenMembers : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/40">
                <Icon className="size-4" />
              </span>
              {isMembers && onOpenMembers && (
                <Plus className="size-3 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600" />
              )}
            </div>
            <p className="mt-2.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {value.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {s.label}
            </p>
          </motion.div>
        )
      })}
    </div>
  )
}

function RecentActivity({
  query,
}: {
  query: ReturnType<typeof useQuery<{ logs: AuditLogDto[] }>>
}) {
  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    )
  }

  const logs = query.data?.logs ?? []
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Actions like creating events, inviting members, and verifying payments will show up here."
        className="border-dashed"
      />
    )
  }

  return (
    <ul className="space-y-1">
      {logs.map((log, i) => (
        <motion.li
          key={log.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: i * 0.05 }}
          className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40"
        >
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-400 dark:bg-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              <span className="font-mono text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {formatAction(log.action)}
              </span>
              {log.entityType && (
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                  on {log.entityType}
                </span>
              )}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {log.user?.name || log.user?.email || "System"}
              {" · "}
              {timeAgo(log.createdAt)}
            </p>
          </div>
        </motion.li>
      ))}
    </ul>
  )
}

function UpcomingEvents({
  isLoading,
  events,
  onOpenEvent,
  onCreateEvent,
}: {
  isLoading: boolean
  events: EventDto[]
  onOpenEvent?: (eventId: string) => void
  onCreateEvent?: () => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No upcoming events"
        description="Create your first event to get started. Events are where you manage activities, registrations, assessments, and certificates."
        actionLabel={onCreateEvent ? "Create Event" : undefined}
        onAction={onCreateEvent}
        className="border-dashed"
      />
    )
  }

  return (
    <ul className="space-y-1.5">
      {events.map((event) => (
        <li key={event.id}>
          <button
            type="button"
            onClick={() => onOpenEvent?.(event.id)}
            className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-800/40"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CalendarDays className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {event.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {formatDate(event.startDate)}
                {event.attemptCount ? ` · ${event.attemptCount} attempts` : ""}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-xs",
                event.isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400",
              )}
            >
              {event.isActive ? "Active" : "Draft"}
            </Badge>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function OrgLogo({
  name,
  logoUrl,
  color,
  className,
}: {
  name: string
  logoUrl?: string | null
  color?: string
  className?: string
}) {
  if (logoUrl) {
    return (
      <Avatar className={cn("rounded-xl", className)}>
        <AvatarImage src={logoUrl} alt={`${name} logo`} />
        <AvatarFallback
          className="rounded-xl text-sm font-semibold text-white"
          style={{ background: color || "#10b981" }}
        >
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    )
  }
  return (
    <span
      className={cn(
        "grid place-items-center rounded-xl text-white",
        className,
      )}
      style={{ background: color || "#10b981" }}
      aria-hidden="true"
    >
      <LayoutDashboard className="size-5" />
    </span>
  )
}

function formatAction(action: string): string {
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
