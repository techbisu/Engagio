import type { CsvRow, QuestionType, QuestionDifficulty } from "@/types"

const VALID_TYPES: QuestionType[] = [
  "MCQ",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCHING",
  "CODING",
]

/**
 * Parse CSV text into structured question rows.
 *
 * Header columns (case-insensitive):
 *   question, option_a, option_b, option_c, option_d,
 *   correct_answer, marks, explanation,
 *   type, category, negative_marks, correct_text
 *
 * The last four are optional:
 *  - type            default "MCQ" — must be one of MCQ|TRUE_FALSE|FILL_BLANK|MATCHING|CODING
 *  - category        default null  — free-form string tag
 *  - negative_marks  default 0     — applied on wrong MCQ/TRUE_FALSE answers
 *  - correct_text    default null  — short answer (FILL_BLANK) or reference solution (CODING)
 *
 * `correct_answer` can be a letter (A/B/C/D) or 1-based index, and is required
 * for MCQ + TRUE_FALSE rows (ignored for the other types).
 *
 * MATCHING rows encode pairs as alternating columns: option_a=left1,
 * option_b=right1, option_c=left2, option_d=right2.
 *
 * Old CSVs without the new columns still parse — defaults are applied.
 */
export function parseCsvQuestions(csvText: string): {
  rows: CsvRow[]
  errors: string[]
} {
  const errors: string[] = []
  const lines = splitCsvLines(csvText)
  if (lines.length === 0) {
    return { rows: [], errors: ["Empty CSV file."] }
  }

  const header = lines[0].map((h) => h.trim().toLowerCase())
  const idx = {
    question: header.findIndex((h) => h === "question"),
    a: header.findIndex((h) => h === "option_a" || h === "optiona" || h === "a"),
    b: header.findIndex((h) => h === "option_b" || h === "optionb" || h === "b"),
    c: header.findIndex((h) => h === "option_c" || h === "optionc" || h === "c"),
    d: header.findIndex((h) => h === "option_d" || h === "optiond" || h === "d"),
    correct: header.findIndex(
      (h) => h === "correct_answer" || h.startsWith("correct")
    ),
    marks: header.findIndex((h) => h === "marks"),
    explanation: header.findIndex((h) => h.startsWith("explanation")),
    type: header.findIndex((h) => h === "type" || h === "question_type"),
    category: header.findIndex((h) => h === "category"),
    negativeMarks: header.findIndex(
      (h) => h === "negative_marks" || h === "negativemarks" || h === "negative"
    ),
    correctText: header.findIndex(
      (h) => h === "correct_text" || h === "correcttext" || h === "answer_text"
    ),
    difficulty: header.findIndex((h) => h === "difficulty"),
  }

  if (idx.question < 0) {
    return { rows: [], errors: ["Missing 'question' column."] }
  }

  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]
    if (!cells || cells.every((c) => !c.trim())) continue
    const question = cells[idx.question]?.trim() || ""
    if (!question) {
      errors.push(`Row ${i + 1}: empty question text.`)
      continue
    }

    // ----- Resolve type -----
    const rawType = (
      idx.type >= 0 ? cells[idx.type] || "" : ""
    )
      .trim()
      .toUpperCase()
      .replace(/[-\s]/g, "_")
    const type: QuestionType = rawType ? (rawType as QuestionType) : "MCQ"
    if (rawType && !VALID_TYPES.includes(type)) {
      errors.push(
        `Row ${i + 1}: unsupported type "${rawType}". Must be one of ${VALID_TYPES.join(
          ", "
        )}.`
      )
      continue
    }

    // ----- Resolve options -----
    const options: string[] = []
    for (const colIdx of [idx.a, idx.b, idx.c, idx.d]) {
      if (colIdx >= 0) {
        const opt = cells[colIdx]?.trim() || ""
        if (opt) options.push(opt)
      }
    }

    // ----- Type-specific handling -----
    if (type === "MCQ") {
      if (options.length < 2) {
        errors.push(`Row ${i + 1}: MCQ needs at least 2 options.`)
        continue
      }
      const correctAnswer = resolveCorrectAnswer(
        (cells[idx.correct] || "").trim(),
        options.length
      )
      if (correctAnswer < 0) {
        errors.push(
          `Row ${i + 1}: invalid correct_answer "${(cells[idx.correct] || "").trim()}".`
        )
        continue
      }
      rows.push({
        question,
        options,
        correctAnswer,
        marks: parseMarks(cells, idx.marks),
        explanation: parseExplanation(cells, idx.explanation),
        type,
        category: parseCategory(cells, idx.category),
        negativeMarks: parseNegative(cells, idx.negativeMarks),
        difficulty: parseDifficulty(cells, idx.difficulty),
      })
      continue
    }

    if (type === "TRUE_FALSE") {
      // Auto-generate the True/False options if the admin didn't supply them.
      const tfOptions =
        options.length === 2 &&
        options[0].toLowerCase() === "true" &&
        options[1].toLowerCase() === "false"
          ? options
          : ["True", "False"]
      const correctAnswer = resolveTrueFalse(
        (cells[idx.correct] || "").trim()
      )
      if (correctAnswer < 0) {
        errors.push(
          `Row ${i + 1}: TRUE_FALSE needs a correct_answer of "true" or "false" (or A/B, 0/1).`
        )
        continue
      }
      rows.push({
        question,
        options: tfOptions,
        correctAnswer,
        marks: parseMarks(cells, idx.marks),
        explanation: parseExplanation(cells, idx.explanation),
        type,
        category: parseCategory(cells, idx.category),
        negativeMarks: parseNegative(cells, idx.negativeMarks),
        difficulty: parseDifficulty(cells, idx.difficulty),
      })
      continue
    }

    if (type === "FILL_BLANK" || type === "CODING") {
      // correct_answer column is ignored; pull the answer / solution from
      // correct_text (or, fallback, from option_a).
      const fromCol = idx.correctText >= 0 ? cells[idx.correctText]?.trim() : ""
      const fromOpt = options[0] || ""
      const correctText = (fromCol || fromOpt || "").trim()
      if (!correctText) {
        errors.push(
          `Row ${i + 1}: ${type} needs a correct_text (or option_a) value.`
        )
        continue
      }
      rows.push({
        question,
        options: [],
        correctAnswer: -1,
        marks: parseMarks(cells, idx.marks),
        explanation: parseExplanation(cells, idx.explanation),
        type,
        category: parseCategory(cells, idx.category),
        negativeMarks: parseNegative(cells, idx.negativeMarks),
        correctText,
        difficulty: parseDifficulty(cells, idx.difficulty),
      })
      continue
    }

    if (type === "MATCHING") {
      // Pairs are encoded as alternating left/right columns:
      //   option_a=left1, option_b=right1, option_c=left2, option_d=right2
      const leftCols = [idx.a, idx.c].filter((c) => c >= 0)
      const rightCols = [idx.b, idx.d].filter((c) => c >= 0)
      const pairCount = Math.min(leftCols.length, rightCols.length)
      const pairs: { left: string; right: string }[] = []
      for (let p = 0; p < pairCount; p++) {
        const left = (cells[leftCols[p]] || "").trim()
        const right = (cells[rightCols[p]] || "").trim()
        if (left || right) pairs.push({ left, right })
      }
      if (pairs.length < 2) {
        errors.push(
          `Row ${i + 1}: MATCHING needs at least 2 pairs (option_a/b + option_c/d).`
        )
        continue
      }
      if (pairs.some((p) => !p.left || !p.right)) {
        errors.push(
          `Row ${i + 1}: MATCHING pairs must have both a left and right value.`
        )
        continue
      }
      // Encode pairs as JSON in correctText so the import route can persist
      // them on the question row (the backend, updated in parallel, will read
      // matchPairs from this field when type=MATCHING).
      rows.push({
        question,
        options: [],
        correctAnswer: -1,
        marks: parseMarks(cells, idx.marks),
        explanation: parseExplanation(cells, idx.explanation),
        type,
        category: parseCategory(cells, idx.category),
        negativeMarks: parseNegative(cells, idx.negativeMarks),
        correctText: JSON.stringify(pairs),
        difficulty: parseDifficulty(cells, idx.difficulty),
      })
      continue
    }
  }

  return { rows, errors }
}

/** Resolve a letter (A/B/C/D) or 1-based index into a 0-based option index. */
function resolveCorrectAnswer(raw: string, optionCount: number): number {
  if (!raw) return -1
  if (/^[a-zA-Z]$/.test(raw)) {
    const idx = raw.toUpperCase().charCodeAt(0) - 65
    return idx >= 0 && idx < optionCount ? idx : -1
  }
  if (/^\d+$/.test(raw)) {
    const idx = parseInt(raw, 10) - 1 // 1-based -> 0-based
    return idx >= 0 && idx < optionCount ? idx : -1
  }
  return -1
}

/** Resolve TRUE/FALSE / A/B / 0/1 into a 0/1 index for the True/False options. */
function resolveTrueFalse(raw: string): number {
  const v = raw.toLowerCase()
  if (v === "true" || v === "t" || v === "a" || v === "0") return 0
  if (v === "false" || v === "f" || v === "b" || v === "1") return 1
  return -1
}

function parseMarks(cells: string[], idx: number): number | undefined {
  if (idx < 0) return undefined
  const v = parseInt(cells[idx] || "1", 10)
  return Number.isFinite(v) && v > 0 ? v : 1
}

function parseExplanation(cells: string[], idx: number): string | undefined {
  if (idx < 0) return undefined
  const v = cells[idx]?.trim()
  return v || undefined
}

function parseCategory(cells: string[], idx: number): string | undefined {
  if (idx < 0) return undefined
  const v = cells[idx]?.trim()
  return v || undefined
}

function parseNegative(cells: string[], idx: number): number | undefined {
  if (idx < 0) return undefined
  const v = parseFloat(cells[idx] || "0")
  return Number.isFinite(v) && v > 0 ? v : 0
}

const VALID_DIFFICULTIES: QuestionDifficulty[] = ["EASY", "MEDIUM", "HARD"]

/** Resolve a difficulty string (case-insensitive) — default MEDIUM. */
function parseDifficulty(cells: string[], idx: number): QuestionDifficulty {
  if (idx < 0) return "MEDIUM"
  const v = (cells[idx] || "").trim().toUpperCase()
  if (!v) return "MEDIUM"
  // Allow "EASY" / "MEDIUM" / "HARD" as well as single-letter shortcuts.
  if (v === "E" || v === "EASY") return "EASY"
  if (v === "H" || v === "HARD") return "HARD"
  if (v === "M" || v === "MEDIUM") return "MEDIUM"
  if (VALID_DIFFICULTIES.includes(v as QuestionDifficulty)) return v as QuestionDifficulty
  return "MEDIUM"
}

/** Split CSV text into rows of cells (handles quoted fields, escaped quotes, newlines). */
function splitCsvLines(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false
  let i = 0

  // Normalize line endings
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  while (i < t.length) {
    const ch = t[i]
    if (inQuotes) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ",") {
      row.push(cell)
      cell = ""
      i++
      continue
    }
    if (ch === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      i++
      continue
    }
    cell += ch
    i++
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export function buildCsvTemplate(): string {
  const header =
    "question,option_a,option_b,option_c,option_d,correct_answer,marks,explanation,type,category,negative_marks,difficulty"
  const rows = [
    // MCQ — classic 4-option layout, B is correct.
    '"What is the capital of France?","London","Paris","Berlin","Madrid","B",1,"Paris is the capital of France.","MCQ","Geography",0,"MEDIUM"',
    // TRUE_FALSE — options auto-generated; correct_answer uses true/false.
    '"The Earth revolves around the Sun.",,,,,true,1,"Heliocentric model.","TRUE_FALSE","Astronomy",0.25,"EASY"',
    // FILL_BLANK — the answer is in option_a (mapped to correct_text); the
    // correct_answer column is ignored for this type.
    '"The chemical symbol for water is ____.","H2O",,,,,1,"Two hydrogen + one oxygen.","FILL_BLANK","Chemistry",0,"MEDIUM"',
    // MATCHING — pairs are encoded in option_a/b + option_c/d.
    '"Match the country to its capital.","France","Paris","Japan","Tokyo",,1,"Two pairs.","MATCHING","Geography",0,"HARD"',
    // CODING — reference solution goes in option_a (mapped to correct_text).
    '"Write a function that returns 4.","function four() { return 4; }",,,,,2,"Trivial implementation.","CODING","Programming",0,"MEDIUM"',
  ]
  return [header, ...rows].join("\n")
}

// ─── Generic CSV export helpers (used by admin tables) ───────────────────────

/**
 * Escape a single cell value for CSV. Quotes fields containing commas, double
 * quotes, or newlines; doubles any internal double-quote per RFC 4180.
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = typeof value === "string" ? value : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Build a CSV string from a header row and an array of data rows. Each row
 * is the raw (unescaped) cell values — `csvEscape` is applied per cell.
 */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(csvEscape).join(",")
  const dataLines = rows.map((row) => row.map(csvEscape).join(","))
  return [headerLine, ...dataLines].join("\n")
}

/**
 * Trigger a client-side download of a CSV string. Creates a Blob, generates
 * an object URL, programmatically clicks a temporary <a>, then revokes the
 * URL. The filename should end in `.csv`.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke so the click has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 500)
}
