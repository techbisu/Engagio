"use client"

import * as React from "react"
import { memo } from "react"
import { Flag, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface QuestionNavigatorProps {
  total: number
  current: number
  answered: boolean[]
  flagged?: boolean[]
  onJump: (idx: number) => void
}

export const QuestionNavigator = memo(function QuestionNavigator({
  total,
  current,
  answered,
  flagged,
  onJump,
}: QuestionNavigatorProps) {
  const [jumpInput, setJumpInput] = React.useState("")

  const handleJump = () => {
    const num = parseInt(jumpInput, 10)
    if (!isNaN(num) && num >= 1 && num <= total) {
      onJump(num - 1) // Convert 1-based to 0-based
      setJumpInput("")
    }
  }

  const answeredCount = answered.filter(Boolean).length
  const flaggedCount = flagged?.filter(Boolean).length || 0

  return (
    <div className="space-y-3">
      {/* Jump-to input */}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={total}
          placeholder={`Jump to (1-${total})`}
          value={jumpInput}
          onChange={(e) => setJumpInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleJump() }}
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={handleJump} disabled={!jumpInput}>
          Go
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">
          {answeredCount}/{total} answered
        </Badge>
        {flaggedCount > 0 && (
          <Badge variant="outline" className="border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400 text-xs">
            <Flag className="mr-1 size-3" />
            {flaggedCount} flagged
          </Badge>
        )}
      </div>

      {/* Question grid */}
      <div
        className="grid max-h-[400px] gap-2 overflow-y-auto"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(2.5rem, 1fr))" }}
        role="list"
        aria-label="Question navigator"
      >
        {Array.from({ length: total }).map((_, idx) => {
          const isCurrent = idx === current
          const isAnswered = answered[idx]
          const isFlagged = flagged?.[idx]
          return (
            <button
              key={idx}
              type="button"
              role="listitem"
              onClick={() => onJump(idx)}
              aria-label={`Go to question ${idx + 1}${
                isAnswered ? " (answered)" : " (unanswered)"
              }${isFlagged ? " (flagged for review)" : ""}`}
              aria-current={isCurrent ? "true" : undefined}
              className={cn(
                "relative flex h-10 w-10 items-center justify-center rounded-md border text-sm font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isCurrent
                  ? "border-emerald-500 bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/30"
                  : isAnswered
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {idx + 1}
              {isFlagged && (
                <Flag
                  className="absolute -right-1 -top-1 size-3 fill-amber-500 text-amber-500"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Quick prev/next */}
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={current === 0}
          onClick={() => onJump(current - 1)}
        >
          <ChevronLeft className="size-4" /> Prev
        </Button>
        <span className="text-xs text-muted-foreground">
          {current + 1} / {total}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={current === total - 1}
          onClick={() => onJump(current + 1)}
        >
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )

})
