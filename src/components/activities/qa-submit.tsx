"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowBigUp,
  Loader2,
  MessageCircleQuestion,
  Pin,
  Send,
  ThumbsUp,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { api } from "./api"
import type {
  ActivityDto,
  ActivityResultsDto,
  QaUpvoteBody,
  QaUpvoteResponse,
} from "./api"

export interface QASubmitProps {
  activity: ActivityDto
  onSubmit?: (text: string) => void
}

/**
 * QASubmit — participant UI for Q_AND_A activities.
 *
 * Lets participants submit open-ended questions, then upvote other people's
 * approved questions. Fetches approved questions every 5s for a live feel.
 */
export function QASubmit({ activity, onSubmit }: QASubmitProps) {
  const [text, setText] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [upvoting, setUpvoting] = React.useState<string | null>(null)
  const queryClient = useQueryClient()

  // Live feed of approved questions, sorted by upvotes then pinned-first.
  const resultsQuery = useQuery<ActivityResultsDto>({
    queryKey: ["activity-results", activity.id],
    queryFn: () =>
      api<ActivityResultsDto>(`/api/activities/${activity.id}/results`),
    refetchInterval: 5_000,
  })

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed) {
      toast.error("Please type your question first.")
      return
    }
    setSubmitting(true)
    try {
      // Submit as a single OPEN question response.
      await api(`/api/activities/${activity.id}/respond`, {
        method: "POST",
        body: JSON.stringify({
          responses: [
            {
              text: trimmed,
            },
          ],
        }),
      })
      toast.success("Question submitted!")
      setText("")
      onSubmit?.(trimmed)
      // Refresh the live feed so the new question shows up (when approved).
      resultsQuery.refetch()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit question"
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpvote = async (responseId: string) => {
    setUpvoting(responseId)
    try {
      const body: QaUpvoteBody = { responseId }
      await api<QaUpvoteResponse>(
        `/api/activities/${activity.id}/qa/upvote`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      )
      // Optimistically invalidate — server will return the new counts.
      queryClient.invalidateQueries({
        queryKey: ["activity-results", activity.id],
      })
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to upvote question"
      toast.error(msg)
    } finally {
      setUpvoting(null)
    }
  }

  const questions = React.useMemo(() => {
    const list = resultsQuery.data?.questions ?? []
    return [...list].sort((a, b) => {
      // Pinned first
      const pa = a.metadata.pinned ? 1 : 0
      const pb = b.metadata.pinned ? 1 : 0
      if (pa !== pb) return pb - pa
      // Then by upvotes desc
      const ua = a.metadata.upvotes ?? 0
      const ub = b.metadata.upvotes ?? 0
      return ub - ua
    })
  }, [resultsQuery.data])

  return (
    <div className="space-y-4">
      {/* Compose card */}
      <Card className="border-emerald-100 dark:border-emerald-900/40">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageCircleQuestion className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
                Ask a question
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Your question will appear once the moderator approves it.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your question…"
            rows={3}
            className="min-h-[88px] resize-y"
            maxLength={500}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {text.length}/500
            </span>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !text.trim()}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="size-4" /> Ask
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live feed */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Audience questions
          </h3>
          {resultsQuery.isFetching && (
            <span className="text-xs text-muted-foreground">Updating…</span>
          )}
        </div>
        {resultsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No questions yet. Be the first to ask!
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {questions.map((q) => {
                const isPinned = !!q.metadata.pinned
                const upvotes = q.metadata.upvotes ?? 0
                const isUpvoting = upvoting === q.id
                return (
                  <motion.li
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Card
                      className={cn(
                        "transition-colors",
                        isPinned
                          ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                          : "border-slate-200 dark:border-slate-800",
                      )}
                    >
                      <CardContent className="flex items-start gap-3 p-3 sm:p-4">
                        <button
                          type="button"
                          onClick={() => handleUpvote(q.id)}
                          disabled={isUpvoting}
                          aria-label="Upvote this question"
                          className={cn(
                            "flex min-w-[56px] flex-col items-center justify-center rounded-lg border-2 px-2 py-1.5 transition-all",
                            "hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                            "disabled:cursor-not-allowed disabled:opacity-60",
                            "dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40",
                            "border-slate-200 dark:border-slate-700",
                          )}
                        >
                          {isUpvoting ? (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          ) : (
                            <ArrowBigUp className="size-5 text-emerald-600 dark:text-emerald-400" />
                          )}
                          <span className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                            {upvotes}
                          </span>
                        </button>
                        <div className="min-w-0 flex-1">
                          {isPinned && (
                            <Badge
                              variant="outline"
                              className="mb-1 border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              <Pin className="size-3" /> Pinned
                            </Badge>
                          )}
                          <p className="break-words text-sm leading-relaxed text-foreground sm:text-base">
                            {q.text}
                          </p>
                          {q.participantName && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              — {q.participantName}
                            </p>
                          )}
                        </div>
                        <ThumbsUp
                          className="hidden size-4 shrink-0 text-emerald-500 sm:block"
                          aria-hidden="true"
                        />
                      </CardContent>
                    </Card>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  )
}
