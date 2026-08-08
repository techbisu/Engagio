"use client"

import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { PublicQuestion } from "@/components/student/api"

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"]

interface QuestionCardProps {
  index: number
  total: number
  question: PublicQuestion
  selected: number | undefined
  onSelect: (idx: number) => void
}

/**
 * Presentational question card. Animations are handled by the parent
 * (quiz-runner) using AnimatePresence so this component stays pure.
 */
export function QuestionCard({
  index,
  total,
  question,
  selected,
  onSelect,
}: QuestionCardProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900"
        >
          Question {index + 1} of {total}
        </Badge>
        <Badge variant="secondary" className="font-medium">
          {question.marks} {question.marks === 1 ? "mark" : "marks"}
        </Badge>
      </div>

      <h2 className="text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100 sm:text-xl">
        {question.question}
      </h2>

      <RadioGroup
        value={selected !== undefined ? String(selected) : undefined}
        onValueChange={(v) => onSelect(Number(v))}
        className="gap-3"
      >
        {question.options.map((opt, i) => {
          const letter = LETTERS[i] ?? String(i + 1)
          const isSelected = selected === i
          return (
            <Label
              key={i}
              htmlFor={`opt-${question.id}-${i}`}
              className={cn(
                "group flex cursor-pointer items-start gap-3 rounded-lg border p-3 sm:p-4 transition-all",
                "hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30",
                isSelected
                  ? "border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40 ring-1 ring-emerald-500/40"
                  : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  isSelected
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-emerald-900/60 dark:group-hover:text-emerald-300",
                )}
              >
                {letter}
              </span>
              <span className="flex-1 text-sm leading-relaxed text-slate-800 dark:text-slate-100 sm:text-base">
                {opt}
              </span>
              <RadioGroupItem
                id={`opt-${question.id}-${i}`}
                value={String(i)}
                className="sr-only"
              />
            </Label>
          )
        })}
      </RadioGroup>
    </div>
  )
}
