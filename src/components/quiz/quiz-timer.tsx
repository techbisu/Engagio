"use client"

import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuizTimerProps {
  secondsLeft: number
  total: number
}

function formatMMSS(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`
}

export function QuizTimer({ secondsLeft, total }: QuizTimerProps) {
  const danger = secondsLeft <= 60
  const warning = !danger && secondsLeft <= 120
  // Treat "no time limit" (total = 0) as calm green
  const unlimited = total <= 0

  const color = unlimited
    ? "text-emerald-600 dark:text-emerald-400"
    : danger
      ? "text-red-600 dark:text-red-400"
      : warning
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400"

  const bg = unlimited
    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900"
    : danger
      ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900"
      : warning
        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900"
        : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900"

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold tabular-nums",
        color,
        bg,
        danger && "animate-pulse",
      )}
      aria-live="polite"
    >
      <Clock className="size-4" />
      <span className="font-mono">
        {unlimited ? "No limit" : formatMMSS(secondsLeft)}
      </span>
    </div>
  )
}
