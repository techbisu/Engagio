"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Send,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { api } from "./api"
import type { EventFieldDto } from "./api"

export interface RegistrationFormProps {
  eventId: string
  eventTitle: string
  onRegistered: () => void
  onBack: () => void
}

type FieldValue = string | number | boolean
type FieldErrors = Record<string, string>

interface RegCheckResponse {
  registered: boolean
  registration?: {
    id: string
    createdAt: string
    data: Record<string, unknown>
  }
}

interface SubmitResponse {
  id: string
  eventId: string
  userId: string
  createdAt: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RegistrationForm({
  eventId,
  eventTitle,
  onRegistered,
  onBack,
}: RegistrationFormProps) {
  const qc = useQueryClient()

  // Fetch the list of event fields (ordered server-side, but we re-sort to be safe)
  const {
    data: fields,
    isLoading: fieldsLoading,
    isError: fieldsError,
    error: fieldsErr,
  } = useQuery<EventFieldDto[]>({
    queryKey: ["fields", eventId],
    queryFn: () => api<EventFieldDto[]>(`/api/events/${eventId}/fields`),
    retry: false,
  })

  // Check if the user is already registered — pre-fill the form with the
  // existing data so they can review or update it.
  const { data: regCheck } = useQuery<RegCheckResponse>({
    queryKey: ["registration-check", eventId],
    queryFn: () =>
      api<RegCheckResponse>(
        `/api/registrations/check?eventId=${encodeURIComponent(eventId)}`,
      ),
    retry: false,
  })

  const orderedFields = React.useMemo(() => {
    if (!fields) return []
    return [...fields].sort((a, b) => a.order - b.order)
  }, [fields])

  const [values, setValues] = React.useState<Record<string, FieldValue>>({})
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const hydratedRef = React.useRef(false)

  // Pre-fill form once, when both the fields list AND the reg-check query
  // have resolved. (If the user has never registered, regCheck.data is
  // { registered: false } — we still pre-fill with empty values.)
  React.useEffect(() => {
    if (hydratedRef.current) return
    if (orderedFields.length === 0) return
    if (regCheck === undefined) return
    const next: Record<string, FieldValue> = {}
    for (const f of orderedFields) {
      const existing = regCheck.registration?.data?.[f.id]
      if (f.type === "checkbox") {
        next[f.id] = existing === true || existing === "true"
      } else if (f.type === "number") {
        if (typeof existing === "number") next[f.id] = existing
        else if (typeof existing === "string") next[f.id] = existing
        else next[f.id] = ""
      } else {
        next[f.id] = typeof existing === "string" ? existing : ""
      }
    }
    setValues(next)
    hydratedRef.current = true
  }, [orderedFields, regCheck])

  const setValue = (id: string, v: FieldValue) => {
    setValues((prev) => ({ ...prev, [id]: v }))
    setErrors((prev) => {
      if (!prev[id]) return prev
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  const validate = (): boolean => {
    const errs: FieldErrors = {}
    for (const f of orderedFields) {
      const v = values[f.id]
      if (f.required) {
        if (f.type === "checkbox") {
          if (v !== true) errs[f.id] = "Please check this box to continue."
        } else if (typeof v !== "string" || v.trim() === "") {
          errs[f.id] = "This field is required."
        }
      }
      if (f.type === "email" && typeof v === "string" && v.trim() !== "") {
        if (!EMAIL_REGEX.test(v.trim())) {
          errs[f.id] = "Please enter a valid email address."
        }
      }
      if (f.type === "number" && typeof v === "string" && v.trim() !== "") {
        if (Number.isNaN(Number(v))) {
          errs[f.id] = "Please enter a valid number."
        }
      }
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the highlighted fields and try again.")
      return false
    }
    return true
  }

  const submitMutation = useMutation({
    mutationFn: () => {
      const data: Record<string, string | number | boolean> = {}
      for (const f of orderedFields) {
        const v = values[f.id]
        if (f.type === "checkbox") {
          data[f.id] = v === true
        } else if (f.type === "number") {
          if (typeof v === "string" && v.trim() !== "") data[f.id] = Number(v)
          else data[f.id] = ""
        } else {
          data[f.id] = typeof v === "string" ? v : ""
        }
      }
      return api<SubmitResponse>("/api/registrations", {
        method: "POST",
        body: JSON.stringify({ eventId, data }),
      })
    },
    onSuccess: () => {
      toast.success("Registration complete! You can now start the quiz.")
      // Trigger a refetch of the reg-check query (same key used by the
      // parent QuizStart) so the gate flips and the pre-quiz card renders.
      qc.invalidateQueries({ queryKey: ["registration-check", eventId] })
      onRegistered()
    },
    onError: (err: Error) => {
      toast.error(
        err.message ||
          "We couldn't submit your registration. Please try again.",
      )
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    submitMutation.mutate()
  }

  // ---- Loading -----------------------------------------------------------
  if (fieldsLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4 text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="mt-2 h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-1/3" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Error loading fields ---------------------------------------------
  if (fieldsError) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4 text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-lg">Couldn&apos;t load the form</CardTitle>
            <CardDescription>
              {fieldsErr instanceof Error
                ? fieldsErr.message
                : "Please try again in a moment."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Empty state: event has no fields ---------------------------------
  if (orderedFields.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4 text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{eventTitle}</CardTitle>
            <CardDescription>
              No registration required — you can proceed to the quiz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={onRegistered}
            >
              <Send className="size-4" /> Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isPreFilled = !!regCheck?.registered

  // ---- Main form --------------------------------------------------------
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-4 text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Button>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <ClipboardList className="size-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-xl">{eventTitle}</CardTitle>
              <CardDescription className="text-xs">
                Registration required
              </CardDescription>
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Please complete this registration form to access the quiz. Your
            responses will be shared with the event organizer.
          </div>

          {isPreFilled && (
            <Badge
              variant="outline"
              className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
            >
              <CheckCircle2 className="size-3" /> Already registered — edit and
              resubmit to update
            </Badge>
          )}
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            {orderedFields.map((field, idx) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={values[field.id]}
                error={errors[field.id]}
                onChange={(v) => setValue(field.id, v)}
                showSeparator={idx > 0}
              />
            ))}

            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900/40">
              <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                Your information is stored securely and used only to administer
                this event.
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                className="sm:order-1"
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
              <Button
                type="submit"
                disabled={submitMutation.isPending}
                className="bg-emerald-600 text-white hover:bg-emerald-700 sm:order-2"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Submitting…
                  </>
                ) : isPreFilled ? (
                  <>
                    <Send className="size-4" /> Update registration
                  </>
                ) : (
                  <>
                    <Send className="size-4" /> Submit registration
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </motion.div>
  )
}

// ---- Field renderer -----------------------------------------------------

interface FieldRendererProps {
  field: EventFieldDto
  value: FieldValue | undefined
  error?: string
  onChange: (v: FieldValue) => void
  showSeparator?: boolean
}

function FieldRenderer({
  field,
  value,
  error,
  onChange,
  showSeparator,
}: FieldRendererProps) {
  const strValue =
    typeof value === "string"
      ? value
      : typeof value === "number"
        ? String(value)
        : ""
  const boolValue = value === true
  const hasError = !!error

  const requiredMark = field.required ? (
    <span className="ml-0.5 text-red-500">*</span>
  ) : null

  if (field.type === "checkbox") {
    return (
      <div>
        {showSeparator && <Separator className="mb-5" />}
        <div className="space-y-1">
          <div className="flex items-start gap-2">
            <Checkbox
              id={`field-${field.id}`}
              checked={boolValue}
              onCheckedChange={(c) => onChange(c === true)}
              className="mt-0.5"
              aria-invalid={hasError}
            />
            <Label
              htmlFor={`field-${field.id}`}
              className="text-sm leading-relaxed font-normal"
            >
              {field.label}
              {requiredMark}
            </Label>
          </div>
          {field.helpText && (
            <p className="ml-6 text-xs text-muted-foreground">{field.helpText}</p>
          )}
          {error && (
            <p className="ml-6 text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  let input: React.ReactNode
  if (field.type === "textarea") {
    input = (
      <Textarea
        id={`field-${field.id}`}
        rows={3}
        placeholder={field.placeholder ?? undefined}
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={hasError}
      />
    )
  } else if (field.type === "select") {
    input = (
      <Select value={strValue} onValueChange={(v) => onChange(v)}>
        <SelectTrigger
          id={`field-${field.id}`}
          className="w-full"
          aria-invalid={hasError}
        >
          <SelectValue placeholder={field.placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  } else {
    input = (
      <Input
        id={`field-${field.id}`}
        type={field.type}
        placeholder={field.placeholder ?? undefined}
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={hasError}
      />
    )
  }

  return (
    <div>
      {showSeparator && <Separator className="mb-5" />}
      <div className="space-y-1.5">
        <Label
          htmlFor={`field-${field.id}`}
          className="text-sm font-medium"
        >
          {field.label}
          {requiredMark}
        </Label>
        {input}
        {field.helpText && (
          <p className="text-xs text-muted-foreground">{field.helpText}</p>
        )}
        {error && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
