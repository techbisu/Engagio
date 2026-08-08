"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Trash2,
  Pencil,
  Plus,
  X,
  Check,
  Loader2,
  Link2,
  Play,
  Square,
  QrCode,
  ExternalLink,
  GripVertical,
  Settings2,
  FileQuestion,
  MessageSquare,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"
import QRCode from "qrcode"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { cn } from "@/lib/utils"

import {
  api,
  ACTIVITY_TYPE_META,
  ACTIVITY_STATUS_META,
  ACTIVITY_QUESTION_TYPE_META,
  ACTIVITY_QUESTION_TYPES,
} from "./api"
import type {
  ActivityDto,
  ActivityQuestionDto,
  ActivityQuestionType,
  ActivitySettings,
  ActivityType,
} from "@/types"

interface ActivityEditorProps {
  activity: ActivityDto
  onBack: () => void
  /** Called when user clicks "Manage in Quiz Links" (for QUIZ type). */
  onManageQuizLinks?: (quizLinkId: string) => void
  /** Called when user deletes the activity. */
  onDeleted?: () => void
  /** Called when user duplicates the activity. */
  onDuplicated?: (newActivity: ActivityDto) => void
}

interface ActivityWithQuestions extends ActivityDto {
  questions?: ActivityQuestionDto[]
}

// ---------------------------------------------------------------------------
// Question form state
// ---------------------------------------------------------------------------

interface QuestionFormState {
  text: string
  type: ActivityQuestionType
  options: string[]
  required: boolean
}

const emptyQuestion: QuestionFormState = {
  text: "",
  type: "SINGLE_CHOICE",
  options: ["", ""],
  required: true,
}

function questionToForm(q: ActivityQuestionDto): QuestionFormState {
  return {
    text: q.text,
    type: q.type,
    options:
      q.options && q.options.length > 0
        ? [...q.options]
        : q.type === "YES_NO"
          ? ["Yes", "No"]
          : ["", ""],
    required: q.required,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Activity types that show the questions section. */
const TYPES_WITH_QUESTIONS: ActivityType[] = [
  "POLL",
  "VOTING",
  "SURVEY",
  "FEEDBACK",
  "KNOWLEDGE_CHECK",
  "PRE_POST_ASSESSMENT",
]

/** Question types allowed per activity type. */
function allowedQuestionTypes(type: ActivityType): ActivityQuestionType[] {
  switch (type) {
    case "POLL":
    case "VOTING":
      return ["SINGLE_CHOICE", "YES_NO"]
    case "KNOWLEDGE_CHECK":
    case "PRE_POST_ASSESSMENT":
      return [
        "SINGLE_CHOICE",
        "MULTIPLE_CHOICE",
        "YES_NO",
        "TEXT",
        "NUMBER",
      ]
    case "SURVEY":
    case "FEEDBACK":
      return [
        "SINGLE_CHOICE",
        "MULTIPLE_CHOICE",
        "RATING",
        "TEXT",
        "NUMBER",
        "YES_NO",
      ]
    default:
      return ACTIVITY_QUESTION_TYPES
  }
}

/** True if the question type uses an options array. */
function usesOptions(type: ActivityQuestionType): boolean {
  return (
    type === "SINGLE_CHOICE" ||
    type === "MULTIPLE_CHOICE" ||
    type === "YES_NO"
  )
}

function buildShareUrl(slug?: string | null): string {
  if (typeof window === "undefined") return ""
  if (!slug) return ""
  return `${window.location.origin}/?activity=${slug}`
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ActivityEditor({
  activity,
  onBack,
  onManageQuizLinks,
  onDeleted,
  onDuplicated,
}: ActivityEditorProps) {
  const qc = useQueryClient()

  // Fetch the full activity (with questions).
  const { data, isLoading, isError, error, refetch } =
    useQuery<ActivityWithQuestions>({
      queryKey: ["activity", activity.id],
      queryFn: () => api<ActivityWithQuestions>(`/api/activities/${activity.id}`),
      initialData: activity,
    })

  const [titleDraft, setTitleDraft] = React.useState(activity.title)
  const [descDraft, setDescDraft] = React.useState(activity.description ?? "")
  const [sessionDraft, setSessionDraft] = React.useState(activity.session ?? "")
  const [titleEditing, setTitleEditing] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [qrOpen, setQrOpen] = React.useState(false)
  const [qrDataUrl, setQrDataUrl] = React.useState<string>("")

  // Sync drafts when the upstream activity changes (e.g. after mutations).
  React.useEffect(() => {
    if (!titleEditing) setTitleDraft(data?.title ?? activity.title)
  }, [data?.title, activity.title, titleEditing])
  React.useEffect(() => {
    setDescDraft(data?.description ?? activity.description ?? "")
  }, [data?.description, activity.description])
  React.useEffect(() => {
    setSessionDraft(data?.session ?? activity.session ?? "")
  }, [data?.session, activity.session])

  // Generate QR on demand.
  React.useEffect(() => {
    if (!qrOpen) return
    const url = buildShareUrl(data?.slug)
    if (!url) {
      setQrDataUrl("")
      return
    }
    QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch((e) => {
        console.error("[qr] error:", e)
        toast.error("Could not generate QR code")
      })
  }, [qrOpen, data?.slug])

  // --- Mutations -----------------------------------------------------------

  const patchMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<ActivityDto>(`/api/activities/${activity.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity", activity.id] })
      qc.invalidateQueries({ queryKey: ["activities", activity.eventId] })
    },
    onError: (e: Error) => toast.error("Update failed: " + e.message),
  })

  const startMutation = useMutation({
    mutationFn: () => api(`/api/activities/${activity.id}/start`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity", activity.id] })
      qc.invalidateQueries({ queryKey: ["activities", activity.eventId] })
      toast.success("Activity is now LIVE")
    },
    onError: (e: Error) => toast.error("Could not start: " + e.message),
  })

  const closeMutation = useMutation({
    mutationFn: () => api(`/api/activities/${activity.id}/close`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity", activity.id] })
      qc.invalidateQueries({ queryKey: ["activities", activity.eventId] })
      toast.success("Activity closed")
    },
    onError: (e: Error) => toast.error("Could not close: " + e.message),
  })

  const duplicateMutation = useMutation({
    mutationFn: () =>
      api<ActivityDto>(`/api/activities/${activity.id}/duplicate`, {
        method: "POST",
      }),
    onSuccess: (dup) => {
      qc.invalidateQueries({ queryKey: ["activities", activity.eventId] })
      toast.success("Activity duplicated")
      onDuplicated?.(dup)
    },
    onError: (e: Error) => toast.error("Could not duplicate: " + e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api(`/api/activities/${activity.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities", activity.eventId] })
      toast.success("Activity deleted")
      onDeleted?.()
    },
    onError: (e: Error) => toast.error("Could not delete: " + e.message),
  })

  // --- Helpers -------------------------------------------------------------

  const current = data ?? activity
  const typeMeta = ACTIVITY_TYPE_META[current.type]
  const statusMeta = ACTIVITY_STATUS_META[current.status]
  const questions = data?.questions ?? []
  const showQuestions = TYPES_WITH_QUESTIONS.includes(current.type)
  const shareUrl = buildShareUrl(current.slug)

  function saveTitle() {
    const v = titleDraft.trim()
    if (!v) {
      setTitleDraft(current.title)
      setTitleEditing(false)
      return
    }
    if (v !== current.title) {
      patchMutation.mutate({ title: v })
    }
    setTitleEditing(false)
  }

  function saveField(field: "description" | "session", value: string) {
    const trimmed = value.trim()
    if (trimmed === (current[field] ?? "")) return
    patchMutation.mutate({ [field]: trimmed || null })
  }

  function toggleEnabled(next: boolean) {
    patchMutation.mutate({ isEnabled: next })
  }

  function updateSettings(patch: Partial<ActivitySettings>) {
    const next = { ...(current.settings || {}), ...patch }
    patchMutation.mutate({ settings: next })
  }

  async function copyShareLink() {
    if (!shareUrl) {
      toast.error("No share link available")
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success("Share link copied")
    } catch {
      toast.error("Could not copy link")
    }
  }

  // --- Render --------------------------------------------------------------

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError && !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-rose-600">
            Could not load activity: {(error as Error).message}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const TypeIcon = typeMeta.icon
  const isLive = current.status === "LIVE"
  const isClosed =
    current.status === "CLOSED" || current.status === "COMPLETED"

  return (
    <TooltipProvider delayDuration={300}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex flex-col gap-4"
      >
        {/* Top bar: back + actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground"
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {shareUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyShareLink}
                    disabled={patchMutation.isPending}
                  >
                    <Link2 className="size-4" /> Copy link
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy participant URL</TooltipContent>
              </Tooltip>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQrOpen(true)}
              disabled={!shareUrl}
            >
              <QrCode className="size-4" /> QR
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending}
            >
              {duplicateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Copy className="size-4" />
              )}
              Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
            {!isLive && (
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Start
              </Button>
            )}
            {isLive && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
              >
                {closeMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Square className="size-4" />
                )}
                Close
              </Button>
            )}
          </div>
        </div>

        {/* Header card: title + badges + meta */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-lg ring-1",
                  typeMeta.iconWrap
                )}
              >
                <TypeIcon className="size-4" />
              </span>
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
              {!current.isEnabled && (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                >
                  Disabled
                </Badge>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-1">
              {titleEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveTitle()
                      if (e.key === "Escape") {
                        setTitleDraft(current.title)
                        setTitleEditing(false)
                      }
                    }}
                    className="text-lg font-semibold"
                  />
                  <Button size="sm" onClick={saveTitle}>
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTitleDraft(current.title)
                      setTitleEditing(false)
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTitleEditing(true)}
                  className="group flex items-center gap-2 text-left"
                >
                  <CardTitle className="text-xl">{current.title}</CardTitle>
                  <Pencil className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {current.slug && (
                <span className="font-mono">/{current.slug}</span>
              )}
              {current.session && (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="size-3" /> {current.session}
                </span>
              )}
              {typeof current.responseCount === "number" && (
                <span>{current.responseCount} responses</span>
              )}
              {typeof current.questionCount === "number" && (
                <span>{current.questionCount} questions</span>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Description + session editor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="act-desc">Description</Label>
              <Textarea
                id="act-desc"
                rows={2}
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={(e) => saveField("description", e.target.value)}
                placeholder="What is this activity about?"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="act-session">Session label</Label>
              <Input
                id="act-session"
                value={sessionDraft}
                onChange={(e) => setSessionDraft(e.target.value)}
                onBlur={(e) => saveField("session", e.target.value)}
                placeholder="e.g. Day 1 — Morning"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Enabled</p>
                <p className="text-xs text-muted-foreground">
                  Disabled activities are hidden from participants.
                </p>
              </div>
              <Switch
                checked={current.isEnabled}
                onCheckedChange={toggleEnabled}
                disabled={patchMutation.isPending}
              />
            </div>
          </CardContent>
        </Card>

        {/* Body: questions or QUIZ redirect or Q&A note */}
        {current.type === "QUIZ" && (
          <QuizActivityCard
            quizLink={current.quizLink}
            onManageQuizLinks={() =>
              current.quizLinkId && onManageQuizLinks?.(current.quizLinkId)
            }
          />
        )}

        {current.type === "Q_AND_A" && <QAndANote />}

        {showQuestions && (
          <QuestionsSection
            activityId={current.id}
            activityType={current.type}
            questions={questions}
            isLoading={isLoading}
          />
        )}

        {/* Settings */}
        <SettingsCard
          type={current.type}
          settings={current.settings}
          onChange={updateSettings}
          saving={patchMutation.isPending}
        />

        {/* Delete confirmation */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{current.title}&quot; and all
                responses. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => deleteMutation.mutate()}
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

        {/* QR dialog */}
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Activity QR Code</DialogTitle>
              <DialogDescription>
                Scan to open the participant view.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR code for activity URL"
                  className="size-64 rounded-lg border bg-white"
                />
              ) : (
                <Skeleton className="size-64 rounded-lg" />
              )}
              <p className="text-xs text-muted-foreground break-all text-center font-mono">
                {shareUrl || "—"}
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  if (shareUrl) window.open(shareUrl, "_blank")
                }}
                disabled={!shareUrl}
              >
                <ExternalLink className="size-4" /> Open
              </Button>
              <Button onClick={copyShareLink} disabled={!shareUrl}>
                <Link2 className="size-4" /> Copy URL
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// QUIZ activity card
// ---------------------------------------------------------------------------

function QuizActivityCard({
  quizLink,
  onManageQuizLinks,
}: {
  quizLink?: { id: string; slug: string; timeLimit: number } | null
  onManageQuizLinks: () => void
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileQuestion className="size-4 text-teal-600 dark:text-teal-400" />
          Linked Quiz
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {quizLink ? (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-slate-50/60 p-3 dark:bg-slate-900/40">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">/{quizLink.slug}</p>
                <p className="text-xs text-muted-foreground">
                  Time limit: {quizLink.timeLimit} min
                </p>
              </div>
              <Badge variant="outline" className="font-mono">
                {quizLink.id.slice(0, 8)}
              </Badge>
            </div>
            <Button onClick={onManageQuizLinks} variant="outline">
              <Settings2 className="size-4" /> Manage in Quiz Links
              <ArrowUpRight className="size-4" />
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              This QUIZ activity has no linked quiz link.
            </p>
            <Button onClick={onManageQuizLinks} variant="outline">
              <ArrowUpRight className="size-4" /> Open Quiz Links to attach one
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Q&A note
// ---------------------------------------------------------------------------

function QAndANote() {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-5">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/30">
          <MessageSquare className="size-4" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">Open-ended Q&A</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Participants submit questions during the session. You&apos;ll
            moderate them from the <strong>Live Results</strong> tab — approve,
            pin, mark as answered, or hide.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Questions section (with add/edit/delete + per-question cards)
// ---------------------------------------------------------------------------

function QuestionsSection({
  activityId,
  activityType,
  questions,
  isLoading,
}: {
  activityId: string
  activityType: ActivityType
  questions: ActivityQuestionDto[]
  isLoading: boolean
}) {
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ActivityQuestionDto | null>(null)
  const [form, setForm] = React.useState<QuestionFormState>(emptyQuestion)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] =
    React.useState<ActivityQuestionDto | null>(null)

  const allowedTypes = allowedQuestionTypes(activityType)
  const isSimple = activityType === "POLL" || activityType === "VOTING"

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<ActivityQuestionDto>(`/api/activities/${activityId}/questions`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity", activityId] })
      qc.invalidateQueries({ queryKey: ["activities"] })
      toast.success("Question added")
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      qid,
      payload,
    }: {
      qid: string
      payload: Record<string, unknown>
    }) =>
      api<ActivityQuestionDto>(
        `/api/activities/${activityId}/questions/${qid}`,
        { method: "PATCH", body: JSON.stringify(payload) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity", activityId] })
      toast.success("Question updated")
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (qid: string) =>
      api(`/api/activities/${activityId}/questions/${qid}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity", activityId] })
      qc.invalidateQueries({ queryKey: ["activities"] })
      toast.success("Question deleted")
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error("Failed: " + e.message),
  })

  function openCreate() {
    const firstType = allowedTypes[0]
    setEditing(null)
    setForm({
      text: "",
      type: firstType,
      options:
        firstType === "YES_NO"
          ? ["Yes", "No"]
          : ["", ""],
      required: true,
    })
    setErrors({})
    setDialogOpen(true)
  }

  function openEdit(q: ActivityQuestionDto) {
    setEditing(q)
    setForm(questionToForm(q))
    setErrors({})
    setDialogOpen(true)
  }

  function changeType(t: ActivityQuestionType) {
    setForm((f) => {
      const next: QuestionFormState = { ...f, type: t }
      if (t === "YES_NO") next.options = ["Yes", "No"]
      else if (!usesOptions(t)) next.options = []
      else if (f.options.length === 0 || (f.options.length === 2 && f.options[0] === "Yes" && f.options[1] === "No"))
        next.options = ["", ""]
      return next
    })
  }

  function submit() {
    const e: Record<string, string> = {}
    if (!form.text.trim()) e.text = "Question text is required"
    if (usesOptions(form.type)) {
      const opts = form.options.map((o) => o.trim()).filter(Boolean)
      if (opts.length < 2) e.options = "At least 2 options required"
    }
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const payload: Record<string, unknown> = {
      text: form.text.trim(),
      type: form.type,
      required: form.required,
    }
    if (usesOptions(form.type)) {
      payload.options = form.options.map((o) => o.trim()).filter(Boolean)
    }

    if (editing) {
      updateMutation.mutate({ qid: editing.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">
            {isSimple ? "Question & Options" : "Questions"}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {questions.length > 0 && `(${questions.length})`}
            </span>
          </CardTitle>
          <Button size="sm" onClick={openCreate} className="bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="size-4" /> Add question
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : questions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No questions yet. Click <strong>Add question</strong> to start.
            </p>
          </div>
        ) : (
          questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              onEdit={() => openEdit(q)}
              onDelete={() => setDeleteTarget(q)}
            />
          ))
        )}
      </CardContent>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit question" : "Add question"}
            </DialogTitle>
            <DialogDescription>
              {isSimple
                ? "Configure the question text and the options participants can choose from."
                : "Pick a question type, then enter the prompt and options."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="q-text">Question text</Label>
              <Textarea
                id="q-text"
                autoFocus
                rows={2}
                value={form.text}
                onChange={(e) =>
                  setForm((f) => ({ ...f, text: e.target.value }))
                }
                placeholder="e.g. Which session did you find most valuable?"
              />
              {errors.text && (
                <p className="text-xs text-rose-600">{errors.text}</p>
              )}
            </div>

            {!isSimple && (
              <div className="flex flex-col gap-2">
                <Label>Question type</Label>
                <Select value={form.type} onValueChange={(v) => changeType(v as ActivityQuestionType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ACTIVITY_QUESTION_TYPE_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {usesOptions(form.type) && (
              <div className="flex flex-col gap-2">
                <Label>
                  Options{" "}
                  <span className="text-xs text-muted-foreground">
                    (one per line)
                  </span>
                </Label>
                <div className="flex flex-col gap-2">
                  {form.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <GripVertical className="size-4 text-muted-foreground/50" />
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const opts = [...form.options]
                          opts[i] = e.target.value
                          setForm((f) => ({ ...f, options: opts }))
                        }}
                        placeholder={`Option ${i + 1}`}
                        disabled={
                          form.type === "YES_NO" &&
                          (opt === "Yes" || opt === "No")
                        }
                      />
                      {form.type !== "YES_NO" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-rose-600"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              options: f.options.filter((_, j) => j !== i),
                            }))
                          }
                          aria-label="Remove option"
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {form.type !== "YES_NO" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          options: [...f.options, ""],
                        }))
                      }
                    >
                      <Plus className="size-4" /> Add option
                    </Button>
                  )}
                </div>
                {errors.options && (
                  <p className="text-xs text-rose-600">{errors.options}</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Required</p>
                <p className="text-xs text-muted-foreground">
                  Participants must answer this question.
                </p>
              </div>
              <Switch
                checked={form.required}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, required: v }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={
                createMutation.isPending || updateMutation.isPending
              }
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={
                createMutation.isPending || updateMutation.isPending
              }
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {editing ? "Save changes" : "Add question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the question and any responses.
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
    </Card>
  )
}

function QuestionCard({
  question,
  index,
  onEdit,
  onDelete,
}: {
  question: ActivityQuestionDto
  index: number
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = ACTIVITY_QUESTION_TYPE_META[question.type]
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: Math.min(index * 0.03, 0.2) }}
      className="rounded-lg border bg-white p-3 dark:bg-slate-900/40"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {meta.label}
            </Badge>
            {question.required ? (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
              >
                Required
              </Badge>
            ) : (
              <Badge variant="outline" className="border-0 text-muted-foreground">
                Optional
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words">
            {question.text}
          </p>
          {question.options && question.options.length > 0 && (
            <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
              {question.options.map((opt, i) => (
                <li
                  key={i}
                  className="flex items-center gap-1.5 rounded bg-slate-50 px-2 py-1 dark:bg-slate-800/50"
                >
                  <span className="font-mono text-[10px] text-slate-500">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-rose-600"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Settings card — type-aware toggles
// ---------------------------------------------------------------------------

function SettingsCard({
  type,
  settings,
  onChange,
  saving,
}: {
  type: ActivityType
  settings: ActivitySettings
  onChange: (patch: Partial<ActivitySettings>) => void
  saving: boolean
}) {
  const toggles: Array<{
    key: keyof ActivitySettings
    label: string
    description: string
  }> = []

  if (type === "POLL" || type === "KNOWLEDGE_CHECK" || type === "PRE_POST_ASSESSMENT") {
    toggles.push({
      key: "allowMultiple",
      label: "Allow multiple selections",
      description: "Let participants select more than one option.",
    })
  }
  if (
    type === "SURVEY" ||
    type === "FEEDBACK" ||
    type === "Q_AND_A" ||
    type === "KNOWLEDGE_CHECK"
  ) {
    toggles.push({
      key: "anonymous",
      label: "Anonymous responses",
      description: "Don't capture participant identity.",
    })
  }
  if (
    type === "POLL" ||
    type === "VOTING" ||
    type === "SURVEY" ||
    type === "FEEDBACK" ||
    type === "KNOWLEDGE_CHECK"
  ) {
    toggles.push({
      key: "showResults",
      label: "Show results to participants",
      description: "Participants see live tallies after answering.",
    })
    toggles.push({
      key: "hideResultsUntilClosed",
      label: "Hide results until closed",
      description: "Only reveal totals when the activity is closed.",
    })
  }
  if (type === "Q_AND_A") {
    toggles.push({
      key: "anonymous",
      label: "Allow anonymous questions",
      description: "Let participants ask without their name.",
    })
    toggles.push({
      key: "showResults",
      label: "Show all questions publicly",
      description: "If off, only approved questions are visible.",
    })
  }

  if (toggles.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="size-4 text-muted-foreground" />
          Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {toggles.map((t) => (
          <div
            key={t.key}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </div>
            <Switch
              checked={Boolean(settings?.[t.key])}
              onCheckedChange={(v) => onChange({ [t.key]: v })}
              disabled={saving}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
