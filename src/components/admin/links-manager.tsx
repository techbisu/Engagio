"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Plus,
  Copy,
  Pencil,
  Trash2,
  Link2,
  ExternalLink,
  ClipboardList,
  CheckCircle2,
  Clock,
  Hash,
  Inbox,
} from "lucide-react"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { cn, truncate } from "@/lib/utils"

import { api } from "./api"
import type { EventDto, QuizLinkDto } from "@/types"

type QuizLinkRow = QuizLinkDto & { attemptCount?: number }

interface LinksManagerProps {
  preselectedEventId?: string
  onViewAttempts?: (slug?: string) => void
}

interface LinkFormState {
  eventId: string
  isActive: boolean
  shuffleQuestions: boolean
  shuffleOptions: boolean
  showResults: boolean
  requireFullscreen: boolean
  timeLimit: number
  maxAttempts: number
  passThreshold: number
  expiresAt: string // yyyy-mm-dd or ""
}

const emptyForm: LinkFormState = {
  eventId: "",
  isActive: true,
  shuffleQuestions: true,
  shuffleOptions: false,
  showResults: true,
  requireFullscreen: true,
  timeLimit: 30,
  maxAttempts: 1,
  passThreshold: 40,
  expiresAt: "",
}

export function LinksManager({
  preselectedEventId,
  onViewAttempts,
}: LinksManagerProps) {
  const qc = useQueryClient()
  const { data, isLoading, isError, error } = useQuery<QuizLinkRow[]>({
    queryKey: ["quiz-links"],
    queryFn: () => api<QuizLinkRow[]>("/api/quiz-links"),
  })

  const eventsQuery = useQuery<EventDto[]>({
    queryKey: ["events"],
    queryFn: () => api<EventDto[]>("/api/events"),
  })

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<QuizLinkRow | null>(null)
  const [form, setForm] = React.useState<LinkFormState>(emptyForm)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = React.useState<QuizLinkRow | null>(null)

  const createMutation = useMutation({
    mutationFn: (payload: LinkFormState) =>
      api<QuizLinkDto>("/api/quiz-links", {
        method: "POST",
        body: JSON.stringify({
          eventId: payload.eventId,
          isActive: payload.isActive,
          shuffleQuestions: payload.shuffleQuestions,
          shuffleOptions: payload.shuffleOptions,
          showResults: payload.showResults,
          requireFullscreen: payload.requireFullscreen,
          timeLimit: payload.timeLimit,
          maxAttempts: payload.maxAttempts,
          passThreshold: payload.passThreshold,
          expiresAt: payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quiz-links"] })
      qc.invalidateQueries({ queryKey: ["events"] })
      qc.invalidateQueries({ queryKey: ["analytics"] })
      toast.success("Quiz link generated")
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error("Failed to generate link: " + e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LinkFormState }) =>
      api<QuizLinkDto>(`/api/quiz-links/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: payload.isActive,
          shuffleQuestions: payload.shuffleQuestions,
          shuffleOptions: payload.shuffleOptions,
          showResults: payload.showResults,
          requireFullscreen: payload.requireFullscreen,
          timeLimit: payload.timeLimit,
          maxAttempts: payload.maxAttempts,
          passThreshold: payload.passThreshold,
          expiresAt: payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quiz-links"] })
      toast.success("Quiz link updated")
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error("Failed to update link: " + e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/quiz-links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quiz-links"] })
      qc.invalidateQueries({ queryKey: ["events"] })
      qc.invalidateQueries({ queryKey: ["analytics"] })
      toast.success("Quiz link deleted")
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error("Failed to delete link: " + e.message),
  })

  function openCreate(eventId?: string) {
    setEditing(null)
    const evId =
      eventId ||
      preselectedEventId ||
      eventsQuery.data?.[0]?.id ||
      ""
    setForm({ ...emptyForm, eventId: evId })
    setErrors({})
    setDialogOpen(true)
  }

  // Open with preselected event (from events manager "Generate Link" action).
  React.useEffect(() => {
    if (preselectedEventId && !dialogOpen) {
      openCreate(preselectedEventId)
    }
  }, [preselectedEventId, dialogOpen])

  function openEdit(l: QuizLinkRow) {
    setEditing(l)
    setForm({
      eventId: l.eventId,
      isActive: l.isActive,
      shuffleQuestions: l.shuffleQuestions,
      shuffleOptions: l.shuffleOptions,
      showResults: l.showResults,
      requireFullscreen: l.requireFullscreen,
      timeLimit: l.timeLimit,
      maxAttempts: l.maxAttempts,
      passThreshold: l.passThreshold,
      expiresAt: l.expiresAt ? l.expiresAt.slice(0, 10) : "",
    })
    setErrors({})
    setDialogOpen(true)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.eventId) e.eventId = "Please select an event"
    if (form.timeLimit < 0) e.timeLimit = "Cannot be negative"
    if (form.maxAttempts < 0) e.maxAttempts = "Cannot be negative"
    if (form.passThreshold < 0 || form.passThreshold > 100) {
      e.passThreshold = "Must be between 0 and 100"
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

  async function copyLink(slug: string) {
    const url = `${window.location.origin}/?quiz=${slug}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied to clipboard", {
        description: url,
      })
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const links = data || []
  const events = eventsQuery.data || []

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Quiz Links</h2>
          <p className="text-sm text-muted-foreground">
            Generate shareable links that students use to take a quiz.
          </p>
        </div>
        <Button
          onClick={() => openCreate()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="size-4" />
          Generate Quiz Link
        </Button>
      </div>

      {isError && (
        <Card className="border-rose-200 dark:border-rose-500/30">
          <CardContent className="pt-6 text-sm text-rose-600 dark:text-rose-400">
            Failed to load links: {(error as Error)?.message || "Unknown error"}
          </CardContent>
        </Card>
      )}

      <Card>
        {isLoading ? (
          <CardContent className="py-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        ) : links.length === 0 ? (
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Link2 className="size-7" />
            </div>
            <p className="mt-4 text-lg font-semibold">No quiz links yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Generate a shareable link for an event to let students take the quiz.
            </p>
            <Button
              className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => openCreate()}
            >
              <Plus className="size-4" />
              Generate Quiz Link
            </Button>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug / Link</TableHead>
                  <TableHead className="hidden md:table-cell">Event</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Time</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Max</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">Pass</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">Attempts</TableHead>
                  <TableHead className="hidden xl:table-cell">Expires</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((l) => {
                  const expired =
                    l.expiresAt && new Date(l.expiresAt) < new Date()
                  return (
                    <TableRow key={l.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                            {l.slug}
                          </code>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => copyLink(l.slug)}
                                >
                                  <Copy className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy link</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <p className="text-xs text-muted-foreground hidden sm:block">
                            {format(parseISO(l.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm truncate max-w-[200px] inline-block align-middle">
                          {l.event?.title || truncate(l.eventId, 12)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "ring-1",
                            !l.isActive
                              ? "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30"
                              : expired
                              ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30"
                              : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30"
                          )}
                        >
                          {!l.isActive ? "Inactive" : expired ? "Expired" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center tabular-nums hidden sm:table-cell">
                        {l.timeLimit ? `${l.timeLimit}m` : "∞"}
                      </TableCell>
                      <TableCell className="text-center tabular-nums hidden sm:table-cell">
                        {l.maxAttempts || "∞"}
                      </TableCell>
                      <TableCell className="text-center tabular-nums hidden lg:table-cell">
                        {l.passThreshold}%
                      </TableCell>
                      <TableCell className="text-center tabular-nums hidden lg:table-cell">
                        {l.attemptCount ?? 0}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                        {l.expiresAt ? format(parseISO(l.expiresAt), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <ExternalLink className="size-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => copyLink(l.slug)}>
                              <Copy className="size-4" /> Copy link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onViewAttempts?.(l.slug)}>
                              <ClipboardList className="size-4" /> View attempts
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEdit(l)}>
                              <Pencil className="size-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-rose-600 focus:text-rose-700"
                              onClick={() => setDeleteTarget(l)}
                            >
                              <Trash2 className="size-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Quiz Link" : "Generate Quiz Link"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the settings for this quiz link."
                : "Configure the quiz link and share it with students."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="link-event">Event *</Label>
              <Select
                value={form.eventId}
                onValueChange={(v) => setForm({ ...form, eventId: v })}
                disabled={!!editing || eventsQuery.isLoading}
              >
                <SelectTrigger id="link-event" className="w-full" aria-invalid={!!errors.eventId}>
                  <SelectValue
                    placeholder={
                      eventsQuery.isLoading
                        ? "Loading events…"
                        : "Select an event"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.eventId && (
                <p className="text-xs text-rose-500">{errors.eventId}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="link-time">
                  <Clock className="size-3.5 inline mr-1" />
                  Time limit (min)
                </Label>
                <Input
                  id="link-time"
                  type="number"
                  min={0}
                  value={form.timeLimit}
                  onChange={(e) =>
                    setForm({ ...form, timeLimit: parseInt(e.target.value || "0", 10) })
                  }
                  aria-invalid={!!errors.timeLimit}
                />
                <p className="text-xs text-muted-foreground">0 = no limit</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-max">
                  <Hash className="size-3.5 inline mr-1" />
                  Max attempts
                </Label>
                <Input
                  id="link-max"
                  type="number"
                  min={0}
                  value={form.maxAttempts}
                  onChange={(e) =>
                    setForm({ ...form, maxAttempts: parseInt(e.target.value || "0", 10) })
                  }
                  aria-invalid={!!errors.maxAttempts}
                />
                <p className="text-xs text-muted-foreground">0 = unlimited</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-pass">
                  <CheckCircle2 className="size-3.5 inline mr-1" />
                  Pass threshold (%)
                </Label>
                <Input
                  id="link-pass"
                  type="number"
                  min={0}
                  max={100}
                  value={form.passThreshold}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      passThreshold: parseInt(e.target.value || "0", 10),
                    })
                  }
                  aria-invalid={!!errors.passThreshold}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="link-expires">Expires at (optional)</Label>
              <Input
                id="link-expires"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                After this date the link stops accepting new attempts.
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ToggleRow
                label="Active"
                description="Link accepts attempts"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <ToggleRow
                label="Shuffle questions"
                description="Randomize question order"
                checked={form.shuffleQuestions}
                onCheckedChange={(v) => setForm({ ...form, shuffleQuestions: v })}
              />
              <ToggleRow
                label="Shuffle options"
                description="Randomize option order"
                checked={form.shuffleOptions}
                onCheckedChange={(v) => setForm({ ...form, shuffleOptions: v })}
              />
              <ToggleRow
                label="Show results"
                description="Reveal score after submit"
                checked={form.showResults}
                onCheckedChange={(v) => setForm({ ...form, showResults: v })}
              />
              <ToggleRow
                label="Require fullscreen"
                description="Anti-cheat: full-screen mode"
                checked={form.requireFullscreen}
                onCheckedChange={(v) => setForm({ ...form, requireFullscreen: v })}
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
              {editing ? "Save changes" : "Generate link"}
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
            <AlertDialogTitle>Delete quiz link?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the link with slug{" "}
              <span className="font-mono font-semibold">{deleteTarget?.slug}</span> and
              disconnect its attempts. Existing attempt records are kept.
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

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
