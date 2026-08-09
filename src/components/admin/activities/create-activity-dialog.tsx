"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, ArrowLeft, ArrowRight } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { api, ACTIVITY_TYPE_META, ACTIVITY_TYPE_ORDER } from "./api"
import type {
  ActivityDto,
  ActivityType,
  QuizLinkDto,
} from "@/types"

interface CreateActivityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  /** Called after a successful create. Used to open the editor for POLL/VOTING. */
  onCreated?: (activity: ActivityDto) => void
}

interface FormState {
  type: ActivityType | null
  title: string
  description: string
  session: string
  quizLinkId: string
}

const emptyForm: FormState = {
  type: null,
  title: "",
  description: "",
  session: "",
  quizLinkId: "",
}

export function CreateActivityDialog({
  open,
  onOpenChange,
  eventId,
  onCreated,
}: CreateActivityDialogProps) {
  const qc = useQueryClient()
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Pre-fetch quiz links for the event (used when type === QUIZ).
  const quizLinksQuery = useQuery<QuizLinkDto[]>({
    queryKey: ["quiz-links", "by-event", eventId],
    queryFn: () =>
      api<QuizLinkDto[]>(`/api/quiz-links?eventId=${encodeURIComponent(eventId)}`),
    enabled: !!eventId && form.type === "QUIZ",
  })

  React.useEffect(() => {
    if (!open) {
      // Reset state when dialog closes (after animation finishes).
      const t = setTimeout(() => {
        setForm(emptyForm)
        setErrors({})
      }, 200)
      return () => clearTimeout(t)
    }
  }, [open])

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<ActivityDto>("/api/activities", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["activities", eventId] })
      toast.success("Activity created")
      onOpenChange(false)
      onCreated?.(created)
    },
    onError: (e: Error) => toast.error("Failed to create activity: " + e.message),
  })

  function pickType(t: ActivityType) {
    setForm((f) => ({ ...f, type: t }))
  }

  function backToTypePicker() {
    setForm((f) => ({ ...f, type: null }))
    setErrors({})
  }

  function submit() {
    if (!form.type) {
      setErrors({ type: "Pick an activity type" })
      return
    }
    const title = form.title.trim()
    if (!title) {
      setErrors({ title: "Title is required" })
      return
    }
    if (form.type === "QUIZ" && !form.quizLinkId) {
      setErrors({ quizLinkId: "Select a quiz link" })
      return
    }

    const payload: Record<string, unknown> = {
      eventId,
      type: form.type,
      title,
    }
    if (form.description.trim()) payload.description = form.description.trim()
    if (form.session.trim()) payload.session = form.session.trim()
    if (form.type === "QUIZ") payload.quizLinkId = form.quizLinkId

    // Type-appropriate default settings.
    const settings: Record<string, unknown> = {}
    if (form.type === "POLL" || form.type === "VOTING") {
      settings.showResults = true
    } else if (form.type === "Q_AND_A") {
      settings.anonymous = false
      settings.showResults = true
    } else if (form.type === "SURVEY" || form.type === "FEEDBACK") {
      settings.anonymous = true
      settings.showResults = false
    }
    if (Object.keys(settings).length > 0) payload.settings = settings

    createMutation.mutate(payload)
  }

  const isQuiz = form.type === "QUIZ"
  const isTypePicked = !!form.type

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isTypePicked && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={backToTypePicker}
                aria-label="Back to type picker"
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            {isTypePicked
              ? `New ${form.type ? ACTIVITY_TYPE_META[form.type].label : "Activity"}`
              : "New Activity"}
          </DialogTitle>
          <DialogDescription>
            {isTypePicked
              ? "Add a title and you're done — details are configured in the editor."
              : "Pick an activity type. You can configure questions next."}
          </DialogDescription>
        </DialogHeader>

        {!isTypePicked ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {ACTIVITY_TYPE_ORDER.map((t) => {
              const meta = ACTIVITY_TYPE_META[t]
              const Icon = meta.icon
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickType(t)}
                  className={cn(
                    "group relative flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700/60 dark:hover:bg-emerald-500/5"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-9 items-center justify-center rounded-lg ring-1 transition-transform group-hover:scale-105",
                      meta.iconWrap
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {meta.label}
                  </span>
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    {meta.short}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {form.type && (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/5">
                {(() => {
                  const meta = ACTIVITY_TYPE_META[form.type]
                  const Icon = meta.icon
                  return (
                    <>
                      <span
                        className={cn(
                          "inline-flex size-9 items-center justify-center rounded-lg ring-1",
                          meta.iconWrap
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {meta.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {meta.description}
                        </p>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="act-title">
                Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="act-title"
                autoFocus
                placeholder="e.g. Post-session pulse check"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                }}
              />
              {errors.title && (
                <p className="text-xs text-rose-600">{errors.title}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="act-desc">Description (optional)</Label>
              <Textarea
                id="act-desc"
                placeholder="What is this activity for?"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="act-session">Session (optional)</Label>
                <Input
                  id="act-session"
                  placeholder="e.g. Day 1 — Morning"
                  value={form.session}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, session: e.target.value }))
                  }
                />
              </div>

              {isQuiz && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="act-quizlink">
                    Quiz Link <span className="text-rose-500">*</span>
                  </Label>
                  {quizLinksQuery.isLoading ? (
                    <Skeleton className="h-9 w-full" />
                  ) : quizLinksQuery.isError ? (
                    <p className="text-xs text-rose-600">
                      Could not load quiz links.
                    </p>
                  ) : (quizLinksQuery.data?.length ?? 0) === 0 ? (
                    <p className="text-xs text-amber-600">
                      No quiz links found for this event. Create one in the
                      Quiz Links tab first.
                    </p>
                  ) : (
                    <Select
                      value={form.quizLinkId}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, quizLinkId: v }))
                      }
                    >
                      <SelectTrigger id="act-quizlink" className="w-full">
                        <SelectValue placeholder="Pick a quiz link" />
                      </SelectTrigger>
                      <SelectContent>
                        {quizLinksQuery.data?.map((ql) => (
                          <SelectItem key={ql.id} value={ql.id}>
                            {ql.slug} · {ql.questionCount} Qs ·{" "}
                            {ql.timeLimit}m
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {errors.quizLinkId && (
                    <p className="text-xs text-rose-600">{errors.quizLinkId}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          {isTypePicked && (
            <Button
              onClick={submit}
              disabled={createMutation.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create activity
              <ArrowRight className="size-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
