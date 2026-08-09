"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  X,
  FileQuestion,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Code2,
  ListChecks,
  Type as TypeIcon,
  ToggleLeft,
  ImagePlus,
  FunctionSquare,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CloudinaryImageUpload } from "@/components/shared/cloudinary-image-upload"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn, truncate } from "@/lib/utils"
import { parseCsvQuestions, buildCsvTemplate } from "@/lib/csv"

import { api } from "./api"
import type { QuestionDto, QuestionType, MatchPair, QuestionDifficulty } from "@/types"

interface QuestionsManagerProps {
  eventId: string
  eventTitle?: string
  onBack?: () => void
}

// ---------------------------------------------------------------------------
// Type metadata
// ---------------------------------------------------------------------------

interface TypeInfo {
  label: string
  /** Tailwind classes for the badge. */
  badgeClass: string
  /** Lucide icon component. */
  icon: React.ComponentType<{ className?: string }>
}

const TYPE_INFO: Record<QuestionType, TypeInfo> = {
  MCQ: {
    label: "MCQ",
    badgeClass:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30 border-0",
    icon: ListChecks,
  },
  TRUE_FALSE: {
    label: "True / False",
    badgeClass:
      "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/30 border-0",
    icon: ToggleLeft,
  },
  FILL_BLANK: {
    label: "Fill Blank",
    badgeClass:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30 border-0",
    icon: TypeIcon,
  },
  MATCHING: {
    label: "Matching",
    badgeClass:
      "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30 border-0",
    icon: ListChecks,
  },
  CODING: {
    label: "Coding",
    badgeClass:
      "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30 border-0",
    icon: Code2,
  },
}

const TYPE_ORDER: QuestionType[] = [
  "MCQ",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCHING",
  "CODING",
]

const DIFFICULTY_INFO: Record<
  QuestionDifficulty,
  { label: string; badgeClass: string }
> = {
  EASY: {
    label: "Easy",
    badgeClass:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30 border-0",
  },
  MEDIUM: {
    label: "Medium",
    badgeClass:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30 border-0",
  },
  HARD: {
    label: "Hard",
    badgeClass:
      "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30 border-0",
  },
}

const DIFFICULTY_ORDER: QuestionDifficulty[] = ["EASY", "MEDIUM", "HARD"]

/**
 * Lightweight Unicode math symbols — no KaTeX / MathJax / LaTeX.
 * Each group is a row of clickable buttons that insert at the cursor.
 */
const MATH_SYMBOL_GROUPS: { name: string; symbols: string[] }[] = [
  {
    name: "Arithmetic",
    symbols: ["+", "−", "×", "÷", "±", "=", "≠", "<", ">", "≤", "≥", "≈"],
  },
  {
    name: "Math",
    symbols: ["√", "∑", "∏", "∫", "∞", "≈", "∝", "∂", "∇", "∈", "∉", "∅"],
  },
  {
    name: "Greek",
    symbols: ["α", "β", "γ", "δ", "θ", "λ", "μ", "π", "σ", "Ω", "φ", "ψ"],
  },
  {
    name: "Superscript",
    symbols: ["⁰", "¹", "²", "³", "⁴", "⁵", "ⁿ", "⁺", "⁻"],
  },
  {
    name: "Subscript",
    symbols: ["₀", "₁", "₂", "₃", "₄", "ₙ", "ₓ"],
  },
  {
    name: "Fractions",
    symbols: ["½", "⅓", "⅔", "¼", "¾", "⅛", "⅜"],
  },
]

const CODE_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "cpp",
  "csharp",
  "go",
  "ruby",
  "php",
  "sql",
] as const

const LETTERS = ["A", "B", "C", "D", "E", "F"]

/** Format a negative-marks value without trailing zeros (0.25 -> "0.25", 1 -> "1"). */
function formatNegative(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0"
  // Round to 2 decimals to avoid float noise, then strip trailing zeros.
  const rounded = Math.round(n * 100) / 100
  return rounded.toString()
}

/**
 * Compress an image File into a JPEG data URL.
 * - Resizes to fit within maxW×maxH (maintains aspect ratio).
 * - Re-encodes as JPEG at the given quality.
 * - If the result is still larger than maxBytes, iteratively drops quality
 *   (then dimensions) until it fits.
 * No external service / cloud upload — base64 stored in DB.
 */
function compressImage(
  file: File,
  maxW = 800,
  maxH = 600,
  quality = 0.8,
  maxBytes = 200 * 1024
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height
        if (width > maxW) {
          height = height * (maxW / width)
          width = maxW
        }
        if (height > maxH) {
          width = width * (maxH / height)
          height = maxH
        }
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(width))
        canvas.height = Math.max(1, Math.round(height))
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas context unavailable"))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        let q = quality
        let dataUrl = canvas.toDataURL("image/jpeg", q)
        while (dataUrl.length > maxBytes && q > 0.3) {
          q = Math.max(0.3, q - 0.1)
          dataUrl = canvas.toDataURL("image/jpeg", q)
        }
        // Last resort: shrink dimensions.
        if (dataUrl.length > maxBytes) {
          const scale = 0.7
          canvas.width = Math.max(1, Math.round(canvas.width * scale))
          canvas.height = Math.max(1, Math.round(canvas.height * scale))
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          dataUrl = canvas.toDataURL("image/jpeg", 0.5)
        }
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error("Could not decode image"))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error("Could not read file"))
    reader.readAsDataURL(file)
  })
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface QuestionFormState {
  type: QuestionType
  question: string
  options: string[] // MCQ only (4 slots)
  correctAnswer: number // MCQ / TRUE_FALSE (0/1 for T/F)
  correctText: string // FILL_BLANK / CODING reference solution
  matchPairs: MatchPair[] // MATCHING
  codeLanguage: string // CODING
  marks: number
  negativeMarks: number
  category: string
  explanation: string
  imageUrl: string | null // Cloudinary URL (or base64 data URL fallback)
  imageUrlPublicId: string | null // Cloudinary publicId for delete-on-replace
  difficulty: QuestionDifficulty // EASY | MEDIUM | HARD
  tags: string[] // free-form tags
}

function emptyForm(): QuestionFormState {
  return {
    type: "MCQ",
    question: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    correctText: "",
    matchPairs: [
      { left: "", right: "" },
      { left: "", right: "" },
    ],
    codeLanguage: "javascript",
    marks: 1,
    negativeMarks: 0,
    category: "",
    explanation: "",
    imageUrl: null,
    imageUrlPublicId: null,
    difficulty: "MEDIUM",
    tags: [],
  }
}

function formFromQuestion(q: QuestionDto): QuestionFormState {
  const opts = [...(q.options || [])]
  while (opts.length < 4) opts.push("")
  const pairs =
    q.matchPairs && q.matchPairs.length > 0
      ? q.matchPairs.map((p) => ({ left: p.left, right: p.right }))
      : [
          { left: "", right: "" },
          { left: "", right: "" },
        ]
  return {
    type: q.type,
    question: q.question,
    options: opts.slice(0, 4),
    correctAnswer: q.correctAnswer ?? 0,
    correctText: q.correctText || "",
    matchPairs: pairs,
    codeLanguage: q.codeLanguage || "javascript",
    marks: q.marks ?? 1,
    negativeMarks: q.negativeMarks ?? 0,
    category: q.category || "",
    explanation: q.explanation || "",
    imageUrl: q.imageUrl || null,
    imageUrlPublicId: q.imageUrlPublicId || null,
    difficulty: q.difficulty || "MEDIUM",
    tags: Array.isArray(q.tags) ? [...q.tags] : [],
  }
}

/** Build the API payload from form state. */
function formToPayload(form: QuestionFormState, eventId: string) {
  const base: Record<string, unknown> = {
    eventId,
    question: form.question.trim(),
    type: form.type,
    marks: form.marks,
    negativeMarks: form.negativeMarks,
    category: form.category.trim() || null,
    explanation: form.explanation.trim() || null,
    imageUrl: form.imageUrl || null,
    imageUrlPublicId: form.imageUrlPublicId || null,
    difficulty: form.difficulty,
    tags: form.tags,
  }

  if (form.type === "MCQ") {
    base.options = form.options.map((o) => o.trim()).filter(Boolean)
    base.correctAnswer = form.correctAnswer
  } else if (form.type === "TRUE_FALSE") {
    // Backend auto-generates the True/False options; we still send a 2-item
    // array so the contract is consistent.
    base.options = ["True", "False"]
    base.correctAnswer = form.correctAnswer // 0 = True, 1 = False
  } else if (form.type === "FILL_BLANK") {
    base.options = []
    base.correctAnswer = 0
    base.correctText = form.correctText.trim()
  } else if (form.type === "MATCHING") {
    base.options = []
    base.correctAnswer = 0
    base.matchPairs = form.matchPairs
      .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
      .filter((p) => p.left && p.right)
  } else if (form.type === "CODING") {
    base.options = []
    base.correctAnswer = 0
    base.correctText = form.correctText.trim()
    base.codeLanguage = form.codeLanguage
  }

  return base
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QuestionsManager({
  eventId,
  eventTitle,
  onBack,
}: QuestionsManagerProps) {
  const qc = useQueryClient()
  const { data, isLoading, isError, error } = useQuery<QuestionDto[]>({
    queryKey: ["questions", eventId],
    queryFn: () => api<QuestionDto[]>(`/api/questions?eventId=${eventId}`),
    enabled: !!eventId,
  })

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<QuestionDto | null>(null)
  const [form, setForm] = React.useState<QuestionFormState>(emptyForm())
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const [importOpen, setImportOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<QuestionDto | null>(
    null
  )

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<QuestionDto>("/api/questions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["questions", eventId] })
      qc.invalidateQueries({ queryKey: ["events"] })
      qc.invalidateQueries({ queryKey: ["analytics"] })
      toast.success("Question added")
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error("Failed to add question: " + e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Record<string, unknown>
    }) =>
      api<QuestionDto>(`/api/questions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["questions", eventId] })
      toast.success("Question updated")
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error("Failed to update question: " + e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/questions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["questions", eventId] })
      qc.invalidateQueries({ queryKey: ["events"] })
      qc.invalidateQueries({ queryKey: ["analytics"] })
      toast.success("Question deleted")
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error("Failed to delete question: " + e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setErrors({})
    setDialogOpen(true)
  }

  function openEdit(q: QuestionDto) {
    setEditing(q)
    setForm(formFromQuestion(q))
    setErrors({})
    setDialogOpen(true)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.question.trim()) e.question = "Question text is required"
    if (!form.marks || form.marks < 1) e.marks = "Marks must be ≥ 1"

    if (form.type === "MCQ") {
      const filled = form.options.filter((o) => o.trim())
      if (filled.length < 2)
        e.options = "At least 2 options are required for MCQ"
      if (
        form.correctAnswer < 0 ||
        form.correctAnswer >= filled.length
      ) {
        e.correctAnswer = "Select the correct answer"
      }
    } else if (form.type === "TRUE_FALSE") {
      if (form.correctAnswer !== 0 && form.correctAnswer !== 1) {
        e.correctAnswer = "Select True or False"
      }
    } else if (form.type === "FILL_BLANK") {
      if (!form.correctText.trim())
        e.correctText = "Correct answer text is required"
    } else if (form.type === "MATCHING") {
      const validPairs = form.matchPairs.filter(
        (p) => p.left.trim() && p.right.trim()
      )
      const partial = form.matchPairs.filter(
        (p) => (p.left.trim() && !p.right.trim()) || (!p.left.trim() && p.right.trim())
      )
      if (validPairs.length < 2)
        e.matchPairs = "At least 2 complete pairs are required"
      else if (partial.length > 0)
        e.matchPairs = "Each pair must have both a left and right value"
    } else if (form.type === "CODING") {
      if (!form.correctText.trim())
        e.correctText = "Reference solution is required"
    }

    if (
      (form.type === "MCQ" || form.type === "TRUE_FALSE") &&
      form.negativeMarks < 0
    ) {
      e.negativeMarks = "Negative marks cannot be less than 0"
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function submit() {
    if (!validate()) return
    const payload = formToPayload(form, eventId)
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const questions = data || []
  // Unique existing categories for the datalist suggestions.
  const categories = React.useMemo(
    () =>
      Array.from(
        new Set(questions.map((q) => q.category).filter(Boolean) as string[])
      ).sort((a, b) => a.localeCompare(b)),
    [questions]
  )
  // All tags used across this event's questions — for autocomplete.
  const allTags = React.useMemo(
    () =>
      Array.from(
        new Set(questions.flatMap((q) => q.tags || []))
      ).sort((a, b) => a.localeCompare(b)),
    [questions]
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="mb-1 -ml-2 text-muted-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to events
            </Button>
          )}
          <h2 className="text-xl font-semibold tracking-tight truncate">
            {eventTitle || "Questions"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {questions.length} question{questions.length === 1 ? "" : "s"} in
            this event.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Import CSV
          </Button>
          <Button
            onClick={openCreate}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="size-4" />
            Add Question
          </Button>
        </div>
      </div>

      {isError && (
        <Card className="border-rose-200 dark:border-rose-500/30">
          <CardContent className="pt-6 text-sm text-rose-600 dark:text-rose-400">
            Failed to load questions:{" "}
            {(error as Error)?.message || "Unknown error"}
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
        ) : questions.length === 0 ? (
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <FileQuestion className="size-7" />
            </div>
            <p className="mt-4 text-lg font-semibold">No questions yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Add a question manually (5 types supported) or import many at
              once from a CSV file.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="size-4" />
                Import CSV
              </Button>
              <Button
                onClick={openCreate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="size-4" />
                Add Question
              </Button>
            </div>
          </CardContent>
        ) : (
          <QuestionsTable
            questions={questions}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        )}
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Question" : "Add Question"}
            </DialogTitle>
            <DialogDescription>
              Choose a question type and fill the fields. Different types
              expose different inputs.
            </DialogDescription>
          </DialogHeader>

          <QuestionForm
            form={form}
            setForm={setForm}
            errors={errors}
            categories={categories}
            allTags={allTags}
          />

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
              {editing ? "Save changes" : "Add question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV dialog */}
      <ImportCsvDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        eventId={eventId}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the question. Existing attempts that
              include this question will keep their recorded answers.
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

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function QuestionsTable({
  questions,
  onEdit,
  onDelete,
}: {
  questions: QuestionDto[]
  onEdit: (q: QuestionDto) => void
  onDelete: (q: QuestionDto) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-center">#</TableHead>
          <TableHead>Question</TableHead>
          <TableHead className="text-center hidden sm:table-cell">Type</TableHead>
          <TableHead className="text-center hidden md:table-cell">Category</TableHead>
          <TableHead className="text-center">Marks</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {questions.map((q, i) => {
          const info = TYPE_INFO[q.type] || TYPE_INFO.MCQ
          const Icon = info.icon
          const diffInfo =
            DIFFICULTY_INFO[(q.difficulty as QuestionDifficulty) || "MEDIUM"] ||
            DIFFICULTY_INFO.MEDIUM
          const hasNegative =
            (q.type === "MCQ" || q.type === "TRUE_FALSE") &&
            (q.negativeMarks ?? 0) > 0
          const visibleTags = (q.tags || []).slice(0, 2)
          const extraTags = Math.max(0, (q.tags?.length || 0) - 2)
          return (
            <TableRow key={q.id} className="hover:bg-muted/40">
              <TableCell className="text-center text-muted-foreground tabular-nums">
                {i + 1}
              </TableCell>
              <TableCell className="min-w-[200px] max-w-[480px]">
                <p className="text-sm line-clamp-2">{truncate(q.question, 160)}</p>
                {q.imageUrl && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400">
                    <ImagePlus className="size-3" />
                    image attached
                  </span>
                )}
                {visibleTags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {visibleTags.map((t, ti) => (
                      <Badge
                        key={`${t}-${ti}`}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 font-normal text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-500/30"
                      >
                        #{t}
                      </Badge>
                    ))}
                    {extraTags > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{extraTags}
                      </span>
                    )}
                  </div>
                )}
                {q.explanation && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {q.explanation}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-center hidden sm:table-cell">
                <div className="flex flex-col items-center gap-1">
                  <Badge className={cn("font-medium", info.badgeClass)}>
                    <Icon className="size-3" />
                    {info.label}
                  </Badge>
                  <Badge
                    className={cn(
                      "text-[10px] px-1.5 py-0 font-normal",
                      diffInfo.badgeClass
                    )}
                  >
                    {diffInfo.label}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-center hidden md:table-cell">
                {q.category ? (
                  <Badge variant="outline" className="font-normal">
                    {q.category}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-center tabular-nums">
                <span className="text-sm">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    +{q.marks}
                  </span>
                  {hasNegative && (
                    <span className="text-rose-500 dark:text-rose-400">
                      {" / -"}
                      {formatNegative(q.negativeMarks ?? 0)}
                    </span>
                  )}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onEdit(q)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    onClick={() => onDelete(q)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

// ---------------------------------------------------------------------------
// Add/Edit form
// ---------------------------------------------------------------------------

function QuestionForm({
  form,
  setForm,
  errors,
  categories,
  allTags,
}: {
  form: QuestionFormState
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>
  errors: Record<string, string>
  categories: string[]
  allTags: string[]
}) {
  const questionRef = React.useRef<HTMLTextAreaElement>(null)

  /**
   * Insert a math symbol at the cursor position in the question textarea.
   * Falls back to appending if the ref is unavailable (e.g. during SSR).
   */
  function insertSymbol(sym: string) {
    const ta = questionRef.current
    if (!ta) {
      setForm((f) => ({ ...f, question: f.question + sym }))
      return
    }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const newText =
      form.question.slice(0, start) + sym + form.question.slice(end)
    setForm((f) => ({ ...f, question: newText }))
    // Restore focus & cursor after React re-renders.
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + sym.length, start + sym.length)
    })
  }

  return (
    <div className="space-y-4">
      {/* Question Type */}
      <div className="space-y-1.5">
        <Label htmlFor="q-type">Question Type</Label>
        <Select
          value={form.type}
          onValueChange={(v) =>
            setForm((f) => ({ ...f, type: v as QuestionType }))
          }
        >
          <SelectTrigger id="q-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_ORDER.map((t) => {
              const info = TYPE_INFO[t]
              const Icon = info.icon
              return (
                <SelectItem key={t} value={t}>
                  <Icon className="size-4" />
                  <span className="font-medium">{info.label}</span>
                  <span className="text-xs text-muted-foreground">— {t}</span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Question text + math symbol picker + image upload */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="q-text">Question *</Label>
          <MathSymbolPicker onInsert={insertSymbol} />
        </div>
        <Textarea
          ref={questionRef}
          id="q-text"
          rows={3}
          value={form.question}
          onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
          placeholder="What is the capital of France?  —  you can insert √, ∑, π, ², ½…"
          aria-invalid={!!errors.question}
        />
        {errors.question && (
          <p className="text-xs text-rose-500">{errors.question}</p>
        )}
      </div>

      {/* Image upload — uses the shared CloudinaryImageUpload component so
          uploads go through /api/upload (Cloudinary or base64 fallback). */}
      <div className="space-y-1.5">
        <CloudinaryImageUpload
          value={form.imageUrl}
          publicId={form.imageUrlPublicId}
          onChange={(url, publicId) =>
            setForm((f) => ({ ...f, imageUrl: url || null, imageUrlPublicId: publicId }))
          }
          folder="questions"
          label="Question Image (optional)"
          description="Attach a diagram, screenshot, or figure. Auto-compressed before upload (max 800×600)."
        />
      </div>

      {/* Type-specific fields */}
      {form.type === "MCQ" && (
        <McqFields form={form} setForm={setForm} errors={errors} />
      )}
      {form.type === "TRUE_FALSE" && (
        <TrueFalseFields form={form} setForm={setForm} errors={errors} />
      )}
      {form.type === "FILL_BLANK" && (
        <FillBlankFields form={form} setForm={setForm} errors={errors} />
      )}
      {form.type === "MATCHING" && (
        <MatchingFields form={form} setForm={setForm} errors={errors} />
      )}
      {form.type === "CODING" && (
        <CodingFields form={form} setForm={setForm} errors={errors} />
      )}

      {/* Common fields: marks, difficulty, negative marks, category */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="q-marks">Marks *</Label>
          <Input
            id="q-marks"
            type="number"
            min={1}
            value={form.marks}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                marks: parseInt(e.target.value || "1", 10),
              }))
            }
            aria-invalid={!!errors.marks}
          />
          {errors.marks && (
            <p className="text-xs text-rose-500">{errors.marks}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="q-diff">Difficulty</Label>
          <Select
            value={form.difficulty}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, difficulty: v as QuestionDifficulty }))
            }
          >
            <SelectTrigger id="q-diff" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTY_ORDER.map((d) => {
                const info = DIFFICULTY_INFO[d]
                return (
                  <SelectItem key={d} value={d}>
                    <span
                      className={cn(
                        "mr-1 inline-flex size-2 rounded-full",
                        d === "EASY"
                          ? "bg-emerald-500"
                          : d === "MEDIUM"
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      )}
                    />
                    <span className="font-medium">{info.label}</span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {(form.type === "MCQ" || form.type === "TRUE_FALSE") && (
          <div className="space-y-1.5">
            <Label htmlFor="q-neg">Negative</Label>
            <Input
              id="q-neg"
              type="number"
              min={0}
              step={0.25}
              value={form.negativeMarks}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  negativeMarks: parseFloat(e.target.value || "0"),
                }))
              }
              aria-invalid={!!errors.negativeMarks}
            />
            {errors.negativeMarks ? (
              <p className="text-xs text-rose-500">{errors.negativeMarks}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Wrong-answer penalty.
              </p>
            )}
          </div>
        )}

        <div
          className={cn(
            "space-y-1.5",
            form.type !== "MCQ" && form.type !== "TRUE_FALSE"
              ? "sm:col-span-2"
              : ""
          )}
        >
          <Label htmlFor="q-cat">Category</Label>
          <Input
            id="q-cat"
            list="q-cat-options"
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
            placeholder="e.g. Geography"
          />
          <datalist id="q-cat-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Reuse or create.
          </p>
        </div>
      </div>

      {/* Tags input */}
      <div className="space-y-1.5">
        <Label htmlFor="q-tags">Tags</Label>
        <TagsInput
          tags={form.tags}
          onChange={(tags) => setForm((f) => ({ ...f, tags }))}
          allTags={allTags}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="q-expl">Explanation (optional)</Label>
        <Textarea
          id="q-expl"
          rows={2}
          value={form.explanation}
          onChange={(e) =>
            setForm((f) => ({ ...f, explanation: e.target.value }))
          }
          placeholder="Shown after answering"
        />
      </div>
    </div>
  )
}

// ---- per-type field blocks ----

function McqFields({
  form,
  setForm,
  errors,
}: {
  form: QuestionFormState
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>
  errors: Record<string, string>
}) {
  return (
    <div className="space-y-2">
      <Label>
        Options *{" "}
        <span className="text-xs text-muted-foreground font-normal">
          (mark the correct one)
        </span>
      </Label>
      <div className="space-y-2">
        {form.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, correctAnswer: i }))}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                form.correctAnswer === i
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "border-slate-200 text-slate-500 hover:border-emerald-300 dark:border-slate-700"
              )}
              aria-label={`Mark option ${LETTERS[i]} as correct`}
              aria-pressed={form.correctAnswer === i}
            >
              {LETTERS[i]}
            </button>
            <Input
              value={opt}
              onChange={(e) => {
                const next = [...form.options]
                next[i] = e.target.value
                setForm((f) => ({ ...f, options: next }))
              }}
              placeholder={`Option ${LETTERS[i]}`}
            />
            {form.correctAnswer === i && (
              <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
            )}
          </div>
        ))}
      </div>
      {errors.options && (
        <p className="text-xs text-rose-500">{errors.options}</p>
      )}
      {errors.correctAnswer && (
        <p className="text-xs text-rose-500">{errors.correctAnswer}</p>
      )}
    </div>
  )
}

function TrueFalseFields({
  form,
  setForm,
  errors,
}: {
  form: QuestionFormState
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>
  errors: Record<string, string>
}) {
  const options: { label: string; value: number }[] = [
    { label: "True", value: 0 },
    { label: "False", value: 1 },
  ]
  return (
    <div className="space-y-2">
      <Label>Correct answer *</Label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() =>
              setForm((f) => ({ ...f, correctAnswer: o.value }))
            }
            className={cn(
              "rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors",
              form.correctAnswer === o.value
                ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "border-slate-200 text-slate-600 hover:border-emerald-300 dark:border-slate-700 dark:text-slate-300"
            )}
            aria-pressed={form.correctAnswer === o.value}
          >
            {o.label}
          </button>
        ))}
      </div>
      {errors.correctAnswer && (
        <p className="text-xs text-rose-500">{errors.correctAnswer}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Options &ldquo;True&rdquo; and &ldquo;False&rdquo; are auto-generated
        by the backend.
      </p>
    </div>
  )
}

function FillBlankFields({
  form,
  setForm,
  errors,
}: {
  form: QuestionFormState
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>
  errors: Record<string, string>
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="q-correct-text">Correct answer (text) *</Label>
      <Input
        id="q-correct-text"
        value={form.correctText}
        onChange={(e) =>
          setForm((f) => ({ ...f, correctText: e.target.value }))
        }
        placeholder="H2O"
        aria-invalid={!!errors.correctText}
      />
      {errors.correctText ? (
        <p className="text-xs text-rose-500">{errors.correctText}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Participant types a short answer. Match is case-insensitive, trimmed.
        </p>
      )}
    </div>
  )
}

function MatchingFields({
  form,
  setForm,
  errors,
}: {
  form: QuestionFormState
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>
  errors: Record<string, string>
}) {
  function updatePair(i: number, key: "left" | "right", value: string) {
    setForm((f) => {
      const next = f.matchPairs.map((p, idx) =>
        idx === i ? { ...p, [key]: value } : p
      )
      return { ...f, matchPairs: next }
    })
  }
  function addPair() {
    setForm((f) => ({
      ...f,
      matchPairs: [...f.matchPairs, { left: "", right: "" }],
    }))
  }
  function removePair(i: number) {
    setForm((f) => ({
      ...f,
      matchPairs: f.matchPairs.filter((_, idx) => idx !== i),
    }))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Match pairs *</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addPair}
          className="h-7 text-xs"
        >
          <Plus className="size-3" />
          Add pair
        </Button>
      </div>
      <div className="space-y-2">
        {form.matchPairs.map((p, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2"
          >
            <Input
              value={p.left}
              onChange={(e) => updatePair(i, "left", e.target.value)}
              placeholder={`Left ${i + 1}`}
              aria-label={`Pair ${i + 1} left`}
            />
            <span className="text-xs text-muted-foreground select-none px-1">
              ↔
            </span>
            <Input
              value={p.right}
              onChange={(e) => updatePair(i, "right", e.target.value)}
              placeholder={`Right ${i + 1}`}
              aria-label={`Pair ${i + 1} right`}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              onClick={() => removePair(i)}
              disabled={form.matchPairs.length <= 2}
              aria-label="Remove pair"
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      {errors.matchPairs && (
        <p className="text-xs text-rose-500">{errors.matchPairs}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Participant matches left items to right items. All must be correct for
        marks. Min 2 pairs.
      </p>
    </div>
  )
}

function CodingFields({
  form,
  setForm,
  errors,
}: {
  form: QuestionFormState
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>
  errors: Record<string, string>
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="q-lang">Language</Label>
          <Select
            value={form.codeLanguage}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, codeLanguage: v }))
            }
          >
            <SelectTrigger id="q-lang" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CODE_LANGUAGES.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="q-code">Reference solution *</Label>
        <Textarea
          id="q-code"
          rows={5}
          value={form.correctText}
          onChange={(e) =>
            setForm((f) => ({ ...f, correctText: e.target.value }))
          }
          placeholder="function twoPlusTwo() { return 4; }"
          className="font-mono text-xs"
          aria-invalid={!!errors.correctText}
        />
        {errors.correctText ? (
          <p className="text-xs text-rose-500">{errors.correctText}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            For this version, code is evaluated via simple text comparison. A
            full sandbox runner is planned.
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Math symbol picker, image upload, tags input — shared form widgets
// ---------------------------------------------------------------------------

/**
 * Lightweight Unicode math symbol picker.
 * - No KaTeX / MathJax / LaTeX — just raw Unicode chars.
 * - A compact "Σ" toggle opens a popover with a tabbed group selector.
 * - Clicking a symbol calls onInsert(sym) and closes the popover.
 */
function MathSymbolPicker({ onInsert }: { onInsert: (sym: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [group, setGroup] = React.useState(MATH_SYMBOL_GROUPS[0].name)
  const current =
    MATH_SYMBOL_GROUPS.find((g) => g.name === group) || MATH_SYMBOL_GROUPS[0]

  function handleInsert(sym: string) {
    onInsert(sym)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          aria-label="Insert math symbol"
        >
          <FunctionSquare className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold tracking-wide">Σ</span>
          <span className="hidden sm:inline">Math</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-80 p-3 outline-none"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Insert at cursor
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {MATH_SYMBOL_GROUPS.map((g) => (
              <button
                key={g.name}
                type="button"
                onClick={() => setGroup(g.name)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  g.name === group
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1">
            {current.symbols.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => handleInsert(sym)}
                className="aspect-square rounded-md border border-slate-200 bg-background text-base leading-none hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400 transition-colors"
                title={`Insert ${sym}`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Image upload + client-side compression.
 * Stores a base64 JPEG data URL in form state — no external service.
 */
function QuestionImageUpload({
  imageUrl,
  onChange,
}: {
  imageUrl: string | null
  onChange: (url: string | null) => void
}) {
  const [loading, setLoading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }
    setLoading(true)
    try {
      const compressed = await compressImage(file)
      onChange(compressed)
      toast.success("Image attached")
    } catch (e) {
      toast.error("Could not process image: " + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          // Reset so selecting the same file again still triggers onChange.
          e.target.value = ""
        }}
      />
      {imageUrl ? (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <img
            src={imageUrl}
            alt="Question attachment preview"
            className="h-24 w-auto max-w-[200px] rounded-md bg-slate-50 object-contain dark:bg-slate-900"
          />
          <div className="flex flex-col gap-1.5">
            <Badge
              variant="outline"
              className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
            >
              <CheckCircle2 className="size-3" />
              Attached
            </Badge>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
                onClick={() => onChange(null)}
                disabled={loading}
              >
                <Trash2 className="size-3" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4 text-emerald-600 dark:text-emerald-400" />
          )}
          Upload image
        </Button>
      )}
    </div>
  )
}

/**
 * Comma/Enter-separated tag input with chips and autocomplete.
 * - Enter or comma commits the current draft as a chip.
 * - Backspace on an empty draft removes the last chip.
 * - Autocomplete suggestions come from the event's existing tags.
 */
function TagsInput({
  tags,
  onChange,
  allTags,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  allTags: string[]
}) {
  const [draft, setDraft] = React.useState("")

  function commitTag(raw: string) {
    const tag = raw.trim().replace(/,+$/g, "").trim()
    if (!tag) {
      setDraft("")
      return
    }
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setDraft("")
      return
    }
    onChange([...tags, tag])
    setDraft("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      commitTag(draft)
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  function removeTag(i: number) {
    onChange(tags.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
        {tags.map((tag, i) => (
          <Badge
            key={`${tag}-${i}`}
            variant="secondary"
            className="gap-1 border-0 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30"
          >
            <span className="text-xs">#</span>
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          list="q-tag-options"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commitTag(draft)}
          placeholder={
            tags.length === 0
              ? "Type a tag, press Enter or comma to add…"
              : "Add another…"
          }
          className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Add tag"
        />
        <datalist id="q-tag-options">
          {allTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <p className="text-xs text-muted-foreground">
        Press <kbd className="rounded border px-1">Enter</kbd> or{" "}
        <kbd className="rounded border px-1">,</kbd> to add a tag. Suggestions
        appear from existing tags in this event.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import CSV dialog
// ---------------------------------------------------------------------------

interface ParsedRow {
  question: string
  type: QuestionType
  options: string[]
  correctAnswer: number
  correctText?: string
  marks?: number
  explanation?: string
  category?: string
  negativeMarks?: number
  error?: string
}

function ImportCsvDialog({
  open,
  onOpenChange,
  eventId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  eventId: string
}) {
  const qc = useQueryClient()
  const [csvText, setCsvText] = React.useState("")
  const [parsed, setParsed] = React.useState<ParsedRow[]>([])
  const [fileName, setFileName] = React.useState<string>("")
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const rowsCount = parsed.filter((r) => !r.error && r.question).length

  const importMutation = useMutation({
    mutationFn: async () => {
      // Send the original CSV text (file content or pasted text) to the server
      // as JSON. The import route accepts both JSON `{ eventId, csvText }` and
      // multipart form-data with `eventId` + `file` — JSON is simpler here.
      return api<{ imported?: number; count?: number; errors?: string[] }>(
        "/api/questions/import",
        {
          method: "POST",
          body: JSON.stringify({ eventId, csvText }),
        }
      )
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["questions", eventId] })
      qc.invalidateQueries({ queryKey: ["events"] })
      qc.invalidateQueries({ queryKey: ["analytics"] })
      const count =
        (res && typeof res.imported === "number" && res.imported) ||
        (res && typeof res.count === "number" && res.count) ||
        rowsCount
      toast.success(`Imported ${count} question${count === 1 ? "" : "s"}`)
      handleClose()
    },
    onError: (e: Error) => toast.error("Import failed: " + e.message),
  })

  function handleClose() {
    setCsvText("")
    setParsed([])
    setFileName("")
    if (fileInputRef.current) fileInputRef.current.value = ""
    onOpenChange(false)
  }

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || "")
      setCsvText(text)
      parsePreview(text)
    }
    reader.onerror = () => toast.error("Could not read file")
    reader.readAsText(file)
  }

  function parsePreview(text: string) {
    const { rows, errors } = parseCsvQuestions(text)
    const enriched: ParsedRow[] = rows.map((r) => ({
      question: r.question,
      type: r.type || "MCQ",
      options: r.options,
      correctAnswer: r.correctAnswer,
      correctText: r.correctText,
      marks: r.marks,
      explanation: r.explanation,
      category: r.category,
      negativeMarks: r.negativeMarks,
      error: undefined,
    }))

    if (errors.length > 0 && enriched.length === 0) {
      setParsed([
        {
          question: "",
          type: "MCQ",
          options: [],
          correctAnswer: -1,
          error: errors.join(" "),
        },
      ])
      return
    }
    setParsed(enriched)
  }

  function downloadTemplate() {
    const text = buildCsvTemplate()
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "questions-template.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Template downloaded")
  }

  function handleImport() {
    if (!csvText.trim()) {
      toast.error("Please provide CSV content first")
      return
    }
    if (parsed.length === 0) {
      toast.error("No valid rows to import")
      return
    }
    importMutation.mutate()
  }

  const validCount = parsed.filter((r) => !r.error && r.question).length
  const errorCount = parsed.filter((r) => r.error).length

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : handleClose())}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Questions from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file or paste its contents. The first row must be the
            header. Type / category / negative_marks columns are optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Choose CSV file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={downloadTemplate}
            >
              <Download className="size-4" />
              Download template
            </Button>
            {fileName && (
              <Badge variant="secondary" className="font-mono text-xs">
                <FileText className="size-3" />
                {fileName}
              </Badge>
            )}
          </div>

          <Tabs defaultValue="paste">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paste">Paste CSV</TabsTrigger>
              <TabsTrigger value="preview">
                Preview ({parsed.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="space-y-2">
              <Textarea
                rows={6}
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value)
                  parsePreview(e.target.value)
                }}
                placeholder={
                  "question,option_a,option_b,option_c,option_d,correct_answer,marks,explanation,type,category,negative_marks"
                }
                className="font-mono text-xs"
              />
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
                <p className="font-medium mb-1 text-slate-700 dark:text-slate-200">
                  Columns
                </p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>
                    <code className="text-emerald-700 dark:text-emerald-400">
                      question
                    </code>{" "}
                    — required, the question text.
                  </li>
                  <li>
                    <code className="text-emerald-700 dark:text-emerald-400">
                      option_a…
                      option_d
                    </code>{" "}
                    — MCQ options. MATCHING uses these as left/right pairs
                    (a/b = pair 1, c/d = pair 2).
                  </li>
                  <li>
                    <code className="text-emerald-700 dark:text-emerald-400">
                      correct_answer
                    </code>{" "}
                    — letter (A/B/C/D), 1-based index, or true/false. Required
                    for MCQ &amp; TRUE_FALSE. Ignored for FILL_BLANK /
                    MATCHING / CODING.
                  </li>
                  <li>
                    <code className="text-emerald-700 dark:text-emerald-400">
                      marks
                    </code>{" "}
                    — integer (default 1).
                  </li>
                  <li>
                    <code className="text-emerald-700 dark:text-emerald-400">
                      explanation
                    </code>{" "}
                    — optional, shown after answering.
                  </li>
                  <li>
                    <code className="text-amber-700 dark:text-amber-400">
                      type
                    </code>{" "}
                    — optional, one of MCQ | TRUE_FALSE | FILL_BLANK | MATCHING
                    | CODING (default MCQ).
                  </li>
                  <li>
                    <code className="text-amber-700 dark:text-amber-400">
                      category
                    </code>{" "}
                    — optional tag.
                  </li>
                  <li>
                    <code className="text-amber-700 dark:text-amber-400">
                      negative_marks
                    </code>{" "}
                    — optional, 0 by default.
                  </li>
                  <li>
                    <code className="text-amber-700 dark:text-amber-400">
                      correct_text
                    </code>{" "}
                    — optional, the answer for FILL_BLANK or the reference
                    solution for CODING.
                  </li>
                </ul>
                <p className="mt-2 text-slate-500 dark:text-slate-400">
                  Old CSVs without the new columns still import — defaults:
                  type=MCQ, negative_marks=0, category=null.
                </p>
              </div>
            </TabsContent>
            <TabsContent value="preview" className="space-y-2">
              {parsed.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No rows parsed yet. Choose a file or paste CSV content
                  above.
                </div>
              ) : (
                <div className="rounded-lg border max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 text-center">#</TableHead>
                        <TableHead>Question</TableHead>
                        <TableHead className="text-center">Type</TableHead>
                        <TableHead className="text-center hidden sm:table-cell">
                          Category
                        </TableHead>
                        <TableHead className="text-center">Marks</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.map((r, i) => {
                        const info = TYPE_INFO[r.type] || TYPE_INFO.MCQ
                        const Icon = info.icon
                        return (
                          <TableRow
                            key={i}
                            className={
                              r.error ? "bg-rose-50/50 dark:bg-rose-500/5" : ""
                            }
                          >
                            <TableCell className="text-center text-muted-foreground">
                              {i + 1}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs">
                              {r.question || (
                                <span className="text-rose-500">
                                  {r.error || "(invalid)"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                className={cn(
                                  "text-[10px] px-1.5 py-0",
                                  info.badgeClass
                                )}
                              >
                                <Icon className="size-2.5" />
                                {info.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-xs hidden sm:table-cell">
                              {r.category || "—"}
                            </TableCell>
                            <TableCell className="text-center text-xs">
                              {r.marks ?? "—"}
                            </TableCell>
                            <TableCell>
                              {r.error ? (
                                <Badge
                                  variant="outline"
                                  className="border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30"
                                >
                                  <AlertTriangle className="size-3" />
                                  Error
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
                                >
                                  <CheckCircle2 className="size-3" />
                                  OK
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              {parsed.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <span className="text-emerald-600 font-medium">
                    {validCount} valid
                  </span>
                  {errorCount > 0 && (
                    <span className="text-rose-600 font-medium">
                      {" "}
                      · {errorCount} with errors
                    </span>
                  )}
                  {" · "}
                  {parsed.length} total rows
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={importMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={importMutation.isPending || parsed.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {importMutation.isPending && (
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            Import{" "}
            {validCount > 0
              ? `${validCount} question${validCount === 1 ? "" : "s"}`
              : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
