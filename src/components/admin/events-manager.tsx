"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CalendarRange,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  FileQuestion,
  Link2,
  BarChart3,
  ImageOff,
  Inbox,
  ClipboardList,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn, formatDate, truncate } from "@/lib/utils"

import { api } from "./api"
import {
  PaymentConfig,
  type PaymentConfigValue,
} from "./payment-config"
import type { EventDto, PaymentMethod } from "@/types"

interface EventsManagerProps {
  onManageQuestions?: (eventId: string, eventTitle: string) => void
  onGenerateLink?: (eventId: string) => void
  onViewAnalytics?: (eventId: string) => void
  onManageRegistration?: (eventId: string, eventTitle: string) => void
  onViewRegistrations?: (eventId: string, eventTitle: string) => void
}

interface EventFormState {
  title: string
  description: string
  image: string
  startDate: string
  endDate: string
  isActive: boolean
  // Payment configuration (kept in form state so we can PATCH it back).
  paymentMethod: PaymentMethod
  paymentAmount: number // paise
  paymentCurrency: string
  paymentInstructions: string
  upiId: string
  upiLink: string
  qrCodeUrl: string
  requireTransactionRef: boolean
  requireScreenshot: boolean
}

const emptyForm: EventFormState = {
  title: "",
  description: "",
  image: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  isActive: true,
  paymentMethod: "FREE",
  paymentAmount: 0,
  paymentCurrency: "INR",
  paymentInstructions: "",
  upiId: "",
  upiLink: "",
  qrCodeUrl: "",
  requireTransactionRef: true,
  requireScreenshot: true,
}

export function EventsManager({
  onManageQuestions,
  onGenerateLink,
  onViewAnalytics,
  onManageRegistration,
  onViewRegistrations,
}: EventsManagerProps) {
  const qc = useQueryClient()
  const { data, isLoading, isError, error } = useQuery<EventDto[]>({
    queryKey: ["events"],
    queryFn: () => api<EventDto[]>("/api/events"),
  })

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<EventDto | null>(null)
  const [form, setForm] = React.useState<EventFormState>(emptyForm)
  const [errors, setErrors] = React.useState<Partial<Record<keyof EventFormState, string>>>({})

  const [deleteTarget, setDeleteTarget] = React.useState<EventDto | null>(null)

  const createMutation = useMutation({
    mutationFn: (payload: EventFormState) =>
      api<EventDto>("/api/events", {
        method: "POST",
        body: JSON.stringify({
          title: payload.title,
          description: payload.description,
          image: payload.image || null,
          startDate: new Date(payload.startDate).toISOString(),
          endDate: new Date(payload.endDate).toISOString(),
          isActive: payload.isActive,
          // Payment config
          paymentMethod: payload.paymentMethod,
          paymentAmount: payload.paymentAmount,
          paymentCurrency: payload.paymentCurrency,
          paymentInstructions: payload.paymentInstructions || null,
          upiId: payload.upiId || null,
          upiLink: payload.upiLink || null,
          qrCodeUrl: payload.qrCodeUrl || null,
          requireTransactionRef: payload.requireTransactionRef,
          requireScreenshot: payload.requireScreenshot,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] })
      qc.invalidateQueries({ queryKey: ["analytics"] })
      toast.success("Event created")
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error("Failed to create event: " + e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EventFormState }) =>
      api<EventDto>(`/api/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: payload.title,
          description: payload.description,
          image: payload.image || null,
          startDate: new Date(payload.startDate).toISOString(),
          endDate: new Date(payload.endDate).toISOString(),
          isActive: payload.isActive,
          // Payment config (always sent so a switch from MANUAL → FREE clears
          // UPI fields back to null server-side).
          paymentMethod: payload.paymentMethod,
          paymentAmount: payload.paymentAmount,
          paymentCurrency: payload.paymentCurrency,
          paymentInstructions: payload.paymentInstructions || null,
          upiId: payload.upiId || null,
          upiLink: payload.upiLink || null,
          qrCodeUrl: payload.qrCodeUrl || null,
          requireTransactionRef: payload.requireTransactionRef,
          requireScreenshot: payload.requireScreenshot,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] })
      qc.invalidateQueries({ queryKey: ["analytics"] })
      toast.success("Event updated")
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error("Failed to update event: " + e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/events/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] })
      qc.invalidateQueries({ queryKey: ["analytics"] })
      qc.invalidateQueries({ queryKey: ["quiz-links"] })
      toast.success("Event deleted")
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error("Failed to delete event: " + e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setErrors({})
    setDialogOpen(true)
  }

  function openEdit(ev: EventDto) {
    setEditing(ev)
    setForm({
      title: ev.title,
      description: ev.description,
      image: ev.image || "",
      startDate: (ev.startDate || "").slice(0, 10),
      endDate: (ev.endDate || "").slice(0, 10),
      isActive: ev.isActive,
      // Hydrate payment config from the event DTO (defaults to FREE/empty).
      paymentMethod: ev.paymentMethod ?? "FREE",
      paymentAmount: ev.paymentAmount ?? 0,
      paymentCurrency: ev.paymentCurrency ?? "INR",
      paymentInstructions: ev.paymentInstructions ?? "",
      upiId: ev.upiId ?? "",
      upiLink: ev.upiLink ?? "",
      qrCodeUrl: ev.qrCodeUrl ?? "",
      requireTransactionRef: ev.requireTransactionRef ?? true,
      requireScreenshot: ev.requireScreenshot ?? true,
    })
    setErrors({})
    setDialogOpen(true)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof EventFormState, string>> = {}
    if (!form.title.trim()) e.title = "Title is required"
    else if (form.title.length > 120) e.title = "Title too long"
    if (!form.description.trim()) e.description = "Description is required"
    if (!form.startDate) e.startDate = "Start date required"
    if (!form.endDate) e.endDate = "End date required"
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      e.endDate = "End date must be after start date"
    }
    if (form.image && !/^https?:\/\//.test(form.image)) {
      e.image = "Image must be a URL"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function submit() {
    if (!validate()) return
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const events = data || []

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Events</h2>
          <p className="text-sm text-muted-foreground">
            Manage quiz events, dates, and activation status.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="size-4" />
          Create Event
        </Button>
      </div>

      {isError && (
        <Card className="border-rose-200 dark:border-rose-500/30">
          <CardContent className="pt-6 text-sm text-rose-600 dark:text-rose-400">
            Failed to load events: {(error as Error)?.message || "Unknown error"}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Inbox className="size-7" />
            </div>
            <p className="mt-4 text-lg font-semibold">No events yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Create your first quiz event to start adding questions and sharing links with students.
            </p>
            <Button
              className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={openCreate}
            >
              <Plus className="size-4" />
              Create Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((ev) => (
            <Card key={ev.id} className="overflow-hidden hover:shadow-md transition-shadow flex flex-col">
              {ev.image ? (
                <img
                  src={ev.image}
                  alt={ev.title}
                  className="h-32 w-full object-cover bg-muted"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = "none"
                  }}
                />
              ) : (
                <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-300 dark:from-emerald-500/10 dark:to-teal-500/10 dark:text-emerald-700/40">
                  <ImageOff className="size-8" />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-tight truncate" title={ev.title}>
                      {ev.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarRange className="size-3" />
                      <span>{formatDate(ev.startDate)}</span>
                      <span>→</span>
                      <span>{formatDate(ev.endDate)}</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "ring-1 shrink-0",
                      ev.isActive
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30"
                        : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30"
                    )}
                  >
                    {ev.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                  {ev.description}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border bg-muted/30 py-2">
                    <p className="text-lg font-semibold tabular-nums">{ev.questionCount ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Qs</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 py-2">
                    <p className="text-lg font-semibold tabular-nums">{ev.linkCount ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Links</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 py-2">
                    <p className="text-lg font-semibold tabular-nums">{ev.attemptCount ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Attempts</p>
                  </div>
                </div>

                {/* Registration status badges */}
                {(ev.requireRegistration ||
                  (ev.fieldCount ?? 0) > 0 ||
                  (ev.registrationCount ?? 0) > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {ev.requireRegistration && (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30"
                      >
                        <ClipboardList className="size-3" />
                        Registration required
                      </Badge>
                    )}
                    {(ev.fieldCount ?? 0) > 0 && (
                      <Badge
                        variant="outline"
                        className="bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700"
                      >
                        {ev.fieldCount} field{ev.fieldCount === 1 ? "" : "s"}
                      </Badge>
                    )}
                    {(ev.registrationCount ?? 0) > 0 && (
                      <Badge
                        variant="outline"
                        className="bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/30"
                      >
                        <Users className="size-3" />
                        {ev.registrationCount} registered
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
              <div className="flex items-center justify-between border-t px-4 py-2.5 bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  Created {format(parseISO(ev.createdAt), "MMM d, yyyy")}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => openEdit(ev)}>
                      <Pencil className="size-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        onManageQuestions?.(ev.id, ev.title)
                      }
                    >
                      <FileQuestion className="size-4" /> Manage Questions
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onGenerateLink?.(ev.id)}>
                      <Link2 className="size-4" /> Generate Link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onManageRegistration?.(ev.id, ev.title)}
                    >
                      <ClipboardList className="size-4" /> Registration Form
                    </DropdownMenuItem>
                    {(ev.registrationCount ?? 0) > 0 || ev.requireRegistration ? (
                      <DropdownMenuItem
                        onClick={() => onViewRegistrations?.(ev.id, ev.title)}
                      >
                        <Users className="size-4" /> View Registrations
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => onViewAnalytics?.(ev.id)}>
                      <BarChart3 className="size-4" /> View Analytics
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-rose-600 focus:text-rose-700"
                      onClick={() => setDeleteTarget(ev)}
                    >
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Event" : "Create Event"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details of this event."
                : "Set up a new quiz event."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ev-title">Title *</Label>
              <Input
                id="ev-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Web Development Workshop 2025"
                aria-invalid={!!errors.title}
              />
              {errors.title && (
                <p className="text-xs text-rose-500">{errors.title}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">Description *</Label>
              <Textarea
                id="ev-desc"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="A short description of the event / quiz."
                aria-invalid={!!errors.description}
              />
              {errors.description && (
                <p className="text-xs text-rose-500">{errors.description}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-image">Image URL</Label>
              <Input
                id="ev-image"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                placeholder="https://..."
                aria-invalid={!!errors.image}
              />
              {errors.image && (
                <p className="text-xs text-rose-500">{errors.image}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-start">Start Date *</Label>
                <Input
                  id="ev-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  aria-invalid={!!errors.startDate}
                />
                {errors.startDate && (
                  <p className="text-xs text-rose-500">{errors.startDate}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-end">End Date *</Label>
                <Input
                  id="ev-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                  aria-invalid={!!errors.endDate}
                />
                {errors.endDate && (
                  <p className="text-xs text-rose-500">{errors.endDate}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="ev-active" className="cursor-pointer">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Inactive events are hidden from new attempts.
                </p>
              </div>
              <Switch
                id="ev-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
            </div>

            {/* Payment configuration */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <h4 className="mb-3 text-sm font-semibold">Payment</h4>
              <PaymentConfig
                event={{
                  paymentMethod: form.paymentMethod,
                  paymentAmount: form.paymentAmount,
                  paymentCurrency: form.paymentCurrency,
                  paymentInstructions: form.paymentInstructions,
                  upiId: form.upiId,
                  upiLink: form.upiLink,
                  qrCodeUrl: form.qrCodeUrl,
                  requireTransactionRef: form.requireTransactionRef,
                  requireScreenshot: form.requireScreenshot,
                }}
                onChange={(value: PaymentConfigValue) =>
                  setForm((prev) => ({
                    ...prev,
                    paymentMethod: value.paymentMethod,
                    paymentAmount: value.paymentAmount,
                    paymentCurrency: value.paymentCurrency,
                    paymentInstructions: value.paymentInstructions,
                    upiId: value.upiId,
                    upiLink: value.upiLink,
                    qrCodeUrl: value.qrCodeUrl,
                    requireTransactionRef: value.requireTransactionRef,
                    requireScreenshot: value.requireScreenshot,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {editing ? "Save changes" : "Create event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.title}&quot; along
              with its questions, quiz links, and attempts. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
              }}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
