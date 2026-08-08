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
  Settings2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Brain,
  Sparkles,
  Monitor,
  LogOut,
  AppWindow,
  Clipboard,
  MousePointerClick,
  Keyboard,
  TerminalSquare,
  Camera,
  Stamp,
  UserCheck,
  Users,
  Eye,
  Lock,
  Megaphone,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
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

/**
 * Full form state for the Create/Edit Quiz Link dialog.
 * Includes all 13 security toggles (9 anti-cheat + 4 AI proctor) plus
 * `questionCount` (subset selection) and `publishResults` (hide-until-publish).
 */
interface LinkFormState {
  eventId: string
  isActive: boolean
  // Quiz configuration
  shuffleQuestions: boolean
  shuffleOptions: boolean
  showResults: boolean
  publishResults: boolean
  timeLimit: number
  maxAttempts: number
  questionCount: number
  passThreshold: number
  expiresAt: string // yyyy-mm-dd or ""
  // Security & Anti-Cheat (9 toggles)
  requireFullscreen: boolean
  autoSubmitOnExit: boolean
  tabSwitchDetection: boolean
  copyPasteBlocking: boolean
  rightClickDisable: boolean
  keyboardShortcutBlocking: boolean
  devtoolsDetection: boolean
  antiScreenshot: boolean
  watermarkOverlay: boolean
  // AI Proctor (master + 3 sub-toggles)
  aiProctor: boolean
  aiProctorFaceDetection: boolean
  aiProctorMultiFace: boolean
  aiProctorLookAway: boolean
}

/**
 * Default form state — matches the Prisma schema defaults in
 * prisma/schema.prisma (QuizLink model). Most security toggles default to
 * `true`; `aiProctor` defaults to `false`; `questionCount` is `0`;
 * `publishResults` is `false`.
 */
const emptyForm: LinkFormState = {
  eventId: "",
  isActive: true,
  shuffleQuestions: true,
  shuffleOptions: false,
  showResults: true,
  publishResults: false,
  timeLimit: 30,
  maxAttempts: 1,
  questionCount: 0,
  passThreshold: 40,
  expiresAt: "",
  requireFullscreen: true,
  autoSubmitOnExit: true,
  tabSwitchDetection: true,
  copyPasteBlocking: true,
  rightClickDisable: true,
  keyboardShortcutBlocking: true,
  devtoolsDetection: true,
  antiScreenshot: true,
  watermarkOverlay: true,
  aiProctor: false,
  aiProctorFaceDetection: true,
  aiProctorMultiFace: true,
  aiProctorLookAway: true,
}

/** Build the JSON payload sent to POST /api/quiz-links or PATCH /api/quiz-links/[id]. */
function buildPayload(form: LinkFormState) {
  return {
    eventId: form.eventId,
    isActive: form.isActive,
    // Quiz configuration
    shuffleQuestions: form.shuffleQuestions,
    shuffleOptions: form.shuffleOptions,
    showResults: form.showResults,
    publishResults: form.publishResults,
    questionCount: form.questionCount,
    timeLimit: form.timeLimit,
    maxAttempts: form.maxAttempts,
    passThreshold: form.passThreshold,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    // Security & Anti-Cheat (9)
    requireFullscreen: form.requireFullscreen,
    autoSubmitOnExit: form.autoSubmitOnExit,
    tabSwitchDetection: form.tabSwitchDetection,
    copyPasteBlocking: form.copyPasteBlocking,
    rightClickDisable: form.rightClickDisable,
    keyboardShortcutBlocking: form.keyboardShortcutBlocking,
    devtoolsDetection: form.devtoolsDetection,
    antiScreenshot: form.antiScreenshot,
    watermarkOverlay: form.watermarkOverlay,
    // AI Proctor (master + 3 sub)
    aiProctor: form.aiProctor,
    aiProctorFaceDetection: form.aiProctorFaceDetection,
    aiProctorMultiFace: form.aiProctorMultiFace,
    aiProctorLookAway: form.aiProctorLookAway,
  }
}

/** Keys used to compute "X of 9 active" for the Security section badge. */
const SECURITY_TOGGLE_KEYS: (keyof LinkFormState)[] = [
  "requireFullscreen",
  "autoSubmitOnExit",
  "tabSwitchDetection",
  "copyPasteBlocking",
  "rightClickDisable",
  "keyboardShortcutBlocking",
  "devtoolsDetection",
  "antiScreenshot",
  "watermarkOverlay",
]

/** Keys used to compute "X of 4 active" for the AI Proctor section badge (master + 3 subs). */
const AI_PROCTOR_TOGGLE_KEYS: (keyof LinkFormState)[] = [
  "aiProctor",
  "aiProctorFaceDetection",
  "aiProctorMultiFace",
  "aiProctorLookAway",
]

/** Total "security features" surfaced in the top summary band. 12 = 9 anti-cheat + 3 AI sub-features (master is the "enable" switch, not a feature). */
const SECURITY_FEATURE_TOTAL = 12

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
        body: JSON.stringify(buildPayload(payload)),
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
        body: JSON.stringify(buildPayload(payload)),
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
      publishResults: l.publishResults,
      timeLimit: l.timeLimit,
      maxAttempts: l.maxAttempts,
      questionCount: l.questionCount,
      passThreshold: l.passThreshold,
      expiresAt: l.expiresAt ? l.expiresAt.slice(0, 10) : "",
      requireFullscreen: l.requireFullscreen,
      autoSubmitOnExit: l.autoSubmitOnExit,
      tabSwitchDetection: l.tabSwitchDetection,
      copyPasteBlocking: l.copyPasteBlocking,
      rightClickDisable: l.rightClickDisable,
      keyboardShortcutBlocking: l.keyboardShortcutBlocking,
      devtoolsDetection: l.devtoolsDetection,
      antiScreenshot: l.antiScreenshot,
      watermarkOverlay: l.watermarkOverlay,
      aiProctor: l.aiProctor,
      aiProctorFaceDetection: l.aiProctorFaceDetection,
      aiProctorMultiFace: l.aiProctorMultiFace,
      aiProctorLookAway: l.aiProctorLookAway,
    })
    setErrors({})
    setDialogOpen(true)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.eventId) e.eventId = "Please select an event"
    if (form.timeLimit < 0) e.timeLimit = "Cannot be negative"
    if (form.maxAttempts < 0) e.maxAttempts = "Cannot be negative"
    if (form.questionCount < 0) e.questionCount = "Cannot be negative"
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

  // ---- Security feature counts for the dialog summary + section badges ----
  const securityActive = SECURITY_TOGGLE_KEYS.filter((k) => form[k]).length
  const aiProctorActive = AI_PROCTOR_TOGGLE_KEYS.filter((k) => form[k]).length
  const aiSubsActive =
    (form.aiProctorFaceDetection ? 1 : 0) +
    (form.aiProctorMultiFace ? 1 : 0) +
    (form.aiProctorLookAway ? 1 : 0)
  // For the top summary, AI sub-features only count as "enabled" if the master is ON.
  const summaryActive = securityActive + (form.aiProctor ? aiSubsActive : 0)

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
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? (
                <Pencil className="size-4 text-emerald-600" />
              ) : (
                <Link2 className="size-4 text-emerald-600" />
              )}
              {editing ? "Edit Quiz Link" : "Generate Quiz Link"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the settings for this quiz link."
                : "Configure the quiz link and share it with students."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Security feature summary band */}
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200/60 bg-emerald-50/60 p-2.5 dark:border-emerald-500/20 dark:bg-emerald-500/5">
              <ShieldCheck
                className={cn(
                  "size-4 shrink-0",
                  summaryActive === SECURITY_FEATURE_TOTAL
                    ? "text-emerald-600 dark:text-emerald-400"
                    : summaryActive >= 8
                    ? "text-emerald-600 dark:text-emerald-400"
                    : summaryActive >= 5
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              />
              <span className="text-xs font-medium">
                {summaryActive} of {SECURITY_FEATURE_TOTAL} security features enabled
              </span>
              <div className="ml-auto flex-1 max-w-[140px] h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    summaryActive >= 8
                      ? "bg-emerald-500"
                      : summaryActive >= 5
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  )}
                  style={{
                    width: `${(summaryActive / SECURITY_FEATURE_TOTAL) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Event picker */}
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

            {/* Active toggle (link status) */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-500/5">
              <div className="min-w-0">
                <p className="text-sm font-medium">Link is active</p>
                <p className="text-xs text-muted-foreground">
                  When ON, students can use this link to start attempts.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                aria-label="Link is active"
              />
            </div>

            {/* ============ Quiz Configuration section ============ */}
            <SectionHeader
              icon={Settings2}
              title="Quiz Configuration"
              accent="slate"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="link-time" className="text-xs">
                  <Clock className="size-3 inline mr-1" />
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
                <p className="text-[11px] text-muted-foreground">0 = no limit</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-max" className="text-xs">
                  <Hash className="size-3 inline mr-1" />
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
                <p className="text-[11px] text-muted-foreground">0 = unlimited</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-qcount" className="text-xs">
                  <ClipboardList className="size-3 inline mr-1" />
                  Question count
                </Label>
                <Input
                  id="link-qcount"
                  type="number"
                  min={0}
                  value={form.questionCount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      questionCount: parseInt(e.target.value || "0", 10),
                    })
                  }
                  aria-invalid={!!errors.questionCount}
                />
                <p className="text-[11px] text-muted-foreground">0 = use all</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-pass" className="text-xs">
                  <CheckCircle2 className="size-3 inline mr-1" />
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
                <p className="text-[11px] text-muted-foreground">&nbsp;</p>
              </div>
            </div>
            {form.questionCount > 0 && (
              <p className="text-xs text-muted-foreground -mt-2">
                Number of questions to randomly select from the question bank. 0 = use all
                questions. E.g., set to 30 to pick 30 random questions from 100.
              </p>
            )}

            {/* Quiz behavior toggles (shuffle + show results + publish) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <SecurityToggleRow
                icon={Shield}
                label="Shuffle questions"
                description="Randomize question order for each attempt."
                checked={form.shuffleQuestions}
                onCheckedChange={(v) => setForm({ ...form, shuffleQuestions: v })}
              />
              <SecurityToggleRow
                icon={Shield}
                label="Shuffle options"
                description="Randomize option order within each question."
                checked={form.shuffleOptions}
                onCheckedChange={(v) => setForm({ ...form, shuffleOptions: v })}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <SecurityToggleRow
                        icon={Eye}
                        label="Show instant results"
                        description="Reveal score to the student immediately after submit."
                        checked={form.showResults}
                        onCheckedChange={(v) => {
                          // Mutex: enabling showResults disables publishResults.
                          setForm({
                            ...form,
                            showResults: v,
                            publishResults: v ? false : form.publishResults,
                          })
                        }}
                        disabled={form.publishResults}
                        disabledReason="Disabled because results are publish-controlled"
                      />
                    </div>
                  </TooltipTrigger>
                  {form.publishResults && (
                    <TooltipContent>
                      Disabled because results are publish-controlled
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <SecurityToggleRow
                        icon={Megaphone}
                        label="Publish results later"
                        description="Students see a 'pending' state after submitting. Admin must publish results from the Attempts tab."
                        checked={form.publishResults}
                        onCheckedChange={(v) => {
                          // Mutex: enabling publishResults disables showResults.
                          setForm({
                            ...form,
                            publishResults: v,
                            showResults: v ? false : form.showResults,
                          })
                        }}
                        disabled={form.showResults}
                        disabledReason="Disabled because instant results are enabled"
                      />
                    </div>
                  </TooltipTrigger>
                  {form.showResults && (
                    <TooltipContent>
                      Disabled because instant results are enabled
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
            {form.publishResults && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 -mt-2 flex items-start gap-1.5">
                <ShieldAlert className="size-3.5 mt-0.5 shrink-0" />
                <span>
                  Results are hidden from students until you publish them from the{" "}
                  <span className="font-semibold">Attempts</span> tab. The "Show instant
                  results" toggle is disabled while this is ON.
                </span>
              </p>
            )}

            {/* Expires at */}
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

            {/* ============ Security & Anti-Cheat section ============ */}
            <SectionHeader
              icon={Shield}
              title="Security & Anti-Cheat"
              active={securityActive}
              total={9}
              accent="emerald"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <SecurityToggleRow
                icon={Monitor}
                label="Require fullscreen"
                description="Force the quiz into full-screen mode."
                checked={form.requireFullscreen}
                onCheckedChange={(v) => setForm({ ...form, requireFullscreen: v })}
              />
              <SecurityToggleRow
                icon={LogOut}
                label="Auto-submit on fullscreen exit"
                description="Automatically submit the quiz if the student exits fullscreen mode."
                checked={form.autoSubmitOnExit}
                onCheckedChange={(v) => setForm({ ...form, autoSubmitOnExit: v })}
              />
              <SecurityToggleRow
                icon={AppWindow}
                label="Tab/window switch detection"
                description="Detect when the student switches to another tab or window."
                checked={form.tabSwitchDetection}
                onCheckedChange={(v) => setForm({ ...form, tabSwitchDetection: v })}
              />
              <SecurityToggleRow
                icon={Clipboard}
                label="Copy/paste blocking"
                description="Block clipboard copy and paste actions during the quiz."
                checked={form.copyPasteBlocking}
                onCheckedChange={(v) => setForm({ ...form, copyPasteBlocking: v })}
              />
              <SecurityToggleRow
                icon={MousePointerClick}
                label="Right-click disable"
                description="Disable the right-click context menu."
                checked={form.rightClickDisable}
                onCheckedChange={(v) => setForm({ ...form, rightClickDisable: v })}
              />
              <SecurityToggleRow
                icon={Keyboard}
                label="Keyboard shortcut blocking"
                description="Blocks Ctrl+C/V/X, F12, Ctrl+Shift+I/J/C, Ctrl+U, etc."
                checked={form.keyboardShortcutBlocking}
                onCheckedChange={(v) => setForm({ ...form, keyboardShortcutBlocking: v })}
              />
              <SecurityToggleRow
                icon={TerminalSquare}
                label="DevTools detection"
                description="Detect when developer tools are opened (F12, Ctrl+Shift+I)."
                checked={form.devtoolsDetection}
                onCheckedChange={(v) => setForm({ ...form, devtoolsDetection: v })}
              />
              <SecurityToggleRow
                icon={Camera}
                label="Anti-screenshot"
                description="Block PrintScreen key and detect frame drops indicating screen capture."
                checked={form.antiScreenshot}
                onCheckedChange={(v) => setForm({ ...form, antiScreenshot: v })}
              />
              <SecurityToggleRow
                icon={Stamp}
                label="Watermark overlay"
                description="Show a semi-transparent overlay with the student's email + timestamp, discouraging photos."
                checked={form.watermarkOverlay}
                onCheckedChange={(v) => setForm({ ...form, watermarkOverlay: v })}
              />
            </div>

            <Separator />

            {/* ============ AI Proctor section ============ */}
            <SectionHeader
              icon={Brain}
              title="AI Proctor"
              active={aiProctorActive}
              total={4}
              accent="teal"
            />
            {/* Master AI Proctor toggle */}
            <div
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border p-3.5 transition-colors",
                form.aiProctor
                  ? "border-teal-300 bg-teal-50/60 dark:border-teal-500/30 dark:bg-teal-500/5"
                  : "border-slate-200 bg-slate-50/40 dark:border-slate-700 dark:bg-slate-500/5"
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Sparkles
                  className={cn(
                    "size-4 shrink-0 mt-0.5",
                    form.aiProctor
                      ? "text-teal-600 dark:text-teal-400"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    Enable AI Proctor
                    {form.aiProctor && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/30"
                      >
                        ON
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                    Browser-based, lightweight AI proctoring using canvas pixel analysis. No
                    heavy ML libraries. When ON, enable the sub-features below.
                  </p>
                </div>
              </div>
              <Switch
                checked={form.aiProctor}
                onCheckedChange={(v) => setForm({ ...form, aiProctor: v })}
                aria-label="Enable AI Proctor"
              />
            </div>
            {/* AI Proctor sub-toggles (disabled when master is OFF) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <SecurityToggleRow
                        icon={UserCheck}
                        label="Face detection"
                        description="Alert if no face is detected in front of the camera."
                        checked={form.aiProctorFaceDetection}
                        onCheckedChange={(v) =>
                          setForm({ ...form, aiProctorFaceDetection: v })
                        }
                        disabled={!form.aiProctor}
                        disabledReason="Enable AI Proctor to activate"
                      />
                    </div>
                  </TooltipTrigger>
                  {!form.aiProctor && (
                    <TooltipContent>Enable AI Proctor to activate</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <SecurityToggleRow
                        icon={Users}
                        label="Multi-face alert"
                        description="Alert if more than one face is detected (possible impersonation)."
                        checked={form.aiProctorMultiFace}
                        onCheckedChange={(v) =>
                          setForm({ ...form, aiProctorMultiFace: v })
                        }
                        disabled={!form.aiProctor}
                        disabledReason="Enable AI Proctor to activate"
                      />
                    </div>
                  </TooltipTrigger>
                  {!form.aiProctor && (
                    <TooltipContent>Enable AI Proctor to activate</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <SecurityToggleRow
                        icon={Eye}
                        label="Look-away detection"
                        description="Track head position and alert if the student looks away frequently."
                        checked={form.aiProctorLookAway}
                        onCheckedChange={(v) =>
                          setForm({ ...form, aiProctorLookAway: v })
                        }
                        disabled={!form.aiProctor}
                        disabledReason="Enable AI Proctor to activate"
                      />
                    </div>
                  </TooltipTrigger>
                  {!form.aiProctor && (
                    <TooltipContent>Enable AI Proctor to activate</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
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

/** Section header with an icon, title, and an "X/Y active" badge (optional). */
function SectionHeader({
  icon: Icon,
  title,
  active,
  total,
  accent = "emerald",
}: {
  icon: LucideIcon
  title: string
  active?: number
  total?: number
  accent?: "emerald" | "teal" | "slate"
}) {
  const showCount = typeof active === "number" && typeof total === "number"
  const accentClasses = {
    emerald:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    teal: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400",
    slate:
      "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400",
  }[accent]

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex size-7 items-center justify-center rounded-md shrink-0",
          accentClasses
        )}
      >
        <Icon className="size-4" />
      </div>
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {showCount && (
        <Badge
          variant="outline"
          className="ml-auto text-[10px] font-mono tabular-nums"
        >
          {active}/{total} active
        </Badge>
      )}
    </div>
  )
}

/** Single toggle row with icon + label + description + Switch. */
function SecurityToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  disabledReason,
}: {
  icon: LucideIcon
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  disabledReason?: string
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors",
        disabled
          ? "opacity-60 bg-muted/30 border-dashed"
          : "hover:bg-muted/40 hover:border-emerald-200/60 dark:hover:border-emerald-500/30"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Icon
            className={cn(
              "size-3.5 shrink-0",
              checked && !disabled
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            )}
          />
          <p className="text-sm font-medium leading-tight">{label}</p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{description}</p>
        {disabled && disabledReason && (
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
            {disabledReason}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  )
}
