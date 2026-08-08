"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2,
  Clock,
  Eye,
  Inbox,
  Loader2,
  Mail,
  ReceiptIndianRupee,
  Search,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { cn, formatDateTime, initials } from "@/lib/utils"

import { api } from "./api"
import type { PaymentStatus, RegistrationDto } from "@/types"

// ----------------------------------------------------------------------------
// Types

type AdminPaymentDto = RegistrationDto & {
  event: {
    id: string
    title: string
    paymentAmount: number
    paymentCurrency: string
  }
}

interface PaymentsListResponse {
  payments: AdminPaymentDto[]
  total: number
}

interface ApproveResponse {
  success: boolean
  registration: RegistrationDto
}

interface RejectResponse {
  success: boolean
  registration: RegistrationDto
}

type StatusFilter = "PENDING_VERIFICATION" | "COMPLETED" | "REJECTED" | "ALL"

// ----------------------------------------------------------------------------
// Status metadata

const STATUS_META: Record<
  PaymentStatus,
  { label: string; className: string }
> = {
  NONE: {
    label: "None",
    className:
      "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  },
  PENDING_VERIFICATION: {
    label: "Pending",
    className:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
  },
  COMPLETED: {
    label: "Approved",
    className:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
  },
  REJECTED: {
    label: "Rejected",
    className:
      "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30",
  },
}

const FILTER_LABELS: Record<StatusFilter, string> = {
  PENDING_VERIFICATION: "Pending",
  COMPLETED: "Approved",
  REJECTED: "Rejected",
  ALL: "All",
}

function formatAmount(paise: number, currency: string): string {
  const r = (paise ?? 0) / 100
  const amountStr = Number.isInteger(r) ? String(r) : r.toFixed(2)
  if (currency === "INR") return `₹${amountStr}`
  return `${amountStr} ${currency}`
}

// ----------------------------------------------------------------------------
// Component

export function PaymentsPanel() {
  const qc = useQueryClient()

  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>(
    "PENDING_VERIFICATION",
  )
  const [eventIdFilter, setEventIdFilter] = React.useState<string>("")
  const [search, setSearch] = React.useState("")

  // Reject dialog state.
  const [rejectTarget, setRejectTarget] = React.useState<AdminPaymentDto | null>(null)
  const [rejectReason, setRejectReason] = React.useState("")
  const [rejectError, setRejectError] = React.useState<string | null>(null)

  // Screenshot preview dialog state.
  const [preview, setPreview] = React.useState<AdminPaymentDto | null>(null)

  // ---- Data -------------------------------------------------------------
  const queryKey = React.useMemo(
    () => ["admin-payments", statusFilter, eventIdFilter || null],
    [statusFilter, eventIdFilter],
  )

  const { data, isLoading, isError, error } = useQuery<PaymentsListResponse>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams()
      params.set("status", statusFilter)
      if (eventIdFilter) params.set("eventId", eventIdFilter)
      return api<PaymentsListResponse>(`/api/admin/payments?${params.toString()}`)
    },
    retry: false,
  })

  // Need the events list for the event filter dropdown — fetch as a separate
  // query (admin-only endpoint, already cached).
  const { data: eventsData } = useQuery<EventListItem[]>({
    queryKey: ["events"],
    queryFn: () => api<EventListItem[]>("/api/events"),
  })

  // ---- Mutations --------------------------------------------------------
  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      api<ApproveResponse>(`/api/admin/payments/${id}/approve`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payments"] })
      toast.success("Payment approved. Student can now take the quiz.")
    },
    onError: (e: Error) => toast.error(e.message || "Failed to approve."),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<RejectResponse>(`/api/admin/payments/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejectionReason: reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payments"] })
      toast.success("Payment rejected. Student will be asked to resubmit.")
      setRejectTarget(null)
      setRejectReason("")
      setRejectError(null)
    },
    onError: (e: Error) => {
      setRejectError(e.message || "Failed to reject.")
      toast.error(e.message || "Failed to reject.")
    },
  })

  // ---- Derived ----------------------------------------------------------
  const payments = data?.payments ?? []
  const filtered = React.useMemo(() => {
    if (!search.trim()) return payments
    const q = search.trim().toLowerCase()
    return payments.filter(
      (p) =>
        p.user?.name?.toLowerCase().includes(q) ||
        p.user?.email?.toLowerCase().includes(q) ||
        p.event?.title?.toLowerCase().includes(q) ||
        (p.transactionReference ?? "").toLowerCase().includes(q),
    )
  }, [payments, search])

  // ---- Handlers ---------------------------------------------------------
  const openReject = (p: AdminPaymentDto) => {
    setRejectTarget(p)
    setRejectReason("")
    setRejectError(null)
  }

  const submitReject = () => {
    if (!rejectTarget) return
    const reason = rejectReason.trim()
    if (!reason) {
      setRejectError("Please provide a reason for the rejection.")
      return
    }
    rejectMutation.mutate({ id: rejectTarget.id, reason })
  }

  // ---- Render -----------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Manual Payments</h2>
          <p className="text-sm text-muted-foreground">
            Verify manual UPI payment submissions from students.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[140px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FILTER_LABELS) as StatusFilter[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {FILTER_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={eventIdFilter || "__all"}
            onValueChange={(v) => setEventIdFilter(v === "__all" ? "" : v)}
          >
            <SelectTrigger className="w-[180px]" aria-label="Filter by event">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All events</SelectItem>
              {(eventsData ?? []).map((ev) => (
                <SelectItem key={ev.id} value={ev.id}>
                  {ev.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student, email, event, txn id…"
          className="pl-9"
        />
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card className="border-rose-200 dark:border-rose-500/30">
          <CardContent className="pt-6 text-sm text-rose-600 dark:text-rose-400">
            Failed to load payments: {(error as Error)?.message || "Unknown error"}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState statusFilter={statusFilter} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/60">
                    <TableHead className="w-[24%]">Student</TableHead>
                    <TableHead className="w-[18%]">Event</TableHead>
                    <TableHead className="w-[10%]">Amount</TableHead>
                    <TableHead className="w-[14%]">Transaction ID</TableHead>
                    <TableHead className="w-[8%]">Screenshot</TableHead>
                    <TableHead className="w-[8%]">Status</TableHead>
                    <TableHead className="w-[10%]">Submitted</TableHead>
                    <TableHead className="w-[8%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <PaymentRow
                      key={p.id}
                      payment={p}
                      onApprove={(id) => approveMutation.mutate(id)}
                      onReject={openReject}
                      onPreview={setPreview}
                      approvePending={
                        approveMutation.isPending &&
                        approveMutation.variables === p.id
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((p) => (
              <PaymentCard
                key={p.id}
                payment={p}
                onApprove={(id) => approveMutation.mutate(id)}
                onReject={openReject}
                onPreview={setPreview}
                approvePending={
                  approveMutation.isPending &&
                  approveMutation.variables === p.id
                }
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {payments.length} payment
            {payments.length === 1 ? "" : "s"}.
          </p>
        </>
      )}

      {/* Reject dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null)
            setRejectReason("")
            setRejectError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject payment?</DialogTitle>
            <DialogDescription>
              The student will see your reason and be able to resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason" className="text-sm font-medium">
              Rejection reason <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="reject-reason"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Screenshot is unclear — please re-upload a sharper image of the success page."
              maxLength={500}
            />
            {rejectError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {rejectError}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              {rejectReason.length}/500 characters.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null)
                setRejectReason("")
                setRejectError(null)
              }}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submitReject}
              disabled={rejectMutation.isPending}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Rejecting…
                </>
              ) : (
                <>
                  <XCircle className="size-4" /> Reject Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screenshot preview dialog */}
      <Dialog
        open={!!preview}
        onOpenChange={(o) => {
          if (!o) setPreview(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptIndianRupee className="size-4 text-emerald-600" />
              Payment screenshot
            </DialogTitle>
            <DialogDescription>
              {preview?.user?.name || preview?.user?.email || "Student"} —{" "}
              {preview?.event?.title}
            </DialogDescription>
          </DialogHeader>
          {preview?.screenshotUrl ? (
            <div className="flex justify-center">
              <img
                src={preview.screenshotUrl}
                alt="Payment screenshot"
                className="max-h-[70vh] w-auto max-w-full rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-muted-foreground">
              No screenshot uploaded.
            </div>
          )}
          {preview?.transactionReference && (
            <div className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900/60">
              <span className="text-muted-foreground">Transaction ID: </span>
              <span className="font-mono font-medium">
                {preview.transactionReference}
              </span>
            </div>
          )}
          <DialogFooter className="gap-2">
            {preview?.paymentStatus === "PENDING_VERIFICATION" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (preview) openReject(preview)
                    setPreview(null)
                  }}
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                >
                  <XCircle className="size-4" /> Reject
                </Button>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={
                    approveMutation.isPending &&
                    approveMutation.variables === preview?.id
                  }
                  onClick={() => {
                    if (preview) approveMutation.mutate(preview.id)
                    setPreview(null)
                  }}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Empty state

function EmptyState({ statusFilter }: { statusFilter: StatusFilter }) {
  return (
    <Card>
      <CardContent className="py-16 flex flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Inbox className="size-7" />
        </div>
        <p className="mt-4 text-lg font-semibold">
          {statusFilter === "PENDING_VERIFICATION"
            ? "No pending payments"
            : statusFilter === "ALL"
              ? "No payments yet"
              : `No ${FILTER_LABELS[statusFilter].toLowerCase()} payments`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          {statusFilter === "PENDING_VERIFICATION"
            ? "When students submit manual payments, they'll appear here for verification."
            : "Try a different filter or check back later."}
        </p>
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------------------
// Row (desktop)

interface RowProps {
  payment: AdminPaymentDto
  onApprove: (id: string) => void
  onReject: (p: AdminPaymentDto) => void
  onPreview: (p: AdminPaymentDto) => void
  approvePending: boolean
}

function PaymentRow({
  payment,
  onApprove,
  onReject,
  onPreview,
  approvePending,
}: RowProps) {
  const status = STATUS_META[payment.paymentStatus] || STATUS_META.NONE
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="size-8 shrink-0">
            {payment.user?.image ? (
              <AvatarImage src={payment.user.image} alt={payment.user.name || ""} />
            ) : null}
            <AvatarFallback className="bg-emerald-50 text-emerald-700 text-[10px] dark:bg-emerald-500/10 dark:text-emerald-400">
              {initials(payment.user?.name || payment.user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {payment.user?.name || "Unnamed"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {payment.user?.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm">{payment.event?.title}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm font-semibold tabular-nums">
          {formatAmount(payment.event?.paymentAmount ?? 0, payment.event?.paymentCurrency ?? "INR")}
        </span>
      </TableCell>
      <TableCell>
        {payment.transactionReference ? (
          <span className="font-mono text-xs">
            {payment.transactionReference}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {payment.screenshotUrl ? (
          <button
            type="button"
            onClick={() => onPreview(payment)}
            className="group relative inline-flex size-10 items-center justify-center overflow-hidden rounded-md border border-slate-200 dark:border-slate-700"
            aria-label="View screenshot"
          >
            <img
              src={payment.screenshotUrl}
              alt="Screenshot thumbnail"
              className="size-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Eye className="size-4 text-white" />
            </span>
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("ring-1", status.className)}>
          {payment.paymentStatus === "PENDING_VERIFICATION" && (
            <Clock className="size-3" />
          )}
          {payment.paymentStatus === "COMPLETED" && (
            <CheckCircle2 className="size-3" />
          )}
          {payment.paymentStatus === "REJECTED" && (
            <XCircle className="size-3" />
          )}
          {status.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-xs text-muted-foreground">
          {payment.paymentStatus === "PENDING_VERIFICATION"
            ? formatDateTime(payment.createdAt)
            : payment.verifiedAt
              ? formatDateTime(payment.verifiedAt)
              : formatDateTime(payment.createdAt)}
        </div>
      </TableCell>
      <TableCell className="text-right">
        {payment.paymentStatus === "PENDING_VERIFICATION" ? (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              onClick={() => onApprove(payment.id)}
              disabled={approvePending}
              className="h-8 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700"
            >
              {approvePending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReject(payment)}
              className="h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
            >
              <XCircle className="size-3.5" />
              Reject
            </Button>
          </div>
        ) : payment.paymentStatus === "REJECTED" && payment.rejectionReason ? (
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Reason:</p>
            <p
              className="max-w-[180px] truncate text-xs text-rose-600 dark:text-rose-400"
              title={payment.rejectionReason}
            >
              {payment.rejectionReason}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}

// ----------------------------------------------------------------------------
// Card (mobile)

function PaymentCard({
  payment,
  onApprove,
  onReject,
  onPreview,
  approvePending,
}: RowProps) {
  const status = STATUS_META[payment.paymentStatus] || STATUS_META.NONE
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Student */}
        <div className="flex items-start gap-3">
          <Avatar className="size-10 shrink-0">
            {payment.user?.image ? (
              <AvatarImage src={payment.user.image} alt={payment.user.name || ""} />
            ) : null}
            <AvatarFallback className="bg-emerald-50 text-emerald-700 text-xs dark:bg-emerald-500/10 dark:text-emerald-400">
              {initials(payment.user?.name || payment.user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {payment.user?.name || "Unnamed"}
            </p>
            <p className="truncate text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="size-3" />
              {payment.user?.email}
            </p>
          </div>
          <Badge variant="outline" className={cn("ring-1", status.className)}>
            {status.label}
          </Badge>
        </div>

        {/* Event + amount */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Event
            </p>
            <p className="truncate text-sm font-medium">{payment.event?.title}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Amount
            </p>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {formatAmount(payment.event?.paymentAmount ?? 0, payment.event?.paymentCurrency ?? "INR")}
            </p>
          </div>
        </div>

        {/* Txn + screenshot */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Transaction ID
            </p>
            <p className="font-mono">
              {payment.transactionReference || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Submitted
            </p>
            <p>
              {payment.paymentStatus === "PENDING_VERIFICATION"
                ? formatDateTime(payment.createdAt)
                : payment.verifiedAt
                  ? formatDateTime(payment.verifiedAt)
                  : formatDateTime(payment.createdAt)}
            </p>
          </div>
        </div>

        {payment.screenshotUrl && (
          <button
            type="button"
            onClick={() => onPreview(payment)}
            className="block w-full overflow-hidden rounded-md border border-slate-200 dark:border-slate-700"
          >
            <img
              src={payment.screenshotUrl}
              alt="Screenshot thumbnail"
              className="max-h-40 w-full object-cover"
            />
          </button>
        )}

        {payment.paymentStatus === "REJECTED" && payment.rejectionReason && (
          <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            <span className="font-medium">Rejection reason: </span>
            {payment.rejectionReason}
          </div>
        )}

        {payment.paymentStatus === "PENDING_VERIFICATION" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onApprove(payment.id)}
              disabled={approvePending}
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {approvePending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReject(payment)}
              className="flex-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
            >
              <XCircle className="size-4" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Minimal event list item shape (admin endpoint returns full EventDto).
interface EventListItem {
  id: string
  title: string
}
