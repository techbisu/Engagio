import type { CsvRow } from "@/types"

/**
 * Parse CSV text into structured question rows.
 * Expected header format:
 *   question, option_a, option_b, option_c, option_d, correct_answer, marks, explanation
 * `correct_answer` can be a letter (A/B/C/D) or 1-based index.
 * `marks` and `explanation` are optional.
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
    correct: header.findIndex((h) => h.startsWith("correct")),
    marks: header.findIndex((h) => h === "marks"),
    explanation: header.findIndex((h) => h.startsWith("explanation")),
  }

  if (idx.question < 0) errors.push("Missing 'question' column.")
  if (idx.a < 0 || idx.b < 0) errors.push("Need at least option_a and option_b columns.")
  if (idx.correct < 0) errors.push("Missing 'correct_answer' column.")
  if (errors.length) return { rows: [], errors }

  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]
    if (!cells || cells.every((c) => !c.trim())) continue
    const question = cells[idx.question]?.trim() || ""
    if (!question) {
      errors.push(`Row ${i + 1}: empty question text.`)
      continue
    }

    const options: string[] = []
    for (const colIdx of [idx.a, idx.b, idx.c, idx.d]) {
      if (colIdx >= 0) {
        const opt = cells[colIdx]?.trim() || ""
        if (opt) options.push(opt)
      }
    }
    if (options.length < 2) {
      errors.push(`Row ${i + 1}: needs at least 2 options.`)
      continue
    }

    const rawCorrect = (cells[idx.correct] || "").trim()
    let correctAnswer = -1
    if (/^[a-zA-Z]$/.test(rawCorrect)) {
      correctAnswer = rawCorrect.toUpperCase().charCodeAt(0) - 65
    } else if (/^\d+$/.test(rawCorrect)) {
      correctAnswer = parseInt(rawCorrect, 10) - 1 // 1-based -> 0-based
    }
    if (correctAnswer < 0 || correctAnswer >= options.length) {
      errors.push(`Row ${i + 1}: invalid correct_answer "${rawCorrect}".`)
      continue
    }

    const marks = idx.marks >= 0 ? parseInt(cells[idx.marks] || "1", 10) || 1 : 1
    const explanation =
      idx.explanation >= 0 ? cells[idx.explanation]?.trim() || undefined : undefined

    rows.push({ question, options, correctAnswer, marks, explanation })
  }

  return { rows, errors }
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
  return [
    "question,option_a,option_b,option_c,option_d,correct_answer,marks,explanation",
    "What is the capital of France?,London,Paris,Berlin,Madrid,B,1,Paris is the capital of France.",
    "Which planet is known as the Red Planet?,Venus,Mars,Jupiter,Saturn,B,1,Mars appears red due to iron oxide.",
  ].join("\n")
}
