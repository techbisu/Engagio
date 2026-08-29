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
  Eye,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import type { SecurityMetrics } from "./security-sidebar"
import { QuestionCard, type QuestionAnswer } from "./question-card"
import { QuizResults } from "./quiz-results"
import { WatermarkOverlay } from "./watermark-overlay"
import { ExamSidebar } from "./exam-sidebar"

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
  // Mirror awaitingFullscreen in a ref so the fullscreen safety timeout can
  // read the latest value without re-creating the timeout closure.
  const awaitingFullscreenRef = useRef(false)
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
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(true)
  const [submitResult, setSubmitResult] = useState<SubmitAttemptResponse | null>(null)

  // AI proctor permission gate state.
  const [cameraGateOpen, setCameraGateOpen] = useState(false)

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
  //       participant has granted camera permission (camera gate closed).
  //       There is no bypass — if the user denies camera access, they are
  //       returned to the dashboard, so we don't need a `proctorBypassed` flag.
  const aiProctor = useAiProctor({
    enabled:
      security.aiProctor && !cameraGateOpen && status === "active",
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
        awaitingFullscreenRef.current = false
        setTimerStarted(true)
      }
    }
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [awaitingFullscreen])

  // Sync the awaitingFullscreenRef with the state value.
  useEffect(() => {
    awaitingFullscreenRef.current = awaitingFullscreen
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
    }, 1000)
    return () => clearInterval(id)
  }, [timerStarted, status, timeLimit, totalSeconds])

  // ----- Submit logic -----
  const doSubmit = useCallback(
    async (isTimeout: boolean) => {
      if (submittedRef.current || !attemptId) return
      submittedRef.current = true
      setStatus("submitting")
      // Close any open dialogs (confirm dialog) before submitting
      setShowSubmitDialog(false)
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
    setMobilePanelOpen(false)
  }

  // ----- Touch swipe gesture (mobile only) -----
  // Swipe left → next question, swipe right → previous question.
  // Threshold: 50px horizontal movement, low vertical movement (to distinguish
  // from vertical scrolling). Touch events are passive — we don't prevent
  // default, so vertical scrolling still works.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }, [])
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current
      if (!start) return
      touchStartRef.current = null
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      // Only register as a swipe if horizontal movement is dominant and > 50px
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return
      if (dx < 0 && currentIdx < questions.length - 1) {
        // Swipe left → next
        setDirection(1)
        setCurrentIdx((i) => i + 1)
      } else if (dx > 0 && currentIdx > 0) {
        // Swipe right → previous
        setDirection(-1)
        setCurrentIdx((i) => i - 1)
      }
    },
    [currentIdx, questions.length],
  )

  // ----- Submit confirmation -----
  // The submit dialog is rendered INSIDE the fullscreen container (as a
  // child of containerRef) using fixed positioning. This works in fullscreen
  // mode because the fullscreen element acts as the rendering root — fixed
  // elements within it are visible. We MUST NOT use Radix Portal here,
  // because Portal teleports the dialog to document.body, which is OUTSIDE
  // the fullscreen element and would be invisible during fullscreen.
  // We also MUST NOT exit fullscreen before showing the dialog, because
  // `autoSubmitOnExit` would trigger an automatic submission.
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
      // Set a safety timeout: if fullscreenchange doesn't fire within 3s,
      // show the "Continue without fullscreen" option so the user isn't stuck.
      setTimeout(() => {
        if (awaitingFullscreenRef.current && !document.fullscreenElement) {
          setFullscreenBlocked(true)
        }
      }, 3000)
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
    awaitingFullscreenRef.current = false
    setTimerStarted(true)
    setFullscreenBlocked(true)
  }

  // ----- Camera gate handlers (AI proctor permission flow) -----
  // When AI proctor is enabled, the participant MUST grant camera permission.
  // There is NO "Continue without AI proctor" bypass — if the user denies
  // camera access or cancels, they are returned to the dashboard. This is a
  // strict requirement: AI security cannot be optional when the quiz link
  // has `aiProctor: true`.
  const handleCameraGranted = () => {
    setCameraGateOpen(false)
    toast.success("AI proctoring active", {
      description: "Camera access granted. Stay visible to the camera.",
    })
  }

  const handleCameraError = () => {
    // The proctor hook will set `aiProctor.error` — keep the gate open so the
    // user can retry or choose to go back.
  }

  const handleReturnToDashboard = () => {
    // User chose NOT to grant camera permission — return them to the dashboard.
    // This is the only exit path other than granting camera access.
    onExit()
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
      className="quiz-fullscreen relative flex h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-950"
    >
      {/* Watermark overlay — always rendered as a sibling of the quiz content.
          Renders nothing when security.watermarkOverlay is false. */}
      <WatermarkOverlay
        email={user.email}
        enabled={security.watermarkOverlay && status === "active"}
      />

      {/* Sticky top bar */}
      <header
        className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingLeft: "max(env(safe-area-inset-left, 0px), 0px)",
          paddingRight: "max(env(safe-area-inset-right, 0px), 0px)",
        }}
      >
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

      {/* Main content — 3-column layout on xl: questions + navigator + security.
          Mobile: scrollable with safe area insets. Desktop: side-by-side. */}
      <main
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 overflow-y-auto p-3 pb-6 sm:gap-6 sm:p-6 lg:flex-row lg:gap-8 lg:overflow-visible lg:p-8 xl:max-w-[90rem]"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingLeft: "max(env(safe-area-inset-left, 0px), 12px)",
          paddingRight: "max(env(safe-area-inset-right, 0px), 12px)",
        }}
      >
        {/* Question column — with touch swipe gesture for mobile navigation.
            Swipe left → next question, swipe right → previous question.
            Vertical scrolling still works (we only register horizontal swipes). */}
        <section
          className="flex flex-1 flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Card className="flex flex-1 flex-col overflow-hidden">
            <CardContent className="flex-1 p-5 sm:p-6">
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

            {/* Navigation buttons — INSIDE the question card at the bottom.
                This gives them a consistent position on both desktop and
                mobile, with bottom padding for breathing room. The card
                uses flex-col so these stick to the bottom of the card. */}
            <div
              className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 pb-5 pt-4 dark:border-slate-800 sm:px-6"
              style={{
                paddingBottom:
                  "max(env(safe-area-inset-bottom, 0px), 20px)",
              }}
            >
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={currentIdx === 0}
                className="h-11 gap-1.5 sm:h-10"
                aria-label="Previous question"
              >
                <ArrowLeft className="size-4 sm:size-4" /> Previous
              </Button>
              <span className="shrink-0 text-center text-xs font-medium text-muted-foreground">
                <span className="hidden sm:inline">
                  {answeredCount} of {questions.length} answered
                </span>
                <span className="sm:hidden font-semibold text-foreground tabular-nums">
                  {currentIdx + 1}/{questions.length}
                </span>
              </span>
              {currentIdx === questions.length - 1 ? (
                <Button
                  onClick={() => setShowSubmitDialog(true)}
                  className="h-11 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 sm:h-10"
                  aria-label="Submit quiz"
                >
                  <Send className="size-4" /> Submit
                </Button>
              ) : (
                <Button
                  onClick={goNext}
                  className="h-11 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 sm:h-10"
                  aria-label="Next question"
                >
                  Next <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </Card>
        </section>

        <ExamSidebar total={questions.length} current={currentIdx} answered={answeredArr} flagged={flaggedArr} onJump={jumpTo} metrics={combinedMetrics} config={security} securityOpen={securityOpen} onToggleSecurity={() => setSecurityOpen((v) => !v)} proctor={security.aiProctor && !cameraGateOpen ? { isReady: aiProctor.isReady, error: aiProctor.error, facePresent: aiProctor.facePresent, faceCount: aiProctor.faceCount } : null} videoRef={aiProctor.videoRef} />
      </main>

      {/* Mobile single toggle button — opens a combined panel with both
          the Question Navigator and Security Monitor as tabs.
          A single toggle (vs two FABs) is easier to tap on mobile and avoids
          accidental clicks. The panel uses a bottom Sheet that the user
          explicitly dismisses — it never auto-closes, so it doesn't disturb
          the exam flow.
          Positioned at the bottom-right with safe-area inset. */}
      <Button
        onClick={() => setMobilePanelOpen(true)}
        className="fixed z-30 gap-2 rounded-full bg-slate-800 px-4 text-white shadow-lg hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 lg:hidden"
        style={{
          bottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
          right: "max(env(safe-area-inset-right, 16px), 16px)",
        }}
        size="sm"
        aria-label="Open question navigator and security monitor"
      >
        <ListChecks className="size-4" />
        <span className="hidden sm:inline">Navigator</span>
        <Badge
          variant="secondary"
          className="bg-emerald-500 text-white"
        >
          {currentIdx + 1}/{questions.length}
        </Badge>
      </Button>

      {/* Mobile combined panel — Question Navigator (60% height) + Security
          Monitor (40% height), stacked vertically. Each section scrolls
          independently so the user can see both at once. The panel stays
          open until explicitly dismissed.

          IMPORTANT: This is an INLINE overlay (not a Radix Sheet/Portal)
          because Portal teleports content to document.body, which is
          OUTSIDE the fullscreen element and therefore invisible during
          fullscreen. By using a fixed-position div that's a child of
          containerRef, it remains visible in fullscreen mode. */}
      <AnimatePresence>
        {mobilePanelOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[150] flex h-[80vh] flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0px)",
            }}
          >
            {/* Drag handle + title + close */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 pb-2 pt-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="mx-auto h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-emerald-600" /> Quiz Tools
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setMobilePanelOpen(false)}
                aria-label="Close panel"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Stacked layout: Navigator 60% + Security 40%, each with
                independent scroll. Uses flex-col with explicit flex-basis
                so the split is fixed regardless of content length. */}
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
              {/* Question Navigator — 60% height with internal scroll */}
              <div className="flex min-h-0 flex-[6] flex-col rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <ListChecks className="size-4 text-emerald-600" /> Navigator
                  </div>
                  <Badge variant="secondary">
                    {answeredCount}/{questions.length}
                  </Badge>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <QuestionNavigator
                    total={questions.length}
                    current={currentIdx}
                    answered={answeredArr}
                    flagged={flaggedArr}
                    onJump={jumpTo}
                  />
                </div>
              </div>

              {/* Security Monitor — 40% height with internal scroll */}
              <div className="flex min-h-0 flex-[4] flex-col rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 border-b border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-800">
                  <ShieldCheck className="size-4 text-emerald-600" /> Security
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <SecuritySidebarBodyInline
                    metrics={combinedMetrics}
                    config={security}
                    proctor={
                      security.aiProctor && !cameraGateOpen
                        ? {
                            isReady: aiProctor.isReady,
                            error: aiProctor.error,
                            facePresent: aiProctor.facePresent,
                            faceCount: aiProctor.faceCount,
                          }
                        : null
                    }
                    videoRef={aiProctor.videoRef}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile panel — tap to close. Also inline (no Portal)
          so it works in fullscreen mode. */}
      <AnimatePresence>
        {mobilePanelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[140] bg-black/40"
            onClick={() => setMobilePanelOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Fullscreen prompt overlay */}
      {awaitingFullscreen && status === "active" && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm"
          style={{
            paddingTop: "max(env(safe-area-inset-top, 0px), 16px)",
            paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
            paddingLeft: "max(env(safe-area-inset-left, 0px), 16px)",
            paddingRight: "max(env(safe-area-inset-right, 0px), 16px)",
          }}
        >
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
                {fullscreenBlocked ? (
                  <Button
                    onClick={continueWithoutFullscreen}
                    variant="outline"
                    className="w-full"
                  >
                    Continue without fullscreen
                  </Button>
                ) : (
                  <button
                    onClick={continueWithoutFullscreen}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Having trouble? Continue without fullscreen →
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Proctor camera permission gate — shown when security.aiProctor is
          on and the camera hasn't been authorized yet. The gate is mandatory:
          the participant must grant camera access to proceed, OR choose to go
          back to the dashboard. There is no "continue without proctor" option
          because AI security is a strict requirement when enabled. */}
      {cameraGateOpen && status === "active" && (
        <CameraPermissionGate
          onGranted={handleCameraGranted}
          onError={handleCameraError}
          onBack={handleReturnToDashboard}
        />
      )}

      {/* Submit confirmation dialog — rendered INSIDE the fullscreen container
          (as a child of containerRef) using fixed positioning. This works in
          fullscreen mode because the fullscreen element becomes the rendering
          root — fixed elements within it are visible. We deliberately do NOT
          use Radix AlertDialog/Portal here because Portal would teleport the
          dialog to document.body, which is OUTSIDE the fullscreen element
          and therefore invisible. We also deliberately do NOT exit fullscreen
          to show this dialog, because `autoSubmitOnExit` would auto-submit
          the quiz immediately. */}
      <AnimatePresence>
        {showSubmitDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setShowSubmitDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="z-[201] w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="submit-dialog-title"
              aria-describedby="submit-dialog-desc"
            >
              <div className="flex flex-col gap-2 text-center sm:text-left">
                <h2 id="submit-dialog-title" className="text-lg font-semibold leading-none">
                  Submit your quiz?
                </h2>
                <p id="submit-dialog-desc" className="text-sm text-muted-foreground">
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
                </p>
              </div>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitDialog(false)}
                  disabled={status === "submitting"}
                >
                  Keep working
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowSubmitDialog(false)
                    if (doSubmitRef.current && attemptId && !submittedRef.current) {
                      void doSubmitRef.current(false)
                    } else if (!attemptId) {
                      toast.error("Quiz is still loading. Please try again in a moment.")
                    }
                  }}
                  disabled={status === "submitting" || !attemptId}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Submitting…
                    </>
                  ) : (
                    <>
                      <Send className="size-4" /> Submit now
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Camera permission gate — rendered as a sibling overlay when AI proctor
// requires camera authorization. Tries getUserMedia directly; on success
// notifies the parent via onGranted (the parent then unmounts the gate, and
// the useAiProctor hook re-opens the stream). The participant MUST grant
// camera access to proceed — the only alternative is to go back.
// ---------------------------------------------------------------------------
function CameraPermissionGate({
  onGranted,
  onError,
  onBack,
}: {
  onGranted: () => void
  onError: () => void
  onBack: () => void
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
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm"
      style={{
        paddingTop: "max(env(safe-area-inset-top, 0px), 16px)",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
        paddingLeft: "max(env(safe-area-inset-left, 0px), 16px)",
        paddingRight: "max(env(safe-area-inset-right, 0px), 16px)",
      }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
            <Camera className="size-8 text-emerald-600" />
          </div>
          <CardTitle className="text-xl">Camera access required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            This quiz uses <span className="font-semibold text-foreground">AI proctoring</span>.
            Your camera will be used to verify your identity and detect potential
            academic dishonesty. No video is recorded or transmitted — all
            analysis runs locally in your browser.
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
          <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <strong>Required:</strong> You must grant camera access to take this
            quiz. If you cancel, you will be returned to the dashboard.
          </div>
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
              onClick={onBack}
              variant="outline"
              className="w-full gap-1.5"
            >
              <ArrowLeft className="size-4" /> Back to Dashboard
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
  proctor: { isReady: boolean; error: string | null; facePresent?: boolean; faceCount?: number } | null
  videoRef?: React.RefObject<HTMLVideoElement | null>
}) {
  const faceStatus: "ok" | "warn" | "off" = proctor
    ? proctor.error
      ? "off"
      : proctor.facePresent
        ? "ok"
        : "warn"
    : "off"
  return (
    <div className="space-y-3">
      {config.aiProctor && proctor && proctor.isReady && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700">
          <div className="relative aspect-video w-full bg-black">
            <video
              ref={videoRef}
              className="size-full object-cover"
              muted
              playsInline
              autoPlay
              preload="auto"
              controls={false}
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
                {proctor.error ? "OFFLINE" : "LIVE"}
              </Badge>
            </div>
          </div>
        </div>
      )}
      {config.aiProctor && proctor && !proctor.isReady && !proctor.error && (
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800" style={{ minHeight: 120 }}>
          <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      )}
      {config.aiProctor && proctor && proctor.error && (
        <div className="flex items-center justify-center rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20" style={{ minHeight: 120 }}>
          <span className="text-xs text-red-600 dark:text-red-400">Camera: {proctor.error}</span>
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
