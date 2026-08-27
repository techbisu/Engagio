"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  ClipboardList,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Info,
  Type,
  Mail,
  Hash,
  Phone,
  Calendar,
  ListChecks,
  CheckSquare,
  AlignLeft,
  Eye,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
import { cn } from "@/lib/utils"

import { api } from "./api"
import type { EventDto, EventFieldDto, EventFieldType } from "@/types"

interface RegistrationFormBuilderProps {
  eventId: string
  eventTitle: string
  onBack: () => void
}

interface FieldFormState {
  label: string
  type: EventFieldType
  required: boolean
  placeholder: string
  helpText: string
  options: string // newline-separated options for select
}

const emptyFieldForm: FieldFormState = {
  label: "",
  type: "text",
  required: true,
  placeholder: "",
  helpText: "",
  options: "",
}

const TYPE_OPTIONS: {
  value: EventFieldType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { value: "text", label: "Text", description: "Single line input", icon: Type },
  { value: "textarea", label: "Paragraph", description: "Long text area", icon: AlignLeft },
  { value: "email", label: "Email", description: "Email validation", icon: Mail },
  { value: "number", label: "Number", description: "Numeric input", icon: Hash },
  { value: "tel", label: "Phone", description: "Telephone input", icon: Phone },
  { value: "date", label: "Date", description: "Date picker", icon: Calendar },
  { value: "select", label: "Dropdown", description: "Choose from list", icon: ListChecks },
  { value: "checkbox", label: "Checkbox", description: "Yes / No toggle", icon: CheckSquare },
]

const TYPE_LABEL: Record<EventFieldType, string> = {
  text: "Text",
  textarea: "Paragraph",
  email: "Email",
  number: "Number",
  tel: "Phone",
  date: "Date",
  select: "Dropdown",
  checkbox: "Checkbox",
}

const TYPE_ICON: Record<EventFieldType, React.ComponentType<{ className?: string }>> = {
  text: Type,
  textarea: AlignLeft,
  email: Mail,
  number: Hash,
  tel: Phone,
  date: Calendar,
  select: ListChecks,
  checkbox: CheckSquare,
}

const SHOWS_PLACEHOLDER: EventFieldType[] = ["text", "email", "number", "tel", "textarea", "date"]

function parseOptions(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

export function RegistrationFormBuilder({
  eventId,
  eventTitle,
  onBack,
}: RegistrationFormBuilderProps) {
  const qc = useQueryClient()

  // Event details for requireRegistration toggle.
  const { data: event } = useQuery<EventDto>({
    queryKey: ["event", eventId],
    queryFn: () => api<EventDto>(`/api/events/${eventId}`),
    enabled: !!eventId,
  })

  const {
    data: fields,
    isLoading,
    isError,
    error,
  } = useQuery<EventFieldDto[]>({
    queryKey: ["fields", eventId],
    queryFn: () => api<EventFieldDto[]>(`/api/events/${eventId}/fields`),
    enabled: !!eventId,
  })

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<EventFieldDto | null>(null)
  const [form, setForm] = React.useState<FieldFormState>(emptyFieldForm)
  const [errors, setErrors] = React.useState<Partial<Record<keyof FieldFormState, string>>>({})
  const [deleteTarget, setDeleteTarget] = React.useState<EventFieldDto | null>(null)

  // Toggle requireRegistration on the event.
  const toggleMutation = useMutation({
    mutationFn: (next: boolean) =>
      api<EventDto>(`/api/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ requireRegistration: next }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", eventId] })
      qc.invalidateQueries({ queryKey: ["events"] })
      toast.success("Registration setting updated")
    },
    onError: (e: Error) => toast.error("Failed to update setting: " + e.message),
  })

  const createMutation = useMutation({
    mutationFn: (payload: FieldFormState) =>
      api<EventFieldDto>(`/api/events/${eventId}/fields`, {
        method: "POST",
        body: JSON.stringify({
          label: payload.label.trim(),
          type: payload.type,
          required: payload.required,
          placeholder: SHOWS_PLACEHOLDER.includes(payload.type)
            ? payload.placeholder.trim() || null
            : null,
          helpText: payload.helpText.trim() || null,
          options: payload.type === "select" ? parseOptions(payload.options) : [],
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fields", eventId] })
      qc.invalidateQueries({ queryKey: ["events"] })
      toast.success("Field added")
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error("Failed to add field: " + e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FieldFormState }) =>
      api<EventFieldDto>(`/api/fields/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: payload.label.trim(),
          type: payload.type,
          required: payload.required,
          placeholder: SHOWS_PLACEHOLDER.includes(payload.type)
            ? payload.placeholder.trim() || null
            : null,
          helpText: payload.helpText.trim() || null,
          options: payload.type === "select" ? parseOptions(payload.options) : [],
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fields", eventId] })
      qc.invalidateQueries({ queryKey: ["events"] })
      toast.success("Field updated")
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error("Failed to update field: " + e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/fields/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fields", eventId] })
      qc.invalidateQueries({ queryKey: ["events"] })
      toast.success("Field deleted")
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error("Failed to delete field: " + e.message),
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, order }: { id: string; order: number }) =>
      api(`/api/fields/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ order }),
      }),
    onMutate: async ({ id, order }) => {
      await qc.cancelQueries({ queryKey: ["fields", eventId] })
      const prev = qc.getQueryData<EventFieldDto[]>(["fields", eventId])
      if (prev) {
        qc.setQueryData<EventFieldDto[]>(["fields", eventId], (curr) =>
          (curr || []).map((f) => (f.id === id ? { ...f, order } : f))
        )
      }
      return { prev }
    },
    onError: (e: Error) => {
      toast.error("Failed to reorder: " + e.message)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["fields", eventId] })
    },
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyFieldForm)
    setErrors({})
    setDialogOpen(true)
  }

  function openEdit(f: EventFieldDto) {
    setEditing(f)
    setForm({
      label: f.label,
      type: f.type,
      required: f.required,
      placeholder: f.placeholder || "",
      helpText: f.helpText || "",
      options: (f.options || []).join("\n"),
    })
    setErrors({})
    setDialogOpen(true)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FieldFormState, string>> = {}
    if (!form.label.trim()) e.label = "Label is required"
    else if (form.label.length > 80) e.label = "Label too long (max 80)"
    if (form.type === "select") {
      const opts = parseOptions(form.options)
      if (opts.length < 2) e.options = "Add at least 2 options"
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

  function handleToggle(next: boolean) {
    if (toggleMutation.isPending) return
    toggleMutation.mutate(next)
  }

  const list = (fields || []).slice().sort((a, b) => a.order - b.order)
  const requireOn = !!event?.requireRegistration

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2 text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to events
        </Button>
        <div>
          <h2 className="text-xl font-semibold tracking-tight truncate">
            Registration Form —{" "}
            <span className="text-emerald-700 dark:text-emerald-400">{eventTitle}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Define custom fields participants must complete before attempting a quiz.
          </p>
        </div>
      </div>

      {/* Master toggle */}
      <Card
        className={cn(
          "border transition-colors",
          requireOn
            ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5"
            : "border-slate-200 dark:border-slate-800"
        )}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <ClipboardList className="size-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-semibold leading-tight">
                  Require registration for this event
                </h3>
              </div>
              <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                <Info className="size-3.5 mt-0.5 shrink-0 opacity-70" />
                <span>
                  When ON, participants must fill out this form before they can attempt any quiz for
                  this event. Add at least one field below.
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={cn(
                  "text-xs font-medium",
                  requireOn ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                )}
              >
                {requireOn ? "Required" : "Optional"}
              </span>
              <Switch
                checked={requireOn}
                onCheckedChange={handleToggle}
                disabled={toggleMutation.isPending}
                aria-label="Require registration for this event"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {isError && (
        <Card className="border-rose-200 dark:border-rose-500/30">
          <CardContent className="pt-6 text-sm text-rose-600 dark:text-rose-400">
            Failed to load fields: {(error as Error)?.message || "Unknown error"}
          </CardContent>
        </Card>
      )}

      {/* Fields list + Live Preview */}
      <Tabs defaultValue="editor" className="w-full">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">Fields</h3>
            <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800/60">
              {list.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <TabsList className="bg-slate-100 dark:bg-slate-800/60">
              <TabsTrigger value="editor" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
                Editor
              </TabsTrigger>
              <TabsTrigger value="preview" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900">
                <Eye className="size-3.5 mr-1" />
                Live Preview
              </TabsTrigger>
            </TabsList>
            <Button
              onClick={openCreate}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="size-4" />
              Add Field
            </Button>
          </div>
        </div>

        <TabsContent value="editor" className="mt-3 space-y-2.5">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <Card>
              <CardContent className="py-14 flex flex-col items-center text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <ClipboardList className="size-7" />
                </div>
                <p className="mt-4 text-lg font-semibold">No fields yet</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  Add fields like Name, Phone, College, or Year. Participants will fill these in when
                  registering for the event.
                </p>
                <Button
                  className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={openCreate}
                >
                  <Plus className="size-4" />
                  Add your first field
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {list.map((f, idx) => {
                const Icon = TYPE_ICON[f.type] || Type
                return (
                  <Card key={f.id} className="overflow-hidden">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-0.5 pt-0.5">
                          <GripVertical className="size-4 text-slate-300 dark:text-slate-600" />
                          <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                            {idx + 1}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold leading-tight">{f.label}</span>
                            <Badge
                              variant="outline"
                              className="gap-1 bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                            >
                              <Icon className="size-3" />
                              {TYPE_LABEL[f.type]}
                            </Badge>
                            {f.required && (
                              <Badge
                                variant="outline"
                                className="bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30"
                              >
                                Required
                              </Badge>
                            )}
                          </div>

                          {f.placeholder && (
                            <p className="text-xs text-muted-foreground">
                              <span className="text-slate-500 dark:text-slate-400">Placeholder:</span>{" "}
                              <span className="font-mono">{f.placeholder}</span>
                            </p>
                          )}

                          {f.helpText && (
                            <p className="text-xs italic text-muted-foreground">{f.helpText}</p>
                          )}

                          {f.type === "select" && f.options.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {f.options.map((opt, i) => (
                                <Badge
                                  key={`${opt}-${i}`}
                                  variant="outline"
                                  className="bg-emerald-50/60 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30"
                                >
                                  {opt}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              disabled={idx === 0 || moveMutation.isPending}
                              onClick={() => {
                                const prev = list[idx - 1]
                                if (!prev) return
                                moveMutation.mutate({ id: f.id, order: prev.order })
                                moveMutation.mutate({ id: prev.id, order: f.order })
                              }}
                              aria-label="Move up"
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              disabled={idx === list.length - 1 || moveMutation.isPending}
                              onClick={() => {
                                const next = list[idx + 1]
                                if (!next) return
                                moveMutation.mutate({ id: f.id, order: next.order })
                                moveMutation.mutate({ id: next.id, order: f.order })
                              }}
                              aria-label="Move down"
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                          </div>
                          <Separator orientation="vertical" className="h-8 mx-0.5" />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openEdit(f)}
                            aria-label="Edit field"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            onClick={() => setDeleteTarget(f)}
                            aria-label="Delete field"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="preview" className="mt-3">
          <FullFormPreview fields={list} eventTitle={eventTitle} requireOn={requireOn} />
        </TabsContent>
      </Tabs>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Field" : "Add Field"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the configuration of this registration field."
                : "Configure a new field participants will complete when registering."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="f-label">Label *</Label>
              <Input
                id="f-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Full Name"
                maxLength={80}
                aria-invalid={!!errors.label}
              />
              {errors.label && <p className="text-xs text-rose-500">{errors.label}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-type">Type *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const active = form.type === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, type: opt.value })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                        active
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/40"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      )}
                      aria-pressed={active}
                      aria-label={`${opt.label} — ${opt.description}`}
                    >
                      <Icon className={cn("size-5", active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400")} />
                      <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight line-clamp-1">{opt.description}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-0.5">
                <Info className="size-3 opacity-70" />
                Selected: <span className="font-medium text-foreground">{TYPE_OPTIONS.find(o => o.value === form.type)?.label}</span>
              </p>
            </div>

            {SHOWS_PLACEHOLDER.includes(form.type) && (
              <div className="space-y-1.5">
                <Label htmlFor="f-placeholder">Placeholder</Label>
                <Input
                  id="f-placeholder"
                  value={form.placeholder}
                  onChange={(e) =>
                    setForm({ ...form, placeholder: e.target.value })
                  }
                  placeholder="e.g. John Doe"
                />
              </div>
            )}

            {form.type === "select" && (
              <div className="space-y-1.5">
                <Label htmlFor="f-options">Options (one per line) *</Label>
                <Textarea
                  id="f-options"
                  rows={5}
                  value={form.options}
                  onChange={(e) => setForm({ ...form, options: e.target.value })}
                  placeholder={"First Year\nSecond Year\nThird Year\nFourth Year"}
                  aria-invalid={!!errors.options}
                />
                <p className="text-xs text-muted-foreground">
                  {parseOptions(form.options).length} option
                  {parseOptions(form.options).length === 1 ? "" : "s"}
                </p>
                {errors.options && (
                  <p className="text-xs text-rose-500">{errors.options}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="f-help">Help text</Label>
              <Input
                id="f-help"
                value={form.helpText}
                onChange={(e) => setForm({ ...form, helpText: e.target.value })}
                placeholder="Optional guidance shown beneath the field"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="f-required" className="cursor-pointer">
                  Required
                </Label>
                <p className="text-xs text-muted-foreground">
                  Participants cannot submit the form without filling this in.
                </p>
              </div>
              <Switch
                id="f-required"
                checked={form.required}
                onCheckedChange={(v) => setForm({ ...form, required: v })}
              />
            </div>

            {/* Live preview */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Live preview
              </p>
              <FieldPreview form={form} />
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
              {editing ? "Save changes" : "Add field"}
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
            <AlertDialogTitle>Delete field?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{deleteTarget?.label}&quot; from the registration form.
              Existing registrations will keep their submitted values.
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

function FieldPreview({ form }: { form: FieldFormState }) {
  const label = form.label.trim() || "Field label"
  const placeholder = form.placeholder.trim() || "Placeholder text"
  const options = parseOptions(form.options)

  return (
    <div className="rounded-lg border bg-slate-50/60 p-3 dark:bg-slate-900/40">
      <Label className="text-xs font-medium">
        {label}
        {form.required && <span className="text-rose-500"> *</span>}
      </Label>
      <div className="mt-1.5">
        {form.type === "textarea" ? (
          <Textarea
            rows={2}
            placeholder={placeholder}
            disabled
            className="bg-white dark:bg-slate-950"
          />
        ) : form.type === "select" ? (
          <Select value="" disabled>
            <SelectTrigger className="w-full bg-white dark:bg-slate-950">
              <SelectValue
                placeholder={
                  options.length > 0 ? `Choose from ${options.length}...` : "Add options above"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt, i) => (
                <SelectItem key={i} value={String(i)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : form.type === "checkbox" ? (
          <div className="flex items-center gap-2 py-1.5">
            <Switch checked={false} disabled aria-label={label} />
            <span className="text-sm text-muted-foreground">Yes / No toggle</span>
          </div>
        ) : (
          <Input
            type={
              form.type === "email"
                ? "email"
                : form.type === "number"
                ? "number"
                : form.type === "tel"
                ? "tel"
                : form.type === "date"
                ? "date"
                : "text"
            }
            placeholder={placeholder}
            disabled
            className="bg-white dark:bg-slate-950"
          />
        )}
      </div>
      {form.helpText.trim() && (
        <p className="mt-1 text-xs italic text-muted-foreground">{form.helpText.trim()}</p>
      )}
    </div>
  )
}

/**
 * Full-form preview — renders every saved field exactly as a participant
 * would see it during registration. Used in the "Live Preview" tab next to
 * the field editor list.
 */
function FullFormPreview({
  fields,
  eventTitle,
  requireOn,
}: {
  fields: EventFieldDto[]
  eventTitle: string
  requireOn: boolean
}) {
  if (!requireOn && fields.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
            <Eye className="size-6" />
          </div>
          <p className="mt-3 font-semibold">Nothing to preview yet</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Turn on <span className="font-medium text-foreground">"Require registration"</span> and
            add at least one field to see a live preview of the registration form.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (fields.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
            <Eye className="size-6" />
          </div>
          <p className="mt-3 font-semibold">No fields to preview</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Add at least one field in the Editor tab to see how participants will fill out the
            registration form.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Phone frame */}
      <div className="mx-auto w-full max-w-[360px]">
        <div className="overflow-hidden rounded-[2rem] border-4 border-slate-900 bg-slate-900 shadow-2xl dark:border-slate-700">
          <div className="bg-slate-900 px-4 pt-2 pb-1.5 text-center">
            <div className="mx-auto size-1.5 rounded-full bg-slate-600" />
          </div>
          <div className="bg-white dark:bg-slate-950 min-h-[420px] flex flex-col">
            <div className="border-b bg-gradient-to-br from-emerald-50 to-teal-50 px-5 py-4 dark:from-emerald-500/10 dark:to-teal-500/10">
              <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Registration
              </p>
              <h3 className="mt-0.5 text-base font-bold leading-tight">{eventTitle}</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Please complete the form below to register.
              </p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: 360 }}>
              {fields.map((f) => (
                <FullFormPreviewField key={f.id} field={f} />
              ))}
            </div>
            <div className="border-t p-3">
              <div className="rounded-lg bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white">
                Submit Registration
              </div>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                By submitting you agree to our Terms & Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Plain form view */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Eye className="size-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-semibold">Participant view</p>
        </div>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="space-y-4 p-5">
            <div>
              <h3 className="text-lg font-semibold leading-tight">{eventTitle}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Fields shown below appear in the order participants will see them.
              </p>
            </div>
            <Separator />
            <div className="space-y-4">
              {fields.map((f) => (
                <FullFormPreviewField key={f.id} field={f} plain />
              ))}
            </div>
            <Separator />
            <div className="rounded-lg bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white">
              Submit Registration
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function FullFormPreviewField({
  field,
  plain = false,
}: {
  field: EventFieldDto
  plain?: boolean
}) {
  const placeholder = field.placeholder || "Enter your response"
  return (
    <div className={plain ? "space-y-1.5" : "space-y-1"}>
      <label className={cn("block font-medium", plain ? "text-sm" : "text-[11px] font-semibold")}>
        {field.label}
        {field.required && <span className="text-rose-500"> *</span>}
      </label>
      {field.type === "textarea" ? (
        <Textarea
          rows={plain ? 3 : 2}
          placeholder={placeholder}
          disabled
          className={cn(plain ? "bg-transparent" : "bg-slate-50 dark:bg-slate-900", "resize-none")}
        />
      ) : field.type === "select" ? (
        <Select value="" disabled>
          <SelectTrigger className={cn("w-full", plain ? "bg-transparent" : "bg-slate-50 dark:bg-slate-900")}>
            <SelectValue
              placeholder={
                field.options.length > 0
                  ? `Choose from ${field.options.length} options`
                  : "No options defined"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt, i) => (
              <SelectItem key={i} value={String(i)}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "checkbox" ? (
        <div className="flex items-center gap-2 py-1">
          <Switch checked={false} disabled aria-label={field.label} />
          <span className="text-sm text-muted-foreground">Yes</span>
        </div>
      ) : (
        <Input
          type={
            field.type === "email"
              ? "email"
              : field.type === "number"
              ? "number"
              : field.type === "tel"
              ? "tel"
              : field.type === "date"
              ? "date"
              : "text"
          }
          placeholder={placeholder}
          disabled
          className={cn(plain ? "bg-transparent" : "bg-slate-50 dark:bg-slate-900")}
        />
      )}
      {field.helpText && (
        <p className={cn("italic text-muted-foreground", plain ? "text-xs" : "text-[10px]")}>
          {field.helpText}
        </p>
      )}
    </div>
  )
}
