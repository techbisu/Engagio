"use client"

import { useEffect, useRef, useState } from "react"

export interface AntiCheatCounters {
  tabSwitches: number
  fullscreenExits: number
  copyAttempts: number
  rightClicks: number
}

export interface UseAntiCheatOptions {
  /** When true, listeners are attached and events are counted. */
  enabled: boolean
  /** Fired on each tab switch (document hidden). */
  onTabSwitch?: () => void
  /** Fired each time the document leaves fullscreen mode. */
  onFullscreenExit?: () => void
  /** Fired on copy/cut attempts (default is prevented). */
  onCopyAttempt?: () => void
  /** Fired on right-click attempts (default is prevented). */
  onRightClick?: () => void
  /** When true, attach a beforeunload guard that warns the user before navigating away. */
  warnBeforeUnload?: boolean
}

/**
 * Attaches anti-cheat listeners to the document/window and exposes live
 * counters. All callbacks are stored in refs so listeners always see the
 * latest version without needing to re-attach.
 *
 * Listeners:
 *   - visibilitychange → tab switch (when document becomes hidden)
 *   - fullscreenchange → fullscreen exit (when document.fullscreenElement becomes null)
 *   - copy / cut       → preventDefault + copy attempt
 *   - contextmenu      → preventDefault + right click
 *   - beforeunload     → native "leave page?" confirm (when warnBeforeUnload is true)
 */
export function useAntiCheat(options: UseAntiCheatOptions): AntiCheatCounters {
  const {
    enabled,
    warnBeforeUnload = false,
  } = options

  // Live callback refs (avoid stale closures)
  const onTabSwitchRef = useRef(options.onTabSwitch)
  const onFullscreenExitRef = useRef(options.onFullscreenExit)
  const onCopyAttemptRef = useRef(options.onCopyAttempt)
  const onRightClickRef = useRef(options.onRightClick)

  useEffect(() => {
    onTabSwitchRef.current = options.onTabSwitch
    onFullscreenExitRef.current = options.onFullscreenExit
    onCopyAttemptRef.current = options.onCopyAttempt
    onRightClickRef.current = options.onRightClick
  })

  const [tabSwitches, setTabSwitches] = useState(0)
  const [fullscreenExits, setFullscreenExits] = useState(0)
  const [copyAttempts, setCopyAttempts] = useState(0)
  const [rightClicks, setRightClicks] = useState(0)

  useEffect(() => {
    if (!enabled) return

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        setTabSwitches((n) => n + 1)
        onTabSwitchRef.current?.()
      }
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFullscreenExits((n) => n + 1)
        onFullscreenExitRef.current?.()
      }
    }

    const handleCopy = (e: Event) => {
      e.preventDefault()
      setCopyAttempts((n) => n + 1)
      onCopyAttemptRef.current?.()
    }

    const handleContextMenu = (e: Event) => {
      e.preventDefault()
      setRightClicks((n) => n + 1)
      onRightClickRef.current?.()
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!warnBeforeUnload) return
      e.preventDefault()
      // For legacy browsers
      e.returnValue =
        "You have an unfinished quiz. Are you sure you want to leave?"
      return e.returnValue
    }

    document.addEventListener("visibilitychange", handleVisibility)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("copy", handleCopy)
    document.addEventListener("cut", handleCopy)
    document.addEventListener("contextmenu", handleContextMenu)
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("copy", handleCopy)
      document.removeEventListener("cut", handleCopy)
      document.removeEventListener("contextmenu", handleContextMenu)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [enabled, warnBeforeUnload])

  return { tabSwitches, fullscreenExits, copyAttempts, rightClicks }
}
