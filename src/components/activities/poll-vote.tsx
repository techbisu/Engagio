"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Check, Loader2, Vote } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { api } from "./api"
import type {
  ActivityDto,
  ActivityQuestionDto,
  RespondBody,
  RespondResponse,
} from "./api"

export interface PollVoteProps {
  activity: ActivityDto
  question: ActivityQuestionDto
  /** Optional callback fired after a successful submission. */
  onSubmit?: (selectedOptions: number[]) => void
}

/**
 * PollVote — participant UI for POLL / VOTING activities.
 *
 * Renders the question + options as large touch-friendly cards.
 * - SINGLE_CHOICE → tap-to-select single card (radio-like)
 * - MULTIPLE_CHOICE → multi-select with checkmarks
 *
 * On submit, POSTs to /api/activities/[id]/respond with the selected options.
 */
export function PollVote({ activity, question, onSubmit }: PollVoteProps) {
  const isMultiple = question.type === "MULTIPLE_CHOICE"
  const [selected, setSelected] = React.useState<number[]>([])
  const [submitting, setSubmitting] = React.useState(false)

  const toggleOption = (idx: number) => {
    if (isMultiple) {
      setSelected((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
      )
    } else {
      setSelected([idx])
    }
  }

  const canSubmit = selected.length > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const body: RespondBody = {
        responses: [
          {
            questionId: question.id,
            selectedOptions: selected,
          },
        ],
      }
      await api<RespondResponse>(
        `/api/activities/${activity.id}/respond`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      )
      toast.success(isMultiple ? "Votes submitted!" : "Vote submitted!")
      onSubmit?.(selected)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit vote"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-emerald-100 dark:border-emerald-900/40">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Vote className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isMultiple ? "Select all that apply" : "Pick one option"}
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-foreground sm:text-2xl">
              {question.text}
            </h2>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className="grid gap-2.5"
          role={isMultiple ? "group" : "radiogroup"}
          aria-label="Poll options"
        >
          {question.options.map((opt, idx) => {
            const isSelected = selected.includes(idx)
            return (
              <motion.button
                key={idx}
                type="button"
                role={isMultiple ? "checkbox" : "radio"}
                aria-checked={isSelected}
                onClick={() => toggleOption(idx)}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "group flex min-h-[52px] w-full items-center gap-3 rounded-xl border-2 bg-white px-4 py-3 text-left transition-all",
                  "hover:border-emerald-300 hover:bg-emerald-50/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                  "dark:bg-slate-900 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30",
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/40"
                    : "border-slate-200 dark:border-slate-800",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md border-2 transition-all",
                    isSelected
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 text-transparent dark:border-slate-600",
                  )}
                >
                  <Check className="size-4" strokeWidth={3} />
                </span>
                <span
                  className={cn(
                    "flex-1 text-sm font-medium sm:text-base",
                    isSelected
                      ? "text-emerald-900 dark:text-emerald-100"
                      : "text-foreground",
                  )}
                >
                  {opt}
                </span>
                {isMultiple && isSelected && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Selected
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="mt-2 w-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:min-w-[180px]"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Submitting…
            </>
          ) : (
            <>
              <Vote className="size-4" />{" "}
              {isMultiple ? "Submit Votes" : "Submit Vote"}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
