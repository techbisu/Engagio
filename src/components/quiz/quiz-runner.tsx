"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Maximize,
  Send,
  ShieldAlert,
  ListChecks,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"

import { cn } from "@/lib/utils"
import { useAntiCheat } from "@/hooks/use-anti-cheat"
import { api } from "@/components/student/api"
import type {
  PublicQuestion,
  StartAttemptResponse,
  SubmitAttemptResponse,
} from "@/components/student/api"
import type { SafeUser } from "@/types"
import { QuizTimer } from "./quiz-timer"
import { QuestionNavigator } from "./question-navigator"
import { QuestionCard } from "./question-card"
import { QuizResults } from "./quiz-results"

type RunnerStatus = "loading" | "active" | "submitting" | "done" | "error"

interface QuizRunnerProps {
  quizLinkId: string
  requireFullscreen: boolean
  timeLimit: number // minutes
  user: SafeUser
  quizTitle?: string
  onExit: () => void
}

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
}

export function QuizRunner({
  quizLinkId,
  requireFullscreen,
  timeLimit,
  quizTitle = "Quiz",
  onExit,
}: QuizRunnerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const submittedRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const deadlineRef = useRef<number | null>(null)
  const doSubmitRef = useRef<((isTimeout: boolean) => Promise<void>) | null>(null)

  const [status, setStatus] = useState<RunnerStatus>("loading")
  const [error, setError] = useState<string | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<PublicQuestion[]>([])
  const [totalMarks, setTotalMarks] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [secondsLeft, setSecondsLeft] = useState(timeLimit * 60)
  const [timerStarted, setTimerStarted] = useState(!requireFullscreen)
  const [awaitingFullscreen, setAwaitingFullscreen] = useState(requireFullscreen)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenBlocked, setFullscreenBlocked] = useState(false)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitAttemptResponse | null>(null)

  const totalSeconds = timeLimit * 60

  // ----- Start the attempt on mount -----
  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const data = await api<StartAttemptResponse>("/api/attempts/start", {
          method: "POST",
          body: JSON.stringify({ quizLinkId }),
        })
        if (cancelled) return
        setAttemptId(data.attemptId)
        setQuestions(data.questions)
        setTotalMarks(data.totalMarks)
        setSecondsLeft((data.timeLimit || timeLimit) * 60)
        setStatus("active")
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to start quiz")
        setStatus("error")
      }
    }
    start()
    return () => {
      cancelled = true
    }
  }, [quizLinkId])

  // ----- Anti-cheat callbacks (stable via useCallback) -----
  const handleTabSwitch = useCallback(() => {
    toast.warning("Tab switch detected!", {
      description: "Switching tabs is logged and may affect your score.",
    })
  }, [])

  const handleFullscreenExit = useCallback(() => {
    if (!requireFullscreen) return
    toast.warning("Please stay in fullscreen!", {
      description: "Re-enter fullscreen to continue properly.",
    })
  }, [requireFullscreen])

  const handleCopyAttempt = useCallback(() => {
    toast.warning("Copying is disabled!", {
      description: "This action has been logged.",
    })
  }, [])

  const handleRightClick = useCallback(() => {
    toast.warning("Right-click is disabled!", {
      description: "This action has been logged.",
    })
  }, [])

  const counters = useAntiCheat({
    enabled: status === "active",
    warnBeforeUnload: status === "active",
    onTabSwitch: handleTabSwitch,
    onFullscreenExit: handleFullscreenExit,
    onCopyAttempt: handleCopyAttempt,
    onRightClick: handleRightClick,
  })

  // ----- Track fullscreen state -----
  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
      if (fs && awaitingFullscreen) {
        setAwaitingFullscreen(false)
        setTimerStarted(true)
      }
    }
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [awaitingFullscreen])

  // ----- Countdown timer -----
  useEffect(() => {
    if (!timerStarted || status !== "active") return
    if (timeLimit <= 0) return // no limit
    startedAtRef.current = Date.now()
    deadlineRef.current = Date.now() + totalSeconds * 1000
    const id = setInterval(() => {
      if (!deadlineRef.current) return
      const remaining = Math.max(
        0,
        Math.ceil((deadlineRef.current - Date.now()) / 1000),
      )
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        clearInterval(id)
        void doSubmitRef.current?.(true)
      }
    }, 250)
    return () => clearInterval(id)
  }, [timerStarted, status, timeLimit])

  // ----- Submit logic -----
  const doSubmit = useCallback(
    async (isTimeout: boolean) => {
      if (submittedRef.current || !attemptId) return
      submittedRef.current = true
      setStatus("submitting")
      const elapsed = startedAtRef.current
        ? Math.floor((Date.now() - startedAtRef.current) / 1000)
        : totalSeconds
      const timeTaken = isTimeout ? totalSeconds : Math.min(elapsed, totalSeconds)
      try {
        const res = await api<SubmitAttemptResponse>("/api/attempts/submit", {
          method: "POST",
          body: JSON.stringify({
            attemptId,
            answers,
            tabSwitches: counters.tabSwitches,
            fullscreenExits: counters.fullscreenExits,
            copyAttempts: counters.copyAttempts,
            rightClicks: counters.rightClicks,
            timeTaken,
          }),
        })
        setSubmitResult(res)
        setStatus("done")
        // Exit fullscreen if active
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {})
        }
      } catch (e) {
        submittedRef.current = false
        setError(e instanceof Error ? e.message : "Failed to submit quiz")
        setStatus("error")
        toast.error("Failed to submit", {
          description: e instanceof Error ? e.message : undefined,
        })
      }
    },
    [attemptId, answers, counters, totalSeconds],
  )

  // Keep doSubmitRef in sync so the timer interval always invokes the latest
  // version (which has the latest `answers` / `counters`) without re-creating
  // the interval on every state change.
  useEffect(() => {
    doSubmitRef.current = doSubmit
  }, [doSubmit])

  // ----- Navigation handlers -----
  const goNext = () => {
    if (currentIdx < questions.length - 1) {
      setDirection(1)
      setCurrentIdx((i) => i + 1)
    }
  }
  const goPrev = () => {
    if (currentIdx > 0) {
      setDirection(-1)
      setCurrentIdx((i) => i - 1)
    }
  }
  const jumpTo = (idx: number) => {
    setDirection(idx > currentIdx ? 1 : -1)
    setCurrentIdx(idx)
    setSheetOpen(false)
  }

  const selectOption = (idx: number) => {
    if (!questions[currentIdx]) return
    setAnswers((a) => ({ ...a, [questions[currentIdx].id]: idx }))
  }

  const answeredArr = questions.map((q) => answers[q.id] !== undefined)
  const answeredCount = answeredArr.filter(Boolean).length

  // ----- Fullscreen control -----
  const enterFullscreen = async () => {
    const el = containerRef.current
    if (!el) return
    // Feature-detect: some browsers / embedded contexts don't expose this.
    if (typeof el.requestFullscreen !== "function") {
      setFullscreenBlocked(true)
      toast.warning("Fullscreen unavailable", {
        description:
          "Your browser blocked fullscreen mode. You can continue without it but anti-cheat protection is reduced.",
      })
      return
    }
    try {
      // requestFullscreen must be called from a user gesture
      await el.requestFullscreen()
      // fullscreenchange listener will update isFullscreen / awaitingFullscreen
    } catch {
      setFullscreenBlocked(true)
      toast.warning("Fullscreen unavailable", {
        description:
          "Your browser blocked fullscreen mode. You can continue without it but anti-cheat protection is reduced.",
      })
    }
  }

  const continueWithoutFullscreen = () => {
    setAwaitingFullscreen(false)
    setTimerStarted(true)
    setFullscreenBlocked(true)
  }

  // ----- Render: loading -----
  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 dark:bg-slate-950">
        <Loader2 className="size-8 animate-spin text-emerald-600" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Starting your quiz…
        </p>
      </div>
    )
  }

  // ----- Render: error -----
  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 dark:bg-slate-950">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              <CardTitle>Something went wrong</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={onExit} className="w-full">
              <ArrowLeft className="size-4" /> Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ----- Render: submitted (no results shown) -----
  if (status === "done" && submitResult && !submitResult.showResults) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 dark:bg-slate-950">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <CheckCircle2 className="size-7 text-emerald-600" />
            </div>
            <CardTitle>Quiz submitted successfully</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Your answers have been recorded. Your instructor will share the
              results soon.
            </p>
            <Button onClick={onExit} className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ----- Render: results -----
  if (status === "done" && submitResult && submitResult.showResults && attemptId) {
    return <QuizResults attemptId={attemptId} onBack={onExit} />
  }

  // ----- Render: submitting -----
  if (status === "submitting") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 dark:bg-slate-950">
        <Loader2 className="size-8 animate-spin text-emerald-600" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Submitting your quiz…
        </p>
      </div>
    )
  }

  // ----- Render: active quiz -----
  const currentQ = questions[currentIdx]
  const progress = questions.length
    ? ((currentIdx + 1) / questions.length) * 100
    : 0

  return (
    <div
      ref={containerRef}
      className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950"
    >
      {/* Sticky top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ShieldAlert className="size-5 shrink-0 text-emerald-600" />
            <span
              className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base"
              title={quizTitle}
            >
              {quizTitle}
            </span>
          </div>
          <QuizTimer secondsLeft={secondsLeft} total={totalSeconds} />
          <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
            Q {currentIdx + 1} / {questions.length}
          </span>
          <Button
            size="sm"
            onClick={() => setShowSubmitDialog(true)}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Send className="size-4" /> Submit
          </Button>
        </div>
        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Non-blocking "re-enter fullscreen" banner */}
      {requireFullscreen && timerStarted && !isFullscreen && !awaitingFullscreen && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              <Maximize className="size-4" /> You&apos;ve exited fullscreen. Re-enter to keep anti-cheat active.
            </p>
            <Button size="sm" variant="outline" onClick={enterFullscreen} className="h-7 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300">
              <Maximize className="size-3" /> Re-enter
            </Button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:gap-8 lg:p-8">
        {/* Question column */}
        <section className="flex flex-1 flex-col">
          <Card className="flex-1">
            <CardContent className="p-5 sm:p-6">
              <AnimatePresence mode="wait" custom={direction}>
                {currentQ && (
                  <motion.div
                    key={currentQ.id}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <QuestionCard
                      index={currentIdx}
                      total={questions.length}
                      question={currentQ}
                      selected={currentQ ? answers[currentQ.id] : undefined}
                      onSelect={selectOption}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Navigation buttons */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={currentIdx === 0}
            >
              <ArrowLeft className="size-4" /> Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {answeredCount} of {questions.length} answered
            </span>
            {currentIdx === questions.length - 1 ? (
              <Button
                onClick={() => setShowSubmitDialog(true)}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Send className="size-4" /> Submit Quiz
              </Button>
            ) : (
              <Button onClick={goNext} className="bg-emerald-600 text-white hover:bg-emerald-700">
                Next <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </section>

        {/* Desktop navigator sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="size-4 text-emerald-600" /> Navigator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Answered</span>
                <Badge variant="secondary">{answeredCount}/{questions.length}</Badge>
              </div>
              <Separator />
              <QuestionNavigator
                total={questions.length}
                current={currentIdx}
                answered={answeredArr}
                onJump={jumpTo}
              />
            </CardContent>
          </Card>
        </aside>
      </main>

      {/* Mobile navigator floating button */}
      <div className="fixed bottom-4 right-4 z-20 lg:hidden">
        <Button
          onClick={() => setSheetOpen(true)}
          className="rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700"
          size="icon"
          aria-label="Open question navigator"
        >
          <ListChecks className="size-5" />
        </Button>
      </div>

      {/* Mobile navigator sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ListChecks className="size-4 text-emerald-600" /> Question Navigator
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Answered</span>
              <Badge variant="secondary">{answeredCount}/{questions.length}</Badge>
            </div>
            <Separator />
            <QuestionNavigator
              total={questions.length}
              current={currentIdx}
              answered={answeredArr}
              onJump={jumpTo}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Fullscreen prompt overlay */}
      {awaitingFullscreen && status === "active" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                <Maximize className="size-8 text-emerald-600" />
              </div>
              <CardTitle className="text-xl">Enter Fullscreen to Begin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                This quiz requires fullscreen mode for anti-cheat protection. Your
                timer will start once you enter fullscreen.
              </p>
              <ul className="space-y-1.5 text-left text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  Tab switches, copying, and right-clicks are logged.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  Exiting fullscreen will be recorded as a flag.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  Your IP and device info will be logged.
                </li>
              </ul>
              <div className="space-y-2">
                <Button
                  onClick={enterFullscreen}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Maximize className="size-4" /> Enter Fullscreen &amp; Begin
                </Button>
                {fullscreenBlocked && (
                  <Button
                    onClick={continueWithoutFullscreen}
                    variant="outline"
                    className="w-full"
                  >
                    Continue without fullscreen
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Submit confirmation dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {answeredCount} of {questions.length}
              </span>{" "}
              questions.{" "}
              {answeredCount < questions.length && (
                <span className="text-amber-600 dark:text-amber-400">
                  {questions.length - answeredCount} unanswered.
                </span>
              )}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => doSubmit(false)}
              className={cn("bg-emerald-600 text-white hover:bg-emerald-700")}
            >
              <Send className="size-4" /> Submit now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
