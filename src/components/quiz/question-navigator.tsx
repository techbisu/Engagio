"use client"

import { cn } from "@/lib/utils"

interface QuestionNavigatorProps {
  total: number
  current: number
  answered: boolean[]
  onJump: (idx: number) => void
}

export function QuestionNavigator({
  total,
  current,
  answered,
  onJump,
}: QuestionNavigatorProps) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(2.5rem, 1fr))" }}
      role="list"
      aria-label="Question navigator"
    >
      {Array.from({ length: total }).map((_, idx) => {
        const isCurrent = idx === current
        const isAnswered = answered[idx]
        return (
          <button
            key={idx}
            type="button"
            role="listitem"
            onClick={() => onJump(idx)}
            aria-label={`Go to question ${idx + 1}${
              isAnswered ? " (answered)" : " (unanswered)"
            }`}
            aria-current={isCurrent ? "true" : undefined}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md border text-sm font-medium transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isCurrent
                ? "border-emerald-500 bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/30"
                : isAnswered
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {idx + 1}
          </button>
        )
      })}
    </div>
  )
}
