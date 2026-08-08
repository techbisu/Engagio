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
  FileQuestion,
  FileText,
  CheckCircle2,
  AlertTriangle,
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
import { cn, truncate } from "@/lib/utils"
import { parseCsvQuestions, buildCsvTemplate } from "@/lib/csv"

import { api } from "./api"
import type { QuestionDto } from "@/types"

interface QuestionsManagerProps {
  eventId: string
  eventTitle?: string
  onBack?: () => void
}

interface QuestionFormState {
  question: string
  options: string[]
  correctAnswer: number
  marks: number
  explanation: string
}

const emptyQuestionForm: QuestionFormState = {
  question: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  marks: 1,
  explanation: "",
}

const LETTERS = ["A", "B", "C", "D", "E", "F"]

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
  const [form, setForm] = React.useState<QuestionFormState>(emptyQuestionForm)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const [importOpen, setImportOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<QuestionDto | null>(null)

  const createMutation = useMutation({
    mutationFn: (payload: QuestionFormState) =>
      api<QuestionDto>("/api/questions", {
        method: "POST",
        body: JSON.stringify({
          eventId,
          question: payload.question,
          options: payload.options.filter((o) => o.trim()),
          correctAnswer: payload.correctAnswer,
          marks: payload.marks,
          explanation: payload.explanation || null,
        }),
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
    mutationFn: ({ id, payload }: { id: string; payload: QuestionFormState }) =>
      api<QuestionDto>(`/api/questions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          question: payload.question,
          options: payload.options.filter((o) => o.trim()),
          correctAnswer: payload.correctAnswer,
          marks: payload.marks,
          explanation: payload.explanation || null,
        }),
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
    setForm(emptyQuestionForm)
    setErrors({})
    setDialogOpen(true)
  }

  function openEdit(q: QuestionDto) {
    setEditing(q)
    const opts = [...q.options]
    while (opts.length < 4) opts.push("")
    setForm({
      question: q.question,
      options: opts.slice(0, 4),
      correctAnswer: q.correctAnswer,
      marks: q.marks,
      explanation: q.explanation || "",
    })
    setErrors({})
    setDialogOpen(true)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.question.trim()) e.question = "Question text is required"
    const filled = form.options.filter((o) => o.trim())
    if (filled.length < 2) e.options = "At least 2 options are required"
    if (form.correctAnswer < 0 || form.correctAnswer >= filled.length) {
      e.correctAnswer = "Select the correct answer"
    }
    if (!form.marks || form.marks < 1) e.marks = "Marks must be ≥ 1"
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

  const questions = data || []

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
            {questions.length} question{questions.length === 1 ? "" : "s"} in this event.
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
            Failed to load questions: {(error as Error)?.message || "Unknown error"}
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
              Add a question manually or import many at once from a CSV file.
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Options</TableHead>
                <TableHead className="text-center">Correct</TableHead>
                <TableHead className="text-center">Marks</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q, i) => (
                <TableRow key={q.id} className="hover:bg-muted/40">
                  <TableCell className="text-center text-muted-foreground tabular-nums">
                    {i + 1}
                  </TableCell>
                  <TableCell className="min-w-[200px] max-w-[480px]">
                    <p className="text-sm line-clamp-2">{truncate(q.question, 160)}</p>
                    {q.explanation && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {q.explanation}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums hidden sm:table-cell">
                    {q.options.length}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30 border-0">
                      {LETTERS[q.correctAnswer] || String(q.correctAnswer + 1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{q.marks}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEdit(q)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        onClick={() => setDeleteTarget(q)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              Write the question, fill at least 2 options, and mark the correct one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="q-text">Question *</Label>
              <Textarea
                id="q-text"
                rows={3}
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="What is the capital of France?"
                aria-invalid={!!errors.question}
              />
              {errors.question && (
                <p className="text-xs text-rose-500">{errors.question}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Options * <span className="text-xs text-muted-foreground font-normal">(mark the correct one)</span></Label>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, correctAnswer: i })}
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
                        setForm({ ...form, options: next })
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="q-marks">Marks</Label>
                <Input
                  id="q-marks"
                  type="number"
                  min={1}
                  value={form.marks}
                  onChange={(e) =>
                    setForm({ ...form, marks: parseInt(e.target.value || "1", 10) })
                  }
                  aria-invalid={!!errors.marks}
                />
                {errors.marks && (
                  <p className="text-xs text-rose-500">{errors.marks}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-expl">Explanation (optional)</Label>
                <Input
                  id="q-expl"
                  value={form.explanation}
                  onChange={(e) =>
                    setForm({ ...form, explanation: e.target.value })
                  }
                  placeholder="Shown after answering"
                />
              </div>
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
// Import CSV dialog
// ---------------------------------------------------------------------------

interface ParsedRow {
  question: string
  options: string[]
  correctAnswer: number
  marks?: number
  explanation?: string
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

  // Track successful row count for the toast message
  const rowsCount = parsed.filter((r) => !r.error && r.question).length

  const importMutation = useMutation({
    mutationFn: async () => {
      // Send the original CSV text (file content or pasted text) to the server.
      return api<{ count: number }>("/api/questions/import", {
        method: "POST",
        body: JSON.stringify({ eventId, csvText }),
      })
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["questions", eventId] })
      qc.invalidateQueries({ queryKey: ["events"] })
      qc.invalidateQueries({ queryKey: ["analytics"] })
      const count = res && typeof res.count === "number" ? res.count : rowsCount
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
    // Map errors back to rows (parseCsvQuestions reports errors by line, not by row index).
    // Re-derive per-row errors here for the UI.
    const enriched: ParsedRow[] = rows.map((r) => ({
      ...r,
      error: undefined,
    }))

    // Generic structural errors (header issues) attach as a top-level notice.
    if (errors.length > 0 && enriched.length === 0) {
      // Surface as a single "invalid" pseudo-row to show what went wrong.
      setParsed([{ question: "", options: [], correctAnswer: -1, error: errors.join(" ") }])
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
            Upload a CSV file or paste its contents. The first row must be the header.
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
              <TabsTrigger value="preview">Preview ({parsed.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="space-y-2">
              <Textarea
                rows={6}
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value)
                  parsePreview(e.target.value)
                }}
                placeholder={"question,option_a,option_b,option_c,option_d,correct_answer,marks,explanation\nWhat is 2+2?,1,2,3,4,D,1,Four."}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Header columns: question, option_a, option_b, option_c, option_d, correct_answer, marks, explanation
              </p>
            </TabsContent>
            <TabsContent value="preview" className="space-y-2">
              {parsed.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No rows parsed yet. Choose a file or paste CSV content above.
                </div>
              ) : (
                <div className="rounded-lg border max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 text-center">#</TableHead>
                        <TableHead>Question</TableHead>
                        <TableHead className="text-center">Correct</TableHead>
                        <TableHead className="text-center">Marks</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.map((r, i) => (
                        <TableRow key={i} className={r.error ? "bg-rose-50/50 dark:bg-rose-500/5" : ""}>
                          <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="max-w-[260px] truncate text-xs">
                            {r.question || <span className="text-rose-500">{r.error || "(invalid)"}</span>}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {r.correctAnswer >= 0 ? LETTERS[r.correctAnswer] : "—"}
                          </TableCell>
                          <TableCell className="text-center text-xs">{r.marks ?? "—"}</TableCell>
                          <TableCell>
                            {r.error ? (
                              <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30">
                                <AlertTriangle className="size-3" />
                                Error
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30">
                                <CheckCircle2 className="size-3" />
                                OK
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {(parsed.length > 0) && (
                <p className="text-xs text-muted-foreground">
                  <span className="text-emerald-600 font-medium">{validCount} valid</span>
                  {errorCount > 0 && (
                    <span className="text-rose-600 font-medium"> · {errorCount} with errors</span>
                  )}
                  {" · "}{parsed.length} total rows
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importMutation.isPending}>
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
            Import {validCount > 0 ? `${validCount} question${validCount === 1 ? "" : "s"}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
