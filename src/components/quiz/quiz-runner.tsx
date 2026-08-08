"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  ShieldCheck,
  ListChecks,
  Flag,
  Camera,
  CameraOff,
  Eye,
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
import { useAiProctor } from "@/hooks/use-ai-proctor"
import { api } from "@/components/student/api"
import type {
  PublicQuestion,
  SecurityConfig,
  StartAttemptResponse,
  SubmitAttemptResponse,
} from "@/components/student/api"
import type { SafeUser } from "@/types"
import { QuizTimer } from "./quiz-timer"
import { QuestionNavigator } from "./question-navigator"
import { QuestionCard, type QuestionAnswer } from "./question-card"
import { QuizResults } from "./quiz-results"
import { WatermarkOverlay } from "./watermark-overlay"
import { SecuritySidebar, type SecurityMetrics } from "./security-sidebar"

type RunnerStatus = "loading" | "active" | "submitting" | "done" | "error"

const DEFAULT_SECURITY: SecurityConfig = {
  autoSubmitOnExit: false,
  tabSwitchDetection: false,
  copyPasteBlocking: false,
  rightClickDisable: false,
  keyboardShortcutBlocking: false,
  devtoolsDetection: false,
  antiScreenshot: false,
  watermarkOverlay: false,
  aiProctor: false,
  aiProctorFaceDetection: false,
  aiProctorMultiFace: false,
  aiProctorLookAway: false,
}

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
  user,
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
  const [security, setSecurity] = useState<SecurityConfig>(DEFAULT_SECURITY)
  const [answers, setAnswers] = useState<
    Record<string, QuestionAnswer>
  >({})
  const [flagged, setFlagged] = useState<string[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [direction, setDirection] = useState(1)
  const [secondsLeft, setSecondsLeft] = useState(timeLimit * 60)
  const [timerStarted, setTimerStarted] = useState(!requireFullscreen)
  const [awaitingFullscreen, setAwaitingFullscreen] = useState(requireFullscreen)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenBlocked, setFullscreenBlocked] = useState(false)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(true)
  const [securitySheetOpen, setSecuritySheetOpen] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitAttemptResponse | null>(null)

  // AI proctor permission gate state.
  const [cameraGateOpen, setCameraGateOpen] = useState(false)
  const [proctorBypassed, setProctorBypassed] = useState(false)

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
        setSecurity(data.security ?? DEFAULT_SECURITY)
        // If AI proctor is enabled, open the camera gate before activating.
        if (data.security?.aiProctor) {
          setCameraGateOpen(true)
        }
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
  }, [quizLinkId, timeLimit])

  // ----- Anti-cheat callbacks (stable via useCallback) -----
  const handleAutoSubmit = useCallback(() => {
    toast.error("Auto-submitting quiz", {
      description: "You exited fullscreen and did not return in time.",
    })
    void doSubmitRef.current?.(false)
  }, [])

  const counters = useAntiCheat({
    enabled: status === "active" && !cameraGateOpen,
    config: security,
    warnBeforeUnload: status === "active",
    onAutoSubmit: handleAutoSubmit,
  })

  // ----- AI proctor — only mounted when security.aiProctor is true AND the
  //       student has either granted camera permission or chosen to bypass.
  //       We pass `enabled = aiProctor && !proctorBypassed` so the hook stops
  //       the camera stream if the student later chooses to bypass.
  const aiProctor = useAiProctor({
    enabled:
      security.aiProctor && !cameraGateOpen && !proctorBypassed && status === "active",
    faceDetection: security.aiProctorFaceDetection,
    multiFace: security.aiProctorMultiFace,
    lookAway: security.aiProctorLookAway,
  })

  // If the proctor hook reports a camera error after the gate was closed,
  // surface it as a non-blocking toast.
  useEffect(() => {
    if (aiProctor.error && status === "active") {
      toast.error("AI proctor error", {
        description: aiProctor.error,
      })
    }
  }, [aiProctor.error, status])

  // ----- Combined metrics object for the sidebar -----
  const combinedMetrics: SecurityMetrics = useMemo(
    () => ({
      tabSwitches: counters.tabSwitches,
      fullscreenExits: counters.fullscreenExits,
      copyAttempts: counters.copyAttempts,
      rightClicks: counters.rightClicks,
      devtoolsOpen: counters.devtoolsOpen,
      screenshotAttempts: counters.screenshotAttempts,
      keyboardViolations: counters.keyboardViolations,
      faceNotDetected: aiProctor.faceNotDetected,
      multiFaceAlerts: aiProctor.multiFaceAlerts,
      lookAwayAlerts: aiProctor.lookAwayAlerts,
    }),
    [counters, aiProctor],
  )

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
  }, [timerStarted, status, timeLimit, totalSeconds])

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
            devtoolsOpen: counters.devtoolsOpen,
            screenshotAttempts: counters.screenshotAttempts,
            keyboardViolations: counters.keyboardViolations,
            faceNotDetected: aiProctor.faceNotDetected,
            multiFaceAlerts: aiProctor.multiFaceAlerts,
            lookAwayAlerts: aiProctor.lookAwayAlerts,
            flaggedQuestions: flagged,
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
    [
      attemptId,
      answers,
      counters.tabSwitches,
      counters.fullscreenExits,
      counters.copyAttempts,
      counters.rightClicks,
      counters.devtoolsOpen,
      counters.screenshotAttempts,
      counters.keyboardViolations,
      aiProctor.faceNotDetected,
      aiProctor.multiFaceAlerts,
      aiProctor.lookAwayAlerts,
      flagged,
      totalSeconds,
    ],
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

  const handleAnswer = useCallback(
    (qId: string, value: QuestionAnswer) => {
      setAnswers((a) => ({ ...a, [qId]: value }))
    },
    [],
  )

  const toggleFlag = useCallback((qId: string) => {
    setFlagged((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId],
    )
  }, [])

  const answeredArr = questions.map((q) => {
    const a = answers[q.id]
    if (a === undefined || a === null) return false
    if (typeof a === "string") return a.trim().length > 0
    if (typeof a === "number") return true
    if (typeof a === "object") {
      // MATCHING — answered if at least one pair is set.
      return Object.keys(a).length > 0
    }
    return false
  })
  const answeredCount = answeredArr.filter(Boolean).length
  const flaggedArr = questions.map((q) => flagged.includes(q.id))

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

  // ----- Camera gate handlers (AI proctor permission flow) -----
  const handleCameraGranted = () => {
    setCameraGateOpen(false)
    toast.success("AI proctoring active", {
      description: "Camera access granted. Stay visible to the camera.",
    })
  }

  const handleCameraError = () => {
    // The proctor hook will set `aiProctor.error` — surface a softer prompt.
    toast.warning("Camera unavailable", {
      description:
        "AI proctoring is inactive. You can continue but the quiz will be flagged for manual review.",
    })
  }

  const handleContinueWithoutProctor = () => {
    setProctorBypassed(true)
    setCameraGateOpen(false)
    toast.warning("Continuing without AI proctor", {
      description: "Your attempt will be flagged for manual review.",
    })
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
    return <QuizResults attemptId={attemptId} user={user} onBack={onExit} />
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
      {/* Watermark overlay — always rendered as a sibling of the quiz content.
          Renders nothing when security.watermarkOverlay is false. */}
      <WatermarkOverlay
        email={user.email}
        enabled={security.watermarkOverlay && status === "active"}
      />

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
            {flagged.length > 0 && (
              <Badge
                variant="outline"
                className="hidden gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 sm:inline-flex"
              >
                <Flag className="size-3" /> {flagged.length} flagged
              </Badge>
            )}
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

      {/* Main content — 3-column layout on xl: questions + navigator + security */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:gap-8 lg:p-8 xl:max-w-7xl">
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
                      answer={answers[currentQ.id]}
                      onAnswer={(v) => handleAnswer(currentQ.id, v)}
                      isFlagged={flagged.includes(currentQ.id)}
                      onToggleFlag={() => toggleFlag(currentQ.id)}
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

        {/* Desktop navigator sidebar (lg+) */}
        <aside className="hidden w-64 shrink-0 lg:block xl:hidden">
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
                flagged={flaggedArr}
                onJump={jumpTo}
              />
            </CardContent>
          </Card>
        </aside>

        {/* Security sidebar (xl+) */}
        <SecuritySidebar
          metrics={combinedMetrics}
          config={security}
          isOpen={securityOpen}
          onToggle={() => setSecurityOpen((v) => !v)}
          proctor={
            security.aiProctor
              ? {
                  isReady: aiProctor.isReady,
                  error: aiProctor.error,
                }
              : null
          }
          videoRef={aiProctor.videoRef}
        />
      </main>

      {/* Mobile floating buttons: question navigator + security monitor */}
      <div className="fixed bottom-4 right-4 z-20 flex flex-col gap-2 lg:hidden">
        <Button
          onClick={() => setSecuritySheetOpen(true)}
          className="rounded-full bg-slate-700 text-white shadow-lg hover:bg-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
          size="icon"
          aria-label="Open security monitor"
        >
          <ShieldCheck className="size-5" />
        </Button>
        <Button
          onClick={() => setSheetOpen(true)}
          className="rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700"
          size="icon"
          aria-label="Open question navigator"
        >
          <ListChecks className="size-5" />
        </Button>
      </div>

      {/* Mobile question navigator sheet */}
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
              flagged={flaggedArr}
              onJump={jumpTo}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile security sheet — body mirrors the desktop sidebar */}
      <Sheet open={securitySheetOpen} onOpenChange={setSecuritySheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" /> Security Monitor
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 pt-2">
            <SecuritySidebarBodyInline
              metrics={combinedMetrics}
              config={security}
              proctor={
                security.aiProctor
                  ? {
                      isReady: aiProctor.isReady,
                      error: aiProctor.error,
                    }
                  : null
              }
              videoRef={aiProctor.videoRef}
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
                {security.tabSwitchDetection && (
                  <li className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    Tab switches are logged.
                  </li>
                )}
                {security.copyPasteBlocking && (
                  <li className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    Copy / paste is blocked.
                  </li>
                )}
                {security.rightClickDisable && (
                  <li className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    Right-click is disabled.
                  </li>
                )}
                {security.devtoolsDetection && (
                  <li className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    Developer tools detection is active.
                  </li>
                )}
                {security.antiScreenshot && (
                  <li className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    Screenshots are blocked.
                  </li>
                )}
                {security.keyboardShortcutBlocking && (
                  <li className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    Browser keyboard shortcuts are blocked.
                  </li>
                )}
                {security.aiProctor && (
                  <li className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    AI proctoring is enabled (camera required).
                  </li>
                )}
                {security.watermarkOverlay && (
                  <li className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    A watermark with your email will be overlaid on the screen.
                  </li>
                )}
                {security.autoSubmitOnExit && (
                  <li className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                    Exiting fullscreen will auto-submit after 3 seconds.
                  </li>
                )}
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

      {/* AI Proctor camera permission gate — shown when security.aiProctor is
          on and the camera hasn't been authorized yet. The gate prevents the
          quiz from being interactable until the student either grants camera
          access or chooses to continue without AI proctor (which logs the
          bypass). */}
      {cameraGateOpen && status === "active" && (
        <CameraPermissionGate
          onGranted={handleCameraGranted}
          onError={handleCameraError}
          onContinueWithout={handleContinueWithoutProctor}
        />
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
              {flagged.length > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {flagged.length} flagged for review.
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

// ---------------------------------------------------------------------------
// Camera permission gate — rendered as a sibling overlay when AI proctor
// requires camera authorization. Tries getUserMedia directly; on success
// notifies the parent via onGranted (the parent then unmounts the gate, and
// the useAiProctor hook re-opens the stream).
// ---------------------------------------------------------------------------
function CameraPermissionGate({
  onGranted,
  onError,
  onContinueWithout,
}: {
  onGranted: () => void
  onError: () => void
  onContinueWithout: () => void
}) {
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestCamera = async () => {
    setChecking(true)
    setError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser")
      }
      // Request the stream just to confirm permission. The useAiProctor hook
      // will re-request it (browser caches the grant) when the gate closes.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      })
      // Stop tracks immediately — the hook will reopen its own stream.
      stream.getTracks().forEach((t) => t.stop())
      onGranted()
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to access camera"
      setError(msg)
      onError()
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
            <Camera className="size-8 text-emerald-600" />
          </div>
          <CardTitle className="text-xl">Camera access required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            This quiz uses AI proctoring. Your camera will be used to verify your
            identity and detect potential academic dishonesty. No video is
            recorded or transmitted — all analysis runs locally in your browser.
          </p>
          <ul className="space-y-1.5 text-left text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <Eye className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
              Face presence is checked periodically.
            </li>
            <li className="flex items-start gap-2">
              <Eye className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
              Multiple faces in frame trigger an alert.
            </li>
            <li className="flex items-start gap-2">
              <Eye className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
              Looking away from the screen is logged.
            </li>
          </ul>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Button
              onClick={requestCamera}
              disabled={checking}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {checking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {checking ? "Requesting…" : "Grant camera access"}
            </Button>
            <Button
              onClick={onContinueWithout}
              variant="outline"
              className="w-full gap-1.5"
            >
              <CameraOff className="size-4" /> Continue without AI proctor
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Local helper that renders the body of the mobile security Sheet. The
// SecuritySidebar component renders its own Sheet controlled by its `isOpen`
// prop — but on mobile we want a separate Sheet that the floating button
// controls. This inline duplicate keeps it simple and avoids circular refs.
// ---------------------------------------------------------------------------
function SecuritySidebarBodyInline({
  metrics,
  config,
  proctor,
  videoRef,
}: {
  metrics: SecurityMetrics
  config: SecurityConfig
  proctor: { isReady: boolean; error: string | null } | null
  videoRef?: React.RefObject<HTMLVideoElement | null>
}) {
  const faceStatus: "ok" | "warn" | "off" = proctor
    ? proctor.error
      ? "off"
      : proctor.isReady && metrics.faceNotDetected === 0
        ? "ok"
        : "warn"
    : "off"
  return (
    <div className="space-y-3">
      {config.aiProctor && proctor && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700">
          <div className="relative aspect-video w-full bg-black">
            <video
              ref={videoRef}
              className="size-full object-cover"
              muted
              playsInline
              autoPlay
            />
            <div className="absolute left-1.5 top-1.5">
              <Badge
                variant="secondary"
                className={cn(
                  "gap-1 px-1.5 py-0.5 text-[10px] font-semibold",
                  faceStatus === "ok"
                    ? "bg-emerald-500/90 text-white"
                    : faceStatus === "warn"
                      ? "bg-amber-500/90 text-white"
                      : "bg-red-500/90 text-white",
                )}
              >
                <Camera className="size-3" />
                {proctor.error
                  ? "OFFLINE"
                  : proctor.isReady
                    ? "LIVE"
                    : "…"}
              </Badge>
            </div>
          </div>
        </div>
      )}
      <Separator />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric label="Tab switches" value={metrics.tabSwitches} active={config.tabSwitchDetection} />
        <Metric label="Fullscreen exits" value={metrics.fullscreenExits} active />
        <Metric label="Copy attempts" value={metrics.copyAttempts} active={config.copyPasteBlocking} />
        <Metric label="Right-clicks" value={metrics.rightClicks} active={config.rightClickDisable} />
        <Metric label="DevTools opened" value={metrics.devtoolsOpen} active={config.devtoolsDetection} />
        <Metric label="Screenshots" value={metrics.screenshotAttempts} active={config.antiScreenshot} />
        <Metric label="Keyboard violations" value={metrics.keyboardViolations} active={config.keyboardShortcutBlocking} />
        {config.aiProctor && (
          <>
            <Metric label="Face not detected" value={metrics.faceNotDetected} active={config.aiProctorFaceDetection} />
            <Metric label="Multi-face alerts" value={metrics.multiFaceAlerts} active={config.aiProctorMultiFace} />
            <Metric label="Look-aways" value={metrics.lookAwayAlerts} active={config.aiProctorLookAway} />
          </>
        )}
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  active,
}: {
  label: string
  value: number
  active: boolean
}) {
  if (!active) return null
  const tone =
    value === 0
      ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      : value <= 3
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
        : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
  return (
    <div className={cn("flex items-center justify-between rounded-md px-2 py-1.5", tone)}>
      <span className="truncate">{label}</span>
      <span className="tabular-nums font-semibold">{value}</span>
    </div>
  )
}
