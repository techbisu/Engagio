"use client"

/**
 * Combined Results & Certificates dashboard.
 *
 * This is the admin "publish results + issue certificates" workflow surface.
 * It pulls attempts + certificates for a selected event, joins them by userId
 * client-side, and lets the admin:
 *   - See every participant's score, result-publish status, and certificate
 *     status in one table.
 *   - Bulk-publish unpublished completed attempts.
 *   - Bulk-generate certificates for eligible participants.
 *   - Generate a certificate for one participant (with manual-override flow
 *     when they don't meet the automatic eligibility criteria).
 *   - Revoke / reinstate / re-issue certificates.
 *   - Open a detail drawer with the participant timeline (Registered →
 *     Payment → Assessment → Result Published → Certificate Issued).
 *
 * Design rules:
 *   - Emerald/teal accents on slate neutrals (no indigo/blue).
 *   - Mobile-first: cards on mobile, table on sm+.
 *   - UseQuery + useMutation with query invalidation.
 *   - sonner toasts for feedback.
 */

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import {
  Award,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  Inbox,
  Loader2,
  Mail,
  Megaphone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldBan,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
  ExternalLink,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react"

import { api } from "./api"
import type {
  AttemptStatus,
  CertificateDto,
  EventDto,
  QuizAttemptDto,
} from "@/types"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  CertificateRenderer,
  downloadCertificatePng,
} from "@/components/cert/certificate-renderer"
import { cn, formatDateTime, formatDuration, initials } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttemptsListResponse {
  attempts: QuizAttemptDto[]
  total: number
}
interface CertsListResponse {
  certificates: CertificateDto[]
  total: number
}
interface GenerateBulkResponse {
  generated: number
  certificates: CertificateDto[]
  errors: { userId: string; error: string }[]
}

/** Combined per-participant row: latest attempt + cert (joined by userId). */
interface ParticipantRow {
  userId: string
  userName: string
  userEmail: string
  userImage?: string | null
  /** Latest attempt for this user (most recent startedAt). May be in progress. */
  attempt: QuizAttemptDto | null
  /** True iff the user has any IN_PROGRESS attempt (and no completed one yet). */
  hasOnlyInProgress: boolean
  /** The user's certificate for this event, if any. */
  certificate: CertificateDto | null
}

const TEMPLATE_LABEL: Record<string, string> = {
  classic: "Classic",
  modern: "Modern",
  elegant: "Elegant",
  bold: "Bold",
  minimal: "Minimal",
}

const RESULT_STATUS_META: Record<
  "PUBLISHED" | "PENDING" | "IN_PROGRESS",
  { label: string; className: string }
> = {
  PUBLISHED: {
    label: "Published",
    className:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
  },
  PENDING: {
    label: "Pending",
    className:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className:
      "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30",
  },
}

// ---------------------------------------------------------------------------
// Top-level component
// ---------------------------------------------------------------------------
export function ResultsCertDashboard() {
  const qc = useQueryClient()

  // --- selector state ---
  const [selectedEventId, setSelectedEventId] = React.useState<string>("")

  const eventsQuery = useQuery<EventDto[]>(({
    queryKey: ["events"],
    queryFn: () => api<EventDto[]>("/api/events"),
  }))
  const events = eventsQuery.data ?? []

  // Auto-select the first event if none selected.
  React.useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      setSelectedEventId(events[0].id)
    }
  }, [selectedEventId, events])

  // --- data queries (only fire when an event is selected) ---
  const attemptsQuery = useQuery<AttemptsListResponse>({
    queryKey: ["attempts", "all", selectedEventId],
    queryFn: () =>
      api<AttemptsListResponse>(
        `/api/attempts/list?all=true&eventId=${encodeURIComponent(selectedEventId)}`,
      ),
    enabled: !!selectedEventId,
  })

  const certsQuery = useQuery<CertsListResponse>({
    queryKey: ["certificates", "admin", selectedEventId],
    queryFn: () =>
      api<CertsListResponse>(
        `/api/certificates?all=true&eventId=${encodeURIComponent(selectedEventId)}`,
      ),
    enabled: !!selectedEventId,
  })

  const eventDetailQuery = useQuery<EventDto>({
    queryKey: ["event", selectedEventId],
    queryFn: () => api<EventDto>(`/api/events/${selectedEventId}`),
    enabled: !!selectedEventId,
  })

  // --- UI state ---
  const [search, setSearch] = React.useState("")
  const [resultStatusFilter, setResultStatusFilter] = React.useState<
    "ALL" | "PUBLISHED" | "PENDING" | "IN_PROGRESS"
  >("ALL")
  const [certStatusFilter, setCertStatusFilter] = React.useState<
    "ALL" | "GENERATED" | "ELIGIBLE" | "NOT_ELIGIBLE" | "REVOKED"
  >("ALL")
  const [selectedRow, setSelectedRow] = React.useState<ParticipantRow | null>(null)
  const [bulkGenOpen, setBulkGenOpen] = React.useState(false)
  const [overrideTarget, setOverrideTarget] = React.useState<ParticipantRow | null>(null)
  const [revokeTarget, setRevokeTarget] = React.useState<CertificateDto | null>(null)
  const [revokeReason, setRevokeReason] = React.useState("")

  // --- combine attempts + certs by userId ---
  const rows: ParticipantRow[] = React.useMemo(() => {
    const attempts = attemptsQuery.data?.attempts ?? []
    const certs = certsQuery.data?.certificates ?? []

    // Group attempts by userId, keep the latest (most recent startedAt).
    const byUser = new Map<string, QuizAttemptDto>()
    const hasCompletedByUser = new Set<string>()
    const userMeta = new Map<
      string,
      { name: string; email: string; image?: string | null }
    >()
    for (const a of attempts) {
      if (!a.userId) continue
      const prev = byUser.get(a.userId)
      if (!prev || new Date(a.startedAt) > new Date(prev.startedAt)) {
        byUser.set(a.userId, a)
      }
      if (
        a.status === "COMPLETED" ||
        a.status === "TIMEOUT" ||
        a.status === "CHEAT_DETECTED"
      ) {
        hasCompletedByUser.add(a.userId)
      }
      if (a.user) {
        userMeta.set(a.userId, {
          name: a.user.name ?? "",
          email: a.user.email,
          image: a.user.image ?? null,
        })
      }
    }

    // Index certs by userId (certificates are unique per user+event).
    const certByUser = new Map<string, CertificateDto>()
    for (const c of certs) {
      // If there are multiple (shouldn't be), keep the most recent by issuedAt.
      const prev = certByUser.get(c.userId)
      if (!prev || new Date(c.issuedAt) > new Date(prev.issuedAt)) {
        certByUser.set(c.userId, c)
        if (c.user) {
          userMeta.set(c.userId, {
            name: c.user.name ?? "",
            email: c.user.email,
            image: null,
          })
        }
      }
    }

    // Combine — also include cert-only users (no attempt).
    const allUserIds = new Set<string>([
      ...byUser.keys(),
      ...certByUser.keys(),
    ])
    const list: ParticipantRow[] = []
    for (const userId of allUserIds) {
      const attempt = byUser.get(userId) ?? null
      const meta = userMeta.get(userId)
      list.push({
        userId,
        userName: meta?.name ?? "Unnamed participant",
        userEmail: meta?.email ?? "",
        userImage: meta?.image ?? null,
        attempt,
        hasOnlyInProgress:
          !!attempt &&
          attempt.status === "IN_PROGRESS" &&
          !hasCompletedByUser.has(userId),
        certificate: certByUser.get(userId) ?? null,
      })
    }
    // Sort: most recent activity first.
    list.sort((a, b) => {
      const aDate = a.attempt?.startedAt || a.certificate?.issuedAt || ""
      const bDate = b.attempt?.startedAt || b.certificate?.issuedAt || ""
      return bDate.localeCompare(aDate)
    })
    return list
  }, [attemptsQuery.data, certsQuery.data])

  // --- derived: filtered rows + stats ---
  const filteredRows = React.useMemo(() => {
    return rows.filter((r) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        if (
          !r.userName.toLowerCase().includes(q) &&
          !r.userEmail.toLowerCase().includes(q)
        ) {
          return false
        }
      }
      const rs = getResultStatus(r)
      if (resultStatusFilter !== "ALL" && rs !== resultStatusFilter) return false
      const cs = getCertStatus(r, eventDetailQuery.data).status
      if (certStatusFilter !== "ALL" && cs !== certStatusFilter) return false
      return true
    })
  }, [rows, search, resultStatusFilter, certStatusFilter, eventDetailQuery.data])

  const stats = React.useMemo(() => {
    let total = 0
    let completed = 0
    let published = 0
    let pending = 0
    let certsIssued = 0
    let certsPendingEligible = 0
    for (const r of rows) {
      total++
      const a = r.attempt
      if (
        a &&
        (a.status === "COMPLETED" || a.status === "TIMEOUT" || a.status === "CHEAT_DETECTED")
      ) {
        completed++
      }
      const rs = getResultStatus(r)
      if (rs === "PUBLISHED") published++
      if (rs === "PENDING") pending++
      if (r.certificate && r.certificate.status === "VALID") {
        certsIssued++
      } else {
        const cs = getCertStatus(r, eventDetailQuery.data)
        if (cs.status === "ELIGIBLE") certsPendingEligible++
      }
    }
    return { total, completed, published, pending, certsIssued, certsPendingEligible }
  }, [rows, eventDetailQuery.data])

  // --- mutations ---
  const publishMutation = useMutation({
    mutationFn: (body: { quizLinkId?: string; attemptId?: string }) =>
      api<{ published: number }>("/api/attempts/publish", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data, vars) => {
      toast.success(
        vars.attemptId
          ? "Result published."
          : `${data.published} result${data.published === 1 ? "" : "s"} published.`,
      )
      qc.invalidateQueries({ queryKey: ["attempts", "all"] })
      qc.invalidateQueries({ queryKey: ["analytics"] })
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
          ? "Result unpublished."
          : `${data.unpublished} result${data.unpublished === 1 ? "" : "s"} unpublished.`,
      )
      qc.invalidateQueries({ queryKey: ["attempts", "all"] })
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to unpublish"),
  })

  // --- Cleanup stale IN_PROGRESS attempts ---
  const cleanupMutation = useMutation({
    mutationFn: () =>
      api<{ cleaned: number; details: { byTimeLimit: number; byAge: number } }>(
        "/api/attempts/cleanup",
        { method: "POST" }
      ),
    onSuccess: (data) => {
      if (data.cleaned > 0) {
        toast.success(`Cleaned up ${data.cleaned} stale attempt${data.cleaned === 1 ? "" : "s"}!`, {
          description: `${data.details.byTimeLimit} timed out, ${data.details.byAge} abandoned (24h+)`,
        })
      } else {
        toast.success("No stale attempts found — all clean!")
      }
      qc.invalidateQueries({ queryKey: ["attempts", "all"] })
      qc.invalidateQueries({ queryKey: ["analytics"] })
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to clean up stale attempts"),
  })

  const generateSingleMutation = useMutation({
    mutationFn: (args: {
      userId: string
      eventId: string
      manualOverride?: boolean
    }) =>
      api<{ certificate: CertificateDto }>("/api/certificates/generate", {
        method: "POST",
        body: JSON.stringify({
          userId: args.userId,
          eventId: args.eventId,
          manualOverride: !!args.manualOverride,
        }),
      }),
    onSuccess: (data) => {
      toast.success("Certificate generated", {
        description: data.certificate.certificateNumber,
      })
      qc.invalidateQueries({ queryKey: ["certificates"] })
      qc.invalidateQueries({ queryKey: ["my-certificates"] })
      qc.invalidateQueries({ queryKey: ["events"] })
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to generate certificate"),
  })

  const revokeMutation = useMutation({
    mutationFn: (args: { id: string; reason?: string }) =>
      api<{ success: boolean; certificate: CertificateDto }>(
        `/api/certificates/${args.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ action: "revoke", reason: args.reason }),
        },
      ),
    onSuccess: () => {
      toast.success("Certificate revoked")
      qc.invalidateQueries({ queryKey: ["certificates"] })
      qc.invalidateQueries({ queryKey: ["my-certificates"] })
      setRevokeTarget(null)
      setRevokeReason("")
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to revoke"),
  })

  const reinstateMutation = useMutation({
    mutationFn: (id: string) =>
      api<{ success: boolean; certificate: CertificateDto }>(
        `/api/certificates/${id}`,
        { method: "PATCH", body: JSON.stringify({ action: "reinstate" }) },
      ),
    onSuccess: () => {
      toast.success("Certificate reinstated")
      qc.invalidateQueries({ queryKey: ["certificates"] })
      qc.invalidateQueries({ queryKey: ["my-certificates"] })
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to reinstate"),
  })

  // --- bulk publish: publish all unpublished completed attempts ---
  // The publish endpoint accepts { quizLinkId } so we batch by unique link.
  const unpublishedQuizLinkIds = React.useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const a = r.attempt
      if (
        a &&
        a.status === "COMPLETED" &&
        !(a.published ?? !!a.publishedAt) &&
        a.quizLinkId
      ) {
        set.add(a.quizLinkId)
      }
    }
    return Array.from(set)
  }, [rows])

  const bulkPublishMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.all(
        unpublishedQuizLinkIds.map((quizLinkId) =>
          api<{ published: number }>("/api/attempts/publish", {
            method: "POST",
            body: JSON.stringify({ quizLinkId }),
          }),
        ),
      )
      return results.reduce((s, r) => s + (r.published ?? 0), 0)
    },
    onSuccess: (total) => {
      toast.success(`Published ${total} result${total === 1 ? "" : "s"}.`)
      qc.invalidateQueries({ queryKey: ["attempts", "all"] })
      qc.invalidateQueries({ queryKey: ["analytics"] })
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to bulk publish"),
  })

  // --- handlers ---
  function handleBulkPublish() {
    if (unpublishedQuizLinkIds.length === 0) {
      toast.info("No unpublished results to publish.")
      return
    }
    bulkPublishMutation.mutate()
  }

  function handleGenerateForRow(row: ParticipantRow) {
    if (!selectedEventId) return
    const cs = getCertStatus(row, eventDetailQuery.data)
    if (cs.status === "GENERATED" && row.certificate) {
      // Already has a cert — open the detail drawer instead.
      setSelectedRow(row)
      return
    }
    if (cs.status === "NOT_ELIGIBLE") {
      // Trigger the override warning dialog.
      setOverrideTarget(row)
      return
    }
    generateSingleMutation.mutate({
      userId: row.userId,
      eventId: selectedEventId,
    })
  }

  function handleConfirmOverride() {
    if (!overrideTarget || !selectedEventId) return
    generateSingleMutation.mutate(
      {
        userId: overrideTarget.userId,
        eventId: selectedEventId,
        manualOverride: true,
      },
      {
        onSuccess: () => {
          setOverrideTarget(null)
          setSelectedRow(null)
        },
      },
    )
  }

  const isLoading =
    attemptsQuery.isLoading || certsQuery.isLoading || eventDetailQuery.isLoading
  const isFetching =
    attemptsQuery.isFetching || certsQuery.isFetching || eventDetailQuery.isFetching

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-5 text-emerald-600 dark:text-emerald-400" />
            Results &amp; Certificates
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Publish results and issue certificates — all participants in one view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedEventId}
            onValueChange={(v) => setSelectedEventId(v)}
            disabled={eventsQuery.isLoading}
          >
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue
                placeholder={
                  eventsQuery.isLoading ? "Loading events…" : "Select an event"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["attempts", "all"] })
              qc.invalidateQueries({ queryKey: ["certificates", "admin"] })
              qc.invalidateQueries({ queryKey: ["event", selectedEventId] })
            }}
            aria-label="Refresh"
          >
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {!selectedEventId ? (
        <EmptyEventState />
      ) : isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Participants" value={stats.total} icon={Users} accent="slate" />
            <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} accent="emerald" />
            <StatCard label="Published" value={stats.published} icon={Megaphone} accent="emerald" />
            <StatCard label="Pending" value={stats.pending} icon={Clock} accent="amber" />
            <StatCard label="Certs Issued" value={stats.certsIssued} icon={Award} accent="emerald" />
            <StatCard
              label="Certs Eligible"
              value={stats.certsPendingEligible}
              icon={Sparkles}
              accent="amber"
            />
          </div>

          {/* Bulk action bar */}
          <Card className="border-emerald-200/60 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-500/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <Sparkles className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Bulk actions</p>
                  <p className="text-xs text-muted-foreground">
                    Publish all unpublished completed results, or open the
                    certificate picker.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleBulkPublish}
                  disabled={
                    bulkPublishMutation.isPending ||
                    unpublishedQuizLinkIds.length === 0
                  }
                  className="bg-white dark:bg-slate-900"
                >
                  {bulkPublishMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Megaphone className="size-4" />
                  )}
                  Publish All Results
                  {unpublishedQuizLinkIds.length > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"
                    >
                      {unpublishedQuizLinkIds.length} link
                      {unpublishedQuizLinkIds.length === 1 ? "" : "s"}
                    </Badge>
                  )}
                </Button>
                <Button
                  onClick={() => setBulkGenOpen(true)}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={!eventDetailQuery.data?.certEnabled}
                >
                  <Award className="size-4" />
                  Generate Certificates
                </Button>
                <Button
                  variant="outline"
                  onClick={() => cleanupMutation.mutate()}
                  disabled={cleanupMutation.isPending}
                  className="bg-white dark:bg-slate-900"
                  title="Mark old IN_PROGRESS attempts as TIMEOUT (participants who started but never submitted)"
                >
                  {cleanupMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Cleanup Stale
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Filters + table */}
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Filter row */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className="pl-9"
                  />
                </div>
                <Select
                  value={resultStatusFilter}
                  onValueChange={(v) =>
                    setResultStatusFilter(v as typeof resultStatusFilter)
                  }
                >
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All result statuses</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={certStatusFilter}
                  onValueChange={(v) =>
                    setCertStatusFilter(v as typeof certStatusFilter)
                  }
                >
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All cert statuses</SelectItem>
                    <SelectItem value="GENERATED">Generated</SelectItem>
                    <SelectItem value="ELIGIBLE">Eligible</SelectItem>
                    <SelectItem value="NOT_ELIGIBLE">Not Eligible</SelectItem>
                    <SelectItem value="REVOKED">Revoked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filteredRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <Inbox className="size-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold">
                    {rows.length === 0
                      ? "No participants yet"
                      : "No participants match your filters"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {rows.length === 0
                      ? "Once participants submit attempts, they'll show up here."
                      : "Try clearing the search or status filters."}
                  </p>
                </div>
              ) : (
                <ParticipantsTable
                  rows={filteredRows}
                  event={eventDetailQuery.data}
                  onSelectRow={(r) => setSelectedRow(r)}
                  onPublish={(row) => {
                    if (row.attempt) {
                      publishMutation.mutate({ attemptId: row.attempt.id })
                    }
                  }}
                  onUnpublish={(row) => {
                    if (row.attempt) {
                      unpublishMutation.mutate({ attemptId: row.attempt.id })
                    }
                  }}
                  onGenerate={(row) => handleGenerateForRow(row)}
                  onRevoke={(cert) => {
                    setRevokeTarget(cert)
                  }}
                  onReinstate={(certId) => reinstateMutation.mutate(certId)}
                  pendingPublishId={
                    publishMutation.isPending
                      ? publishMutation.variables?.attemptId
                      : undefined
                  }
                  pendingUnpublishId={
                    unpublishMutation.isPending
                      ? unpublishMutation.variables?.attemptId
                      : undefined
                  }
                  pendingGenerateId={
                    generateSingleMutation.isPending
                      ? generateSingleMutation.variables?.userId
                      : undefined
                  }
                  pendingRevokeId={
                    revokeMutation.isPending ? revokeTarget?.id : undefined
                  }
                  pendingReinstateId={
                    reinstateMutation.isPending
                      ? reinstateMutation.variables
                      : undefined
                  }
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Detail sheet (right drawer) */}
      <ParticipantDetailSheet
        row={selectedRow}
        event={eventDetailQuery.data}
        open={!!selectedRow}
        onOpenChange={(o) => !o && setSelectedRow(null)}
        onPublish={(row) => row.attempt && publishMutation.mutate({ attemptId: row.attempt.id })}
        onUnpublish={(row) =>
          row.attempt && unpublishMutation.mutate({ attemptId: row.attempt.id })
        }
        onGenerate={(row) => handleGenerateForRow(row)}
        onRevoke={(cert) => setRevokeTarget(cert)}
        onReinstate={(certId) => reinstateMutation.mutate(certId)}
        pendingPublishId={
          publishMutation.isPending
            ? publishMutation.variables?.attemptId
            : undefined
        }
        pendingGenerateId={
          generateSingleMutation.isPending
            ? generateSingleMutation.variables?.userId
            : undefined
        }
      />

      {/* Bulk generate dialog */}
      <BulkGenerateDialog
        open={bulkGenOpen}
        onOpenChange={setBulkGenOpen}
        event={eventDetailQuery.data}
        rows={rows}
      />

      {/* Manual override warning dialog */}
      <OverrideWarningDialog
        row={overrideTarget}
        event={eventDetailQuery.data}
        pending={generateSingleMutation.isPending}
        onCancel={() => setOverrideTarget(null)}
        onConfirm={handleConfirmOverride}
      />

      {/* Revoke dialog */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRevokeTarget(null)
            setRevokeReason("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke certificate?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  This will mark{" "}
                  <span className="font-medium text-foreground">
                    {revokeTarget?.recipientName}
                  </span>
                  &apos;s certificate (
                  <span className="font-mono text-xs">
                    {revokeTarget?.certificateNumber}
                  </span>
                  ) as <span className="font-medium text-rose-600">REVOKED</span>. The public
                  verification page will show it as invalid. You can reinstate it at any
                  time.
                </p>
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="revoke-reason" className="text-xs">
                    Reason (optional)
                  </Label>
                  <Input
                    id="revoke-reason"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    maxLength={500}
                    placeholder="e.g. Issued in error / Academic dishonesty"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-600"
              onClick={(e) => {
                e.preventDefault()
                if (revokeTarget) {
                  revokeMutation.mutate({
                    id: revokeTarget.id,
                    reason: revokeReason.trim() || undefined,
                  })
                }
              }}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldBan className="size-4" />
              )}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getResultStatus(row: ParticipantRow): "PUBLISHED" | "PENDING" | "IN_PROGRESS" {
  const a = row.attempt
  if (!a) return "IN_PROGRESS"
  if (a.status === "IN_PROGRESS") return "IN_PROGRESS"
  // Terminal status (COMPLETED / TIMEOUT / CHEAT_DETECTED).
  const isPublished = a.published ?? !!a.publishedAt
  return isPublished ? "PUBLISHED" : "PENDING"
}

function getCertStatus(
  row: ParticipantRow,
  event?: EventDto,
): {
  status: "GENERATED" | "ELIGIBLE" | "NOT_ELIGIBLE" | "REVOKED"
  reason?: string
} {
  const c = row.certificate
  if (c) {
    if (c.status === "REVOKED") return { status: "REVOKED" }
    return { status: "GENERATED" }
  }
  // No cert yet — check eligibility based on the event's condition.
  const a = row.attempt
  if (!event || !a) {
    return { status: "NOT_ELIGIBLE", reason: "No attempt yet" }
  }
  const condition = event.certIssueCondition
  const passingScore = event.certPassingScore ?? 60
  const isTerminal =
    a.status === "COMPLETED" || a.status === "TIMEOUT" || a.status === "CHEAT_DETECTED"
  if (condition === "PARTICIPATION") {
    // Registered = eligible (we only have rows for users with attempts, so
    // they've at least started — treat as eligible).
    return { status: "ELIGIBLE" }
  }
  if (!isTerminal) {
    return { status: "NOT_ELIGIBLE", reason: "No completed attempt yet" }
  }
  if (condition === "COMPLETED") {
    return { status: "ELIGIBLE" }
  }
  // PASSED
  if (a.passed === true && a.percentage != null && a.percentage >= passingScore) {
    return { status: "ELIGIBLE" }
  }
  return {
    status: "NOT_ELIGIBLE",
    reason: `Score ${a.percentage ?? 0}% < required ${passingScore}%`,
  }
}

function scoreColor(percentage: number | null): string {
  if (percentage == null) return "text-slate-500 dark:text-slate-400"
  if (percentage >= 75) return "text-emerald-600 dark:text-emerald-400"
  if (percentage >= 50) return "text-amber-600 dark:text-amber-400"
  if (percentage >= 35) return "text-orange-600 dark:text-orange-400"
  return "text-rose-600 dark:text-rose-400"
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  icon: LucideIcon
  accent: "emerald" | "amber" | "slate"
}) {
  const accentClasses = {
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300",
  }[accent]
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            accentClasses,
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyEventState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <BarChart3 className="size-7" />
        </div>
        <p className="mt-4 text-lg font-semibold">Select an event</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          Pick an event from the dropdown above to see its participants&apos;
          results + certificate status.
        </p>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Card>
        <CardContent className="space-y-2 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Participants table (responsive: table on desktop, cards on mobile)
// ---------------------------------------------------------------------------

interface ParticipantsTableProps {
  rows: ParticipantRow[]
  event?: EventDto
  onSelectRow: (row: ParticipantRow) => void
  onPublish: (row: ParticipantRow) => void
  onUnpublish: (row: ParticipantRow) => void
  onGenerate: (row: ParticipantRow) => void
  onRevoke: (cert: CertificateDto) => void
  onReinstate: (certId: string) => void
  pendingPublishId?: string
  pendingUnpublishId?: string
  pendingGenerateId?: string
  pendingRevokeId?: string
  pendingReinstateId?: string
}

function ParticipantsTable(props: ParticipantsTableProps) {
  const {
    rows,
    event,
    onSelectRow,
    onPublish,
    onUnpublish,
    onGenerate,
    onRevoke,
    onReinstate,
    pendingPublishId,
    pendingUnpublishId,
    pendingGenerateId,
    pendingRevokeId,
    pendingReinstateId,
  } = props

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto -mx-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participant</TableHead>
              <TableHead className="w-[100px]">Score</TableHead>
              <TableHead className="w-[120px]">Result</TableHead>
              <TableHead className="w-[180px]">Certificate</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const a = r.attempt
              const rs = getResultStatus(r)
              const cs = getCertStatus(r, event)
              return (
                <TableRow
                  key={r.userId}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onSelectRow(r)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8 shrink-0">
                        {r.userImage ? (
                          <AvatarImage src={r.userImage} alt={r.userName} />
                        ) : null}
                        <AvatarFallback className="bg-emerald-50 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          {initials(r.userName) || r.userEmail[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {r.userName || "Unnamed participant"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.userEmail || "—"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {a?.percentage != null ? (
                      <span className={cn("text-sm font-semibold tabular-nums", scoreColor(a.percentage))}>
                        {a.percentage}%
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    {a?.score != null && a.totalMarks != null && (
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {a.score}/{a.totalMarks}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <ResultStatusBadge status={rs} />
                  </TableCell>
                  <TableCell>
                    <CertStatusBadge
                      row={r}
                      status={cs.status}
                    />
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowActions
                      row={r}
                      rs={rs}
                      cs={cs}
                      onView={() => onSelectRow(r)}
                      onPublish={() => onPublish(r)}
                      onUnpublish={() => onUnpublish(r)}
                      onGenerate={() => onGenerate(r)}
                      onRevoke={() => r.certificate && onRevoke(r.certificate)}
                      onReinstate={() => r.certificate && onReinstate(r.certificate.id)}
                      pendingPublish={pendingPublishId === r.attempt?.id}
                      pendingUnpublish={pendingUnpublishId === r.attempt?.id}
                      pendingGenerate={pendingGenerateId === r.userId}
                      pendingRevoke={pendingRevokeId === r.certificate?.id}
                      pendingReinstate={pendingReinstateId === r.certificate?.id}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {rows.map((r) => {
          const a = r.attempt
          const rs = getResultStatus(r)
          const cs = getCertStatus(r, event)
          return (
            <Card key={r.userId}>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectRow(r)}
                    className="flex items-center gap-2.5 min-w-0 text-left"
                  >
                    <Avatar className="size-9 shrink-0">
                      {r.userImage ? (
                        <AvatarImage src={r.userImage} alt={r.userName} />
                      ) : null}
                      <AvatarFallback className="bg-emerald-50 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                        {initials(r.userName) || r.userEmail[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {r.userName || "Unnamed participant"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.userEmail || "—"}
                      </p>
                    </div>
                  </button>
                  {a?.percentage != null && (
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        scoreColor(a.percentage),
                      )}
                    >
                      {a.percentage}%
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ResultStatusBadge status={rs} />
                  <CertStatusBadge row={r} status={cs.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectRow(r)}
                  >
                    <Eye className="size-3.5" /> View
                  </Button>
                  {rs === "PENDING" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPublish(r)}
                      disabled={pendingPublishId === r.attempt?.id}
                    >
                      {pendingPublishId === r.attempt?.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Megaphone className="size-3.5" />
                      )}
                      Publish
                    </Button>
                  )}
                  {cs.status === "ELIGIBLE" && (
                    <Button
                      size="sm"
                      onClick={() => onGenerate(r)}
                      disabled={pendingGenerateId === r.userId}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {pendingGenerateId === r.userId ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Award className="size-3.5" />
                      )}
                      Generate
                    </Button>
                  )}
                  {cs.status === "NOT_ELIGIBLE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onGenerate(r)}
                      disabled={pendingGenerateId === r.userId}
                    >
                      {pendingGenerateId === r.userId ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      Generate Anyway
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}

function ResultStatusBadge({ status }: { status: "PUBLISHED" | "PENDING" | "IN_PROGRESS" }) {
  const meta = RESULT_STATUS_META[status]
  return (
    <Badge variant="outline" className={cn("ring-1 font-normal", meta.className)}>
      {status === "PUBLISHED" && <CheckCircle2 className="size-3" />}
      {status === "PENDING" && <Clock className="size-3" />}
      {status === "IN_PROGRESS" && <Loader2 className="size-3" />}
      {meta.label}
    </Badge>
  )
}

function CertStatusBadge({
  row,
  status,
}: {
  row: ParticipantRow
  status: "GENERATED" | "ELIGIBLE" | "NOT_ELIGIBLE" | "REVOKED"
}) {
  if (status === "GENERATED") {
    return (
      <div className="flex flex-col gap-1">
        <Badge
          variant="outline"
          className="ring-1 bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30"
        >
          <Award className="size-3" />
          Generated
        </Badge>
        {row.certificate && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {row.certificate.certificateNumber}
          </span>
        )}
      </div>
    )
  }
  if (status === "ELIGIBLE") {
    return (
      <Badge
        variant="outline"
        className="ring-1 bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30"
      >
        <Sparkles className="size-3" />
        Eligible
      </Badge>
    )
  }
  if (status === "REVOKED") {
    return (
      <Badge
        variant="outline"
        className="ring-1 bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30"
      >
        <ShieldBan className="size-3" />
        Revoked
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="ring-1 bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30"
    >
      Not Eligible
    </Badge>
  )
}

interface RowActionsProps {
  row: ParticipantRow
  rs: "PUBLISHED" | "PENDING" | "IN_PROGRESS"
  cs: { status: "GENERATED" | "ELIGIBLE" | "NOT_ELIGIBLE" | "REVOKED"; reason?: string }
  onView: () => void
  onPublish: () => void
  onUnpublish: () => void
  onGenerate: () => void
  onRevoke: () => void
  onReinstate: () => void
  pendingPublish?: boolean
  pendingUnpublish?: boolean
  pendingGenerate?: boolean
  pendingRevoke?: boolean
  pendingReinstate?: boolean
}

function RowActions(props: RowActionsProps) {
  const {
    rs,
    cs,
    onView,
    onPublish,
    onUnpublish,
    onGenerate,
    onRevoke,
    onReinstate,
    pendingPublish,
    pendingUnpublish,
    pendingGenerate,
    pendingRevoke,
    pendingReinstate,
  } = props

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <ChevronDown className="size-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <Eye className="size-4" /> View details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {rs === "PENDING" && (
          <DropdownMenuItem
            onClick={onPublish}
            disabled={pendingPublish}
          >
            {pendingPublish ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Megaphone className="size-4" />
            )}
            Publish result
          </DropdownMenuItem>
        )}
        {rs === "PUBLISHED" && (
          <DropdownMenuItem
            onClick={onUnpublish}
            disabled={pendingUnpublish}
          >
            {pendingUnpublish ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Unpublish result
          </DropdownMenuItem>
        )}
        {rs === "PUBLISHED" && (
          <DropdownMenuItem>
            <Mail className="size-4" /> Resend email
          </DropdownMenuItem>
        )}
        {cs.status === "ELIGIBLE" && (
          <DropdownMenuItem
            onClick={onGenerate}
            disabled={pendingGenerate}
            className="text-emerald-700 focus:text-emerald-700"
          >
            {pendingGenerate ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Award className="size-4" />
            )}
            Generate certificate
          </DropdownMenuItem>
        )}
        {cs.status === "NOT_ELIGIBLE" && (
          <DropdownMenuItem
            onClick={onGenerate}
            disabled={pendingGenerate}
            className="text-amber-700 focus:text-amber-700"
          >
            {pendingGenerate ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Generate anyway…
          </DropdownMenuItem>
        )}
        {cs.status === "GENERATED" && (
          <>
            <DropdownMenuItem onClick={onView}>
              <Eye className="size-4" /> View certificate
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onRevoke}
              disabled={pendingRevoke}
              className="text-rose-600 focus:text-rose-700"
            >
              {pendingRevoke ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldBan className="size-4" />
              )}
              Revoke certificate
            </DropdownMenuItem>
          </>
        )}
        {cs.status === "REVOKED" && (
          <DropdownMenuItem
            onClick={onReinstate}
            disabled={pendingReinstate}
            className="text-emerald-700 focus:text-emerald-700"
          >
            {pendingReinstate ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Reinstate certificate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// Participant detail sheet (right drawer)
// ---------------------------------------------------------------------------

interface ParticipantDetailSheetProps {
  row: ParticipantRow | null
  event?: EventDto
  open: boolean
  onOpenChange: (open: boolean) => void
  onPublish: (row: ParticipantRow) => void
  onUnpublish: (row: ParticipantRow) => void
  onGenerate: (row: ParticipantRow) => void
  onRevoke: (cert: CertificateDto) => void
  onReinstate: (certId: string) => void
  pendingPublishId?: string
  pendingGenerateId?: string
}

function ParticipantDetailSheet(props: ParticipantDetailSheetProps) {
  const { row, event, open, onOpenChange } = props
  if (!row) return null
  const a = row.attempt
  const rs = getResultStatus(row)
  const cs = getCertStatus(row, event)
  const cert = row.certificate

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2.5">
            <Avatar className="size-9">
              {row.userImage ? (
                <AvatarImage src={row.userImage} alt={row.userName} />
              ) : null}
              <AvatarFallback className="bg-emerald-50 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                {initials(row.userName) || row.userEmail[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">
                {row.userName || "Unnamed participant"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {row.userEmail}
              </p>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Detailed view of the participant&apos;s attempt, result, certificate,
            and timeline.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 px-4 pb-8">
          {/* Quick status badges */}
          <div className="flex flex-wrap items-center gap-2">
            <ResultStatusBadge status={rs} />
            <CertStatusBadge row={row} status={cs.status} />
            {a?.percentage != null && (
              <Badge variant="outline" className="font-normal">
                Score:{" "}
                <span className={cn("font-semibold ml-1", scoreColor(a.percentage))}>
                  {a.percentage}%
                </span>
              </Badge>
            )}
            {a?.passed != null && (
              <Badge
                variant="outline"
                className={
                  a.passed
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
                    : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30"
                }
              >
                {a.passed ? "Passed" : "Failed"}
              </Badge>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {rs === "PENDING" && (
              <Button
                size="sm"
                onClick={() => props.onPublish(row)}
                disabled={props.pendingPublishId === a?.id}
              >
                {props.pendingPublishId === a?.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Megaphone className="size-3.5" />
                )}
                Publish result
              </Button>
            )}
            {rs === "PUBLISHED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => props.onUnpublish(row)}
              >
                <RotateCcw className="size-3.5" />
                Unpublish result
              </Button>
            )}
            {cs.status === "ELIGIBLE" && (
              <Button
                size="sm"
                onClick={() => props.onGenerate(row)}
                disabled={props.pendingGenerateId === row.userId}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {props.pendingGenerateId === row.userId ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Award className="size-3.5" />
                )}
                Generate certificate
              </Button>
            )}
            {cs.status === "NOT_ELIGIBLE" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => props.onGenerate(row)}
                disabled={props.pendingGenerateId === row.userId}
                className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-400"
              >
                {props.pendingGenerateId === row.userId ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Generate anyway…
              </Button>
            )}
            {cs.status === "GENERATED" && cert && (
              <Button
                size="sm"
                variant="outline"
                className="text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-500/30"
                onClick={() => props.onRevoke(cert)}
              >
                <ShieldBan className="size-3.5" />
                Revoke certificate
              </Button>
            )}
            {cs.status === "REVOKED" && cert && (
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/30"
                onClick={() => props.onReinstate(cert.id)}
              >
                <RotateCcw className="size-3.5" />
                Reinstate certificate
              </Button>
            )}
          </div>

          {/* Attempt details */}
          {a && (
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Attempt details
              </h4>
              <Card>
                <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm">
                  <DetailField label="Status" value={a.status} />
                  <DetailField
                    label="Score"
                    value={
                      a.percentage != null
                        ? `${a.percentage}% (${a.score ?? 0}/${a.totalMarks ?? 0})`
                        : "—"
                    }
                  />
                  <DetailField
                    label="Started"
                    value={formatDateTime(a.startedAt)}
                  />
                  <DetailField
                    label="Completed"
                    value={a.completedAt ? formatDateTime(a.completedAt) : "—"}
                  />
                  <DetailField
                    label="Time taken"
                    value={a.timeTaken ? formatDuration(a.timeTaken) : "—"}
                  />
                  <DetailField
                    label="Published"
                    value={
                      a.publishedAt ? formatDateTime(a.publishedAt) : "Not published"
                    }
                  />
                </CardContent>
              </Card>

              {/* Anti-cheat metrics */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5" /> Anti-cheat metrics
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <MetricCell label="Tab switches" value={a.tabSwitches} />
                    <MetricCell label="Fullscreen exits" value={a.fullscreenExits} />
                    <MetricCell label="Copy attempts" value={a.copyAttempts} />
                    <MetricCell label="Right clicks" value={a.rightClicks} />
                    <MetricCell label="DevTools open" value={a.devtoolsOpen} warn={a.devtoolsOpen > 0} />
                    <MetricCell label="Screenshots" value={a.screenshotAttempts} warn={a.screenshotAttempts > 0} />
                    <MetricCell label="Keyboard viol." value={a.keyboardViolations} warn={a.keyboardViolations > 0} />
                    <MetricCell label="Face not detected" value={a.faceNotDetected} warn={a.faceNotDetected > 0} />
                    <MetricCell label="Multi-face alerts" value={a.multiFaceAlerts} warn={a.multiFaceAlerts > 0} />
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Certificate details */}
          {cert && (
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Certificate
              </h4>
              <Card>
                <CardContent className="space-y-3 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        cert.status === "VALID"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
                          : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30"
                      }
                    >
                      <Award className="size-3" />
                      {cert.status === "VALID" ? "Valid" : "Revoked"}
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      {TEMPLATE_LABEL[cert.template] ?? cert.template} template
                    </Badge>
                    {cert.manualOverride && (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"
                      >
                        <AlertTriangle className="size-3" /> Manual override
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailField label="Cert number" value={cert.certificateNumber} mono />
                    <DetailField label="Issued" value={formatDateTime(cert.issuedAt)} />
                    <DetailField
                      label="Issued by"
                      value={cert.issuedBy ? "Admin" : cert.generatedAutomatically ? "Auto" : "—"}
                    />
                    <DetailField
                      label="Eligibility"
                      value={cert.eligibilityType}
                    />
                    {cert.revokedAt && (
                      <DetailField label="Revoked at" value={formatDateTime(cert.revokedAt)} />
                    )}
                    {cert.revocationReason && (
                      <DetailField label="Reason" value={cert.revocationReason} />
                    )}
                  </div>
                  <CertificatePreview cert={cert} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        window.open(`/verify/${cert.verificationToken}`, "_blank")
                      }
                    >
                      <ExternalLink className="size-3.5" />
                      Public verify page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Participant timeline */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Participant timeline
            </h4>
            <Timeline row={row} event={event} />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-sm text-foreground truncate",
          mono && "font-mono text-xs",
        )}
      >
        {value || "—"}
      </p>
    </div>
  )
}

function MetricCell({
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
        "rounded-md px-2 py-1.5 border",
        warn
          ? "border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5"
          : "border-slate-200 bg-slate-50/40 dark:border-slate-700 dark:bg-slate-500/5",
      )}
    >
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          warn ? "text-amber-700 dark:text-amber-400" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Participant timeline (vertical stepper)
// ---------------------------------------------------------------------------

interface TimelineStep {
  label: string
  state: "done" | "pending" | "not_reached" | "skipped"
  detail?: string
}

function Timeline({ row, event }: { row: ParticipantRow; event?: EventDto }) {
  const a = row.attempt
  const cert = row.certificate

  // Determine step states.
  const registered = true // we only have rows for users with attempts/certs
  const requiresPayment =
    !!event?.paymentMethod && event.paymentMethod !== "FREE"
  const submitted = !!a && a.status !== "IN_PROGRESS"
  const isTerminal =
    !!a &&
    (a.status === "COMPLETED" || a.status === "TIMEOUT" || a.status === "CHEAT_DETECTED")
  const published = !!(a?.published ?? a?.publishedAt)
  const hasCert = !!cert
  const certRevoked = cert?.status === "REVOKED"

  const cs = getCertStatus(row, event)
  const certEligible = cs.status === "ELIGIBLE" || cs.status === "GENERATED"

  const steps: TimelineStep[] = [
    {
      label: "Registered",
      state: registered ? "done" : "pending",
      detail: a ? format(parseISO(a.startedAt), "MMM d, yyyy") : "—",
    },
  ]

  if (requiresPayment) {
    // We don't have direct access to the registration's payment status here.
    // The timeline step is conservative: "pending" until the attempt was
    // submitted (which is what payment gates).
    steps.push({
      label: "Payment completed",
      state: submitted ? "done" : "pending",
      detail: submitted ? "Verified" : "Pending",
    })
  }

  steps.push({
    label: "Assessment submitted",
    state: submitted ? "done" : isTerminal ? "done" : "pending",
    detail: a?.completedAt
      ? format(parseISO(a.completedAt), "MMM d, yyyy · HH:mm")
      : a
      ? "In progress"
      : "Not started",
  })

  steps.push({
    label: "Result published",
    state: published
      ? "done"
      : submitted
      ? "pending"
      : "not_reached",
    detail: a?.publishedAt
      ? format(parseISO(a.publishedAt), "MMM d, yyyy · HH:mm")
      : submitted
      ? "Pending — publish from the actions menu"
      : "Not yet reached",
  })

  steps.push({
    label: "Certificate issued",
    state: hasCert
      ? certRevoked
        ? "skipped"
        : "done"
      : certEligible && submitted
      ? "pending"
      : "not_reached",
    detail: cert
      ? `${format(parseISO(cert.issuedAt), "MMM d, yyyy")} · ${cert.certificateNumber}${
          cert.manualOverride ? " (manual override)" : ""
        }`
      : certEligible && submitted
      ? "Eligible — generate from the actions menu"
      : "Not eligible",
  })

  return (
    <ol className="relative space-y-4 pl-7">
      {/* vertical line */}
      <span
        aria-hidden
        className="absolute left-[10px] top-1.5 bottom-1.5 w-px bg-slate-200 dark:bg-slate-700"
      />
      {steps.map((s, i) => (
        <li key={i} className="relative">
          {/* circle */}
          <span
            className={cn(
              "absolute -left-7 top-0.5 grid size-5 place-items-center rounded-full border-2 bg-white dark:bg-slate-900",
              s.state === "done" &&
                "border-emerald-500 bg-emerald-500 text-white",
              s.state === "pending" &&
                "border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
              s.state === "not_reached" &&
                "border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500",
              s.state === "skipped" &&
                "border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400",
            )}
          >
            {s.state === "done" && <CheckCircle2 className="size-3" />}
            {s.state === "pending" && <Clock className="size-2.5" />}
            {s.state === "skipped" && <XCircle className="size-3" />}
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-medium",
                s.state === "not_reached" && "text-muted-foreground",
              )}
            >
              {s.label}
            </p>
            {s.detail && (
              <p
                className={cn(
                  "text-xs text-muted-foreground",
                  s.state === "pending" &&
                    "text-amber-700 dark:text-amber-400",
                )}
              >
                {s.detail}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// Certificate preview (canvas renderer + download button)
// ---------------------------------------------------------------------------

function CertificatePreview({ cert }: { cert: CertificateDto }) {
  const [renderedDataUrl, setRenderedDataUrl] = React.useState<string | null>(null)
  const [renderTrigger, setRenderTrigger] = React.useState(0)

  const handleRendered = React.useCallback((dataUrl: string) => {
    setRenderedDataUrl(dataUrl)
  }, [])

  const handleDownload = () => {
    if (renderedDataUrl) {
      downloadCertificatePng(renderedDataUrl, cert.certificateNumber)
      return
    }
    // Force the renderer to mount by bumping the trigger.
    setRenderTrigger((n) => n + 1)
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-slate-100 p-2 dark:bg-slate-900">
        <CertificateRenderer
          key={`${cert.id}-${renderTrigger}`}
          template={cert.template}
          recipientName={cert.recipientName}
          eventName={cert.event?.title ?? "Untitled event"}
          orgName={cert.event?.certOrgName ?? null}
          signeeName={cert.event?.certSigneeName ?? null}
          signeeTitle={cert.event?.certSigneeTitle ?? null}
          signeeImage={cert.event?.certSigneeImage ?? null}
          logo={cert.event?.certLogo ?? null}
          certificateNumber={cert.certificateNumber}
          issuedAt={cert.issuedAt}
          verificationUrl={
            typeof window !== "undefined"
              ? `${window.location.origin}/verify/${cert.verificationToken}`
              : `/verify/${cert.verificationToken}`
          }
          onRendered={handleRendered}
          className="h-auto w-full"
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleDownload}
        disabled={!renderedDataUrl && renderTrigger === 0}
      >
        <Download className="size-3.5" />
        Download PNG
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bulk generate dialog (participant picker)
// ---------------------------------------------------------------------------

interface BulkGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: EventDto
  rows: ParticipantRow[]
}

function BulkGenerateDialog({
  open,
  onOpenChange,
  event,
  rows,
}: BulkGenerateDialogProps) {
  const qc = useQueryClient()
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [confirming, setConfirming] = React.useState(false)

  const generateMutation = useMutation({
    mutationFn: (userIds: string[]) =>
      api<GenerateBulkResponse>("/api/certificates/generate", {
        method: "POST",
        body: JSON.stringify({
          userIds,
          eventId: event?.id ?? "",
        }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["certificates"] })
      qc.invalidateQueries({ queryKey: ["my-certificates"] })
      qc.invalidateQueries({ queryKey: ["events"] })
      toast.success(`Generated ${data.generated} certificate${data.generated === 1 ? "" : "s"}`)
      if (data.errors.length > 0) {
        toast.warning(`${data.errors.length} participant(s) were not eligible`, {
          description: data.errors
            .map((e) => `${e.userId.slice(0, 8)}…: ${e.error}`)
            .slice(0, 3)
            .join("\n"),
        })
      }
      onOpenChange(false)
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Failed to generate"),
  })

  React.useEffect(() => {
    if (!open) {
      setSelected(new Set())
      setConfirming(false)
    }
  }, [open])

  if (!event) return null

  // Eligible rows = users without a cert yet, where cert status is ELIGIBLE.
  const eligibleRows = rows.filter((r) => {
    if (r.certificate) return false
    const cs = getCertStatus(r, event)
    return cs.status === "ELIGIBLE"
  })

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === eligibleRows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(eligibleRows.map((r) => r.userId)))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="size-4 text-emerald-600" />
            Generate Certificates
          </DialogTitle>
          <DialogDescription>
            Select eligible participants to issue certificates for{" "}
            <span className="font-medium text-foreground">{event.title}</span>.
            {event.certEnabled ? (
              <>
                {" "}
                Template:{" "}
                <span className="font-medium text-foreground">
                  {TEMPLATE_LABEL[event.certTemplate] ?? event.certTemplate}
                </span>
                . Condition:{" "}
                <span className="font-medium text-foreground">
                  {event.certIssueCondition}
                </span>
                .
              </>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">
                {" "}— Certificates are not enabled for this event.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!event.certEnabled ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-amber-300">
            Enable certificates in the Event settings before issuing.
          </div>
        ) : eligibleRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-emerald-300/60 bg-white/50 p-6 text-center text-sm text-muted-foreground dark:border-emerald-800/60 dark:bg-slate-900/40">
            <CheckCircle2 className="mx-auto mb-2 size-6 text-emerald-500" />
            No eligible participants without certificates. Everyone who is
            eligible already has a certificate, or no one has met the issue
            condition yet.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={
                    eligibleRows.length > 0 &&
                    selected.size === eligibleRows.length
                  }
                  onCheckedChange={toggleAll}
                  aria-label="Select all eligible participants"
                />
                <span className="text-muted-foreground">
                  Select all ({eligibleRows.length} eligible)
                </span>
              </label>
              <span className="text-xs text-muted-foreground">
                {selected.size} selected
              </span>
            </div>
            <Separator />
            <div className="max-h-72 overflow-y-auto rounded-lg border bg-white dark:bg-slate-900">
              {eligibleRows.map((r) => (
                <label
                  key={r.userId}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-muted/30",
                    selected.has(r.userId) &&
                      "bg-emerald-50/60 dark:bg-emerald-500/10",
                  )}
                >
                  <Checkbox
                    checked={selected.has(r.userId)}
                    onCheckedChange={() => toggle(r.userId)}
                    aria-label={`Select ${r.userName || r.userEmail}`}
                  />
                  <Avatar className="size-7">
                    {r.userImage ? (
                      <AvatarImage src={r.userImage} alt={r.userName} />
                    ) : null}
                    <AvatarFallback className="bg-emerald-50 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      {initials(r.userName) || r.userEmail[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.userName || "Unnamed participant"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.userEmail}
                    </p>
                  </div>
                  {r.attempt?.percentage != null && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {r.attempt.percentage}%
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              selected.size === 0 ||
              generateMutation.isPending ||
              !event.certEnabled ||
              eligibleRows.length === 0
            }
            onClick={() => setConfirming(true)}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Award className="size-4" />
            Generate ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Confirm */}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Generate certificates for {selected.size} participant
              {selected.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will issue {selected.size} certificate
              {selected.size === 1 ? "" : "s"} using the{" "}
              <span className="font-medium">
                {TEMPLATE_LABEL[event.certTemplate] ?? event.certTemplate}
              </span>{" "}
              template and the{" "}
              <span className="font-medium">{event.certIssueCondition}</span>{" "}
              eligibility condition. Ineligible participants (if any slip
              through) will be skipped with an error. This action is idempotent
              — re-running on already-certified participants is a no-op.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generateMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600"
              onClick={(e) => {
                e.preventDefault()
                generateMutation.mutate(Array.from(selected))
              }}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Award className="size-4" />
              )}
              Generate {selected.size} certificate
              {selected.size === 1 ? "" : "s"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Manual override warning dialog
// ---------------------------------------------------------------------------

function OverrideWarningDialog({
  row,
  event,
  pending,
  onCancel,
  onConfirm,
}: {
  row: ParticipantRow | null
  event?: EventDto
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!row) return null
  const score = row.attempt?.percentage ?? null
  const required = event?.certPassingScore ?? 60
  const cs = getCertStatus(row, event)
  return (
    <AlertDialog open={!!row} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" />
            Generate certificate anyway?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                <span className="font-medium text-foreground">
                  {row.userName || row.userEmail}
                </span>{" "}
                does not meet the automatic certificate eligibility criteria.
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs dark:border-amber-500/30 dark:bg-amber-500/5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Score
                  </p>
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      score != null ? scoreColor(score) : "",
                    )}
                  >
                    {score != null ? `${score}%` : "No score"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Required
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {required}%
                  </p>
                </div>
              </div>
              {cs.reason && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Reason: {cs.reason}
                </p>
              )}
              <p>
                The certificate will be flagged with{" "}
                <span className="font-medium">manualOverride: true</span> for
                audit. You can revoke it later if needed.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-600"
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Generate anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
