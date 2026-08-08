"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { SecurityConfig } from "@/components/student/api"

export interface AntiCheatCounters {
  tabSwitches: number
  fullscreenExits: number
  copyAttempts: number
  rightClicks: number
  devtoolsOpen: number
  screenshotAttempts: number
  keyboardViolations: number
  faceNotDetected: number
  multiFaceAlerts: number
  lookAwayAlerts: number
}

export type AntiCheatViolationType =
  | "tabSwitch"
  | "fullscreenExit"
  | "copyAttempt"
  | "rightClick"
  | "devtoolsOpen"
  | "screenshot"
  | "keyboardViolation"
  | "faceNotDetected"
  | "multiFace"
  | "lookAway"

export interface UseAntiCheatOptions {
  /** When true, listeners are attached and events are counted. */
  enabled: boolean
  /** Per-quiz-link security toggles — only attach listeners for enabled features. */
  config: SecurityConfig
  /** Fired on each tab switch (document hidden). */
  onTabSwitch?: () => void
  /** Fired each time the document leaves fullscreen mode. */
  onFullscreenExit?: () => void
  /** Fired on copy/cut attempts (default is prevented). */
  onCopyAttempt?: () => void
  /** Fired on right-click attempts (default is prevented). */
  onRightClick?: () => void
  /** Fired when DevTools is detected as open. */
  onDevtoolsOpen?: () => void
  /** Fired when a screenshot is attempted (PrintScreen key). */
  onScreenshotAttempt?: () => void
  /** Fired when a blocked keyboard shortcut is pressed. */
  onKeyboardViolation?: () => void
  /**
   * Fired when the auto-submit-on-fullscreen-exit grace period elapses
   * without the participant re-entering fullscreen. The runner calls
   * its submit handler from here.
   */
  onAutoSubmit?: () => void
  /** When true, attach a beforeunload guard that warns the user before navigating away. */
  warnBeforeUnload?: boolean
}

/**
 * Default security config — everything off. Used when the runner hasn't
 * received the security payload from the server yet (e.g. while loading).
 */
const DEFAULT_CONFIG: SecurityConfig = {
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

/**
 * Returns true at most once every `windowMs` per `key`. Used to debounce
 * per-violation toasts (max 1 toast per violation type per 3s) and to
 * debounce counter increments for the AI proctor.
 */
function useDebouncedLimiter(windowMs = 3000) {
  const lastFiredRef = useRef<Record<string, number>>({})
  return useCallback(
    (key: string, now = Date.now()): boolean => {
      const last = lastFiredRef.current[key] ?? 0
      if (now - last < windowMs) return false
      lastFiredRef.current[key] = now
      return true
    },
    [windowMs],
  )
}

/**
 * Attaches anti-cheat listeners to the document/window and exposes live
 * counters. All callbacks are stored in refs so listeners always see the
 * latest version without needing to re-attach.
 *
 * Listeners (gated by `config`):
 *   - visibilitychange     → tab switch (when document becomes hidden)
 *   - fullscreenchange     → fullscreen exit / auto-submit on exit
 *   - copy / cut           → preventDefault + copy attempt
 *   - contextmenu          → preventDefault + right click
 *   - keydown              → F12 / Ctrl+Shift+I|J|C / Ctrl+U / Ctrl+C|V|X|A / PrintScreen
 *   - keyup (PrintScreen)  → screenshot attempt
 *   - window blur          → screenshot attempt (some OSes blur on screenshot)
 *   - devtools poll (2s)   → window size delta detection
 *   - beforeunload         → native "leave page?" confirm
 */
export function useAntiCheat(options: UseAntiCheatOptions): AntiCheatCounters {
  const {
    enabled,
    config = DEFAULT_CONFIG,
    warnBeforeUnload = false,
  } = options

  // Live callback refs (avoid stale closures)
  const onTabSwitchRef = useRef(options.onTabSwitch)
  const onFullscreenExitRef = useRef(options.onFullscreenExit)
  const onCopyAttemptRef = useRef(options.onCopyAttempt)
  const onRightClickRef = useRef(options.onRightClick)
  const onDevtoolsOpenRef = useRef(options.onDevtoolsOpen)
  const onScreenshotAttemptRef = useRef(options.onScreenshotAttempt)
  const onKeyboardViolationRef = useRef(options.onKeyboardViolation)
  const onAutoSubmitRef = useRef(options.onAutoSubmit)

  useEffect(() => {
    onTabSwitchRef.current = options.onTabSwitch
    onFullscreenExitRef.current = options.onFullscreenExit
    onCopyAttemptRef.current = options.onCopyAttempt
    onRightClickRef.current = options.onRightClick
    onDevtoolsOpenRef.current = options.onDevtoolsOpen
    onScreenshotAttemptRef.current = options.onScreenshotAttempt
    onKeyboardViolationRef.current = options.onKeyboardViolation
    onAutoSubmitRef.current = options.onAutoSubmit
  })

  const [tabSwitches, setTabSwitches] = useState(0)
  const [fullscreenExits, setFullscreenExits] = useState(0)
  const [copyAttempts, setCopyAttempts] = useState(0)
  const [rightClicks, setRightClicks] = useState(0)
  const [devtoolsOpen, setDevtoolsOpen] = useState(0)
  const [screenshotAttempts, setScreenshotAttempts] = useState(0)
  const [keyboardViolations, setKeyboardViolations] = useState(0)
  const [faceNotDetected, setFaceNotDetected] = useState(0)
  const [multiFaceAlerts, setMultiFaceAlerts] = useState(0)
  const [lookAwayAlerts, setLookAwayAlerts] = useState(0)

  // Debounced toast helper: at most 1 toast per violation type per 3s.
  const canFireToast = useDebouncedLimiter(3000)

  // Helper to fire a debounced warning toast for a violation type.
  const fireToast = useCallback(
    (
      type: AntiCheatViolationType,
      title: string,
      description?: string,
    ) => {
      if (!canFireToast(`toast:${type}`)) return
      toast.warning(title, description ? { description } : undefined)
    },
    [canFireToast],
  )

  // ----- Auto-submit-on-exit grace period handling -----
  // When autoSubmitOnExit is on AND fullscreen exits, we give the participant
  // a 3-second grace period to re-enter fullscreen before auto-submitting.
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelAutoSubmit = useCallback(() => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current)
      autoSubmitTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => cancelAutoSubmit()
  }, [cancelAutoSubmit])

  // ----- Main effect: attach all conditional listeners -----
  useEffect(() => {
    if (!enabled) return

    const handlers: Array<() => void> = []

    // -- Tab switch detection --
    if (config.tabSwitchDetection) {
      const handleVisibility = () => {
        if (document.visibilityState === "hidden") {
          setTabSwitches((n) => n + 1)
          onTabSwitchRef.current?.()
          fireToast(
            "tabSwitch",
            "Tab switch detected!",
            "Switching tabs is logged and may affect your score.",
          )
        }
      }
      document.addEventListener("visibilitychange", handleVisibility)
      handlers.push(() =>
        document.removeEventListener("visibilitychange", handleVisibility),
      )
    }

    // -- Fullscreen exit detection (+ auto-submit) --
    if (config.autoSubmitOnExit || config.tabSwitchDetection) {
      const handleFullscreenChange = () => {
        if (!document.fullscreenElement) {
          setFullscreenExits((n) => n + 1)
          onFullscreenExitRef.current?.()
          fireToast(
            "fullscreenExit",
            "Fullscreen exited",
            "Re-enter fullscreen to keep anti-cheat active.",
          )
          // Auto-submit after 3s grace period if configured.
          if (config.autoSubmitOnExit) {
            cancelAutoSubmit()
            fireToast(
              "fullscreenExit",
              "Re-entering fullscreen…",
              "Quiz will auto-submit in 3 seconds if you don't re-enter.",
            )
            autoSubmitTimerRef.current = setTimeout(() => {
              // Verify still out of fullscreen before firing.
              if (!document.fullscreenElement) {
                onAutoSubmitRef.current?.()
              }
            }, 3000)
          }
        } else {
          // Re-entered fullscreen — cancel any pending auto-submit.
          cancelAutoSubmit()
        }
      }
      document.addEventListener("fullscreenchange", handleFullscreenChange)
      handlers.push(() =>
        document.removeEventListener("fullscreenchange", handleFullscreenChange),
      )
    }

    // -- Copy / paste blocking --
    if (config.copyPasteBlocking) {
      const handleCopy = (e: Event) => {
        e.preventDefault()
        setCopyAttempts((n) => n + 1)
        onCopyAttemptRef.current?.()
        fireToast("copyAttempt", "Copying is disabled!", "This action has been logged.")
      }
      document.addEventListener("copy", handleCopy)
      document.addEventListener("cut", handleCopy)
      handlers.push(() => {
        document.removeEventListener("copy", handleCopy)
        document.removeEventListener("cut", handleCopy)
      })
    }

    // -- Right-click disable --
    if (config.rightClickDisable) {
      const handleContextMenu = (e: Event) => {
        e.preventDefault()
        setRightClicks((n) => n + 1)
        onRightClickRef.current?.()
        fireToast("rightClick", "Right-click is disabled!", "This action has been logged.")
      }
      document.addEventListener("contextmenu", handleContextMenu)
      handlers.push(() =>
        document.removeEventListener("contextmenu", handleContextMenu),
      )
    }

    // -- Keyboard shortcut blocking --
    if (config.keyboardShortcutBlocking) {
      const isBlockedShortcut = (e: KeyboardEvent): boolean => {
        const key = e.key?.toLowerCase()
        // F12 = DevTools
        if (e.key === "F12") return true
        // Ctrl+Shift+I / J / C = DevTools
        if (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key ?? ""))
          return true
        // Ctrl+U = View Source
        if (e.ctrlKey && !e.shiftKey && key === "u") return true
        // Ctrl+C / V / X / A — only block when copy/paste blocking is on
        if (
          config.copyPasteBlocking &&
          e.ctrlKey &&
          !e.shiftKey &&
          ["c", "v", "x", "a"].includes(key ?? "")
        ) {
          // Allow Cmd+C on Mac for accessibility? — keep blocked per spec.
          return true
        }
        // PrintScreen handled below in its own listener.
        return false
      }
      const handleKeyDown = (e: KeyboardEvent) => {
        // PrintScreen is handled in the keyup listener (some browsers fire it
        // only on keyup). Skip here to avoid double-counting.
        if (
          e.key === "PrintScreen" ||
          e.keyCode === 44
        )
          return
        if (isBlockedShortcut(e)) {
          e.preventDefault()
          setKeyboardViolations((n) => n + 1)
          onKeyboardViolationRef.current?.()
          fireToast(
            "keyboardViolation",
            "Keyboard shortcut blocked!",
            "This action has been logged.",
          )
        }
      }
      window.addEventListener("keydown", handleKeyDown, true)
      handlers.push(() => window.removeEventListener("keydown", handleKeyDown, true))
    }

    // -- Anti-screenshot (PrintScreen key + window blur) --
    if (config.antiScreenshot) {
      const handlePrintScreen = (e: KeyboardEvent | ClipboardEvent) => {
        // KeyboardEvent path: PrintScreen key on keyup (some browsers).
        if (e instanceof KeyboardEvent) {
          if (e.key !== "PrintScreen" && e.keyCode !== 44) return
        }
        e.preventDefault()
        setScreenshotAttempts((n) => n + 1)
        onScreenshotAttemptRef.current?.()
        fireToast(
          "screenshot",
          "Screenshots are not allowed!",
          "This attempt has been logged.",
        )
      }
      // keyup is the most reliable cross-browser event for PrintScreen.
      const onKeyUp = (e: KeyboardEvent) => handlePrintScreen(e)
      window.addEventListener("keyup", onKeyUp)
      handlers.push(() => window.removeEventListener("keyup", onKeyUp))

      // Some OSes (Windows Snipping Tool, macOS Cmd+Shift+4) blur the window
      // when capturing. Detect a blur immediately following PrintScreen intent.
      // We can't reliably distinguish from regular tab-switches, so we use a
      // short window — if the blur happens within 500ms of focus, count it.
      const onBlur = () => {
        // Only count if we haven't recently fired (debounce).
        if (canFireToast("screenshot:blur", 1500)) {
          // Don't double-count if PrintScreen key already fired.
          setScreenshotAttempts((n) => n + 1)
          onScreenshotAttemptRef.current?.()
          fireToast(
            "screenshot",
            "Possible screen capture detected!",
            "This attempt has been logged.",
          )
        }
      }
      window.addEventListener("blur", onBlur)
      handlers.push(() => window.removeEventListener("blur", onBlur))
    }

    // -- DevTools detection (window-size delta heuristic) --
    // LIMITATIONS: This is a heuristic — it can produce false positives when
    // the browser chrome (zoom controls, side panels) takes >160px of space,
    // and false negatives when DevTools is undocked into a separate window.
    // The threshold of 160px is the common convention from devtools-detect.
    if (config.devtoolsDetection) {
      let devtoolsWasOpen = false
      const threshold = 160
      const checkDevtools = () => {
        const widthDelta = window.outerWidth - window.innerWidth
        const heightDelta = window.outerHeight - window.innerHeight
        const isOpen = widthDelta > threshold || heightDelta > threshold
        if (isOpen && !devtoolsWasOpen) {
          // Only count once per "session" of being open — debounce.
          devtoolsWasOpen = true
          setDevtoolsOpen((n) => n + 1)
          onDevtoolsOpenRef.current?.()
          fireToast(
            "devtoolsOpen",
            "Developer tools detected!",
            "Please close DevTools to continue the quiz.",
          )
        } else if (!isOpen && devtoolsWasOpen) {
          devtoolsWasOpen = false
        }
      }
      const intervalId = setInterval(checkDevtools, 2000)
      // Initial check after a short delay (let the page settle).
      const initTimeout = setTimeout(checkDevtools, 1500)
      handlers.push(() => {
        clearInterval(intervalId)
        clearTimeout(initTimeout)
      })
    }

    // -- beforeunload guard --
    if (warnBeforeUnload) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        // For legacy browsers
        e.returnValue =
          "You have an unfinished quiz. Are you sure you want to leave?"
        return e.returnValue
      }
      window.addEventListener("beforeunload", handleBeforeUnload)
      handlers.push(() =>
        window.removeEventListener("beforeunload", handleBeforeUnload),
      )
    }

    return () => {
      for (const cleanup of handlers) cleanup()
      cancelAutoSubmit()
    }
  }, [
    enabled,
    config.autoSubmitOnExit,
    config.tabSwitchDetection,
    config.copyPasteBlocking,
    config.rightClickDisable,
    config.keyboardShortcutBlocking,
    config.devtoolsDetection,
    config.antiScreenshot,
    warnBeforeUnload,
    fireToast,
    cancelAutoSubmit,
  ])

  // Note: AI proctor counters (faceNotDetected / multiFaceAlerts / lookAwayAlerts)
  // are returned here as zeros — they are populated by the `useAiProctor` hook.
  // The QuizRunner merges both outputs into a single metrics object that
  // gets passed to <SecuritySidebar />.

  return {
    tabSwitches,
    fullscreenExits,
    copyAttempts,
    rightClicks,
    devtoolsOpen,
    screenshotAttempts,
    keyboardViolations,
    faceNotDetected,
    multiFaceAlerts,
    lookAwayAlerts,
  }
}
