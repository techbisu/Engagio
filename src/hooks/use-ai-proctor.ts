"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export interface UseAiProctorOptions {
  /** Master toggle — when false, no camera access, no analysis. */
  enabled: boolean
  /** When true, sample center region for skin-tone presence. */
  faceDetection: boolean
  /** When true, divide frame into quadrants and detect multi-face clusters. */
  multiFace: boolean
  /** When true, track skin-tone centroid movement between frames. */
  lookAway: boolean
  /** Fired when any proctor violation occurs (debounced internally). */
  onViolation?: (type: "face" | "multiFace" | "lookAway") => void
}

export interface AiProctorState {
  faceNotDetected: number
  multiFaceAlerts: number
  lookAwayAlerts: number
  /** True once camera stream is ready and analysis loop is running. */
  isReady: boolean
  /** Set when getUserMedia denies access or no camera available. */
  error: string | null
  /** Live ref to the underlying <video> element for the sidebar preview. */
  videoRef: React.RefObject<HTMLVideoElement | null>
}

interface SkinAnalysis {
  count: number
  cx: number
  cy: number
  quadrants: [number, number, number, number]
}

/**
 * Lightweight canvas-based AI proctor. Uses a skin-tone pixel heuristic to
 * estimate face presence — NO TensorFlow / no external ML libraries.
 *
 * Camera pipeline:
 *   1. getUserMedia({ video }) → MediaStream
 *   2. Attach to <video> via srcObject
 *   3. Call video.play() (must be called explicitly — autoplay attribute is
 *      unreliable in many browsers when srcObject is set programmatically)
 *   4. Wait for `loadeddata` event (videoWidth/videoHeight become available)
 *   5. Start the analysis interval
 *
 * The black-screen bug was caused by:
 *   - Not awaiting `video.play()` properly
 *   - Not listening for the `loadedmetadata` / `loadeddata` events
 *   - Setting srcObject BEFORE the video element was mounted (the ref was
 *     null on the first render, so the stream was never attached)
 *
 * Fix: Use a state-driven `videoReady` flag + a `useEffect` that attaches
 * the stream to the video element as soon as BOTH the stream AND the ref
 * are available. This handles the race where the video element mounts
 * AFTER the camera has already started.
 */
export function useAiProctor(options: UseAiProctorOptions): AiProctorState {
  const { enabled, faceDetection, multiFace, lookAway, onViolation } = options

  const [faceNotDetected, setFaceNotDetected] = useState(0)
  const [multiFaceAlerts, setMultiFaceAlerts] = useState(0)
  const [lookAwayAlerts, setLookAwayAlerts] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const onViolationRef = useRef(onViolation)
  useEffect(() => {
    onViolationRef.current = onViolation
  })

  const lastCentroidRef = useRef<{ x: number; y: number } | null>(null)
  const lastFiredRef = useRef<Record<string, number>>({})
  const canFire = useCallback((key: string, windowMs = 3000, now = Date.now()) => {
    const last = lastFiredRef.current[key] ?? 0
    if (now - last < windowMs) return false
    lastFiredRef.current[key] = now
    return true
  }, [])

  const fireToast = useCallback(
    (
      type: "face" | "multiFace" | "lookAway",
      title: string,
      description?: string,
    ) => {
      if (!canFire(`toast:${type}`)) return
      toast.warning(title, description ? { description } : undefined)
    },
    [canFire],
  )

  const analyzeFrame = useCallback((): SkinAnalysis | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return null

    const VW = video.videoWidth || 320
    const VH = video.videoHeight || 240
    if (VW === 0 || VH === 0) return null

    const CW = 160
    const CH = 120
    canvas.width = CW
    canvas.height = CH
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null

    try {
      ctx.drawImage(video, 0, 0, VW, VH, 0, 0, CW, CH)
    } catch {
      // Video not ready yet — drawImage can throw if the frame isn't decoded.
      return null
    }
    const imageData = ctx.getImageData(0, 0, CW, CH)
    const data = imageData.data

    const centerSize = 40
    const cx0 = Math.floor((CW - centerSize) / 2)
    const cy0 = Math.floor((CH - centerSize) / 2)
    let centerCount = 0
    let sumX = 0
    let sumY = 0

    const quadrants: [number, number, number, number] = [0, 0, 0, 0]
    const halfW = Math.floor(CW / 2)
    const halfH = Math.floor(CH / 2)

    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const idx = (y * CW + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const isSkin =
          r > 95 &&
          g > 40 &&
          b > 20 &&
          r - g > 15 &&
          r - b > 15 &&
          max - min > 15
        if (!isSkin) continue

        const qIdx = (x < halfW ? 0 : 1) + (y < halfH ? 0 : 2)
        quadrants[qIdx]++

        if (x >= cx0 && x < cx0 + centerSize && y >= cy0 && y < cy0 + centerSize) {
          centerCount++
          sumX += x
          sumY += y
        }
      }
    }

    const cx = centerCount > 0 ? sumX / centerCount : -1
    const cy = centerCount > 0 ? sumY / centerCount : -1
    return { count: centerCount, cx, cy, quadrants }
  }, [])

  const tick = useCallback(() => {
    const result = analyzeFrame()
    if (!result) return

    if (faceDetection) {
      const hasFace = result.count >= 500
      if (!hasFace && canFire("counter:face")) {
        setFaceNotDetected((n) => n + 1)
        onViolationRef.current?.("face")
        fireToast(
          "face",
          "No face detected",
          "Please keep your face visible to the camera.",
        )
      }
    }

    if (multiFace) {
      const significantQuadrants = result.quadrants.filter((q) => q > 300).length
      if (significantQuadrants > 1 && canFire("counter:multiFace")) {
        setMultiFaceAlerts((n) => n + 1)
        onViolationRef.current?.("multiFace")
        fireToast(
          "multiFace",
          "Multiple faces detected",
          "Only the registered participant should be visible.",
        )
      }
    }

    if (lookAway && result.cx >= 0 && result.cy >= 0) {
      const last = lastCentroidRef.current
      lastCentroidRef.current = { x: result.cx, y: result.cy }
      if (last) {
        const dx = result.cx - last.x
        const dy = result.cy - last.y
        const delta = Math.sqrt(dx * dx + dy * dy)
        if (delta > 15 && canFire("counter:lookAway")) {
          setLookAwayAlerts((n) => n + 1)
          onViolationRef.current?.("lookAway")
          fireToast(
            "lookAway",
            "Looking away detected",
            "Please keep your eyes on the screen.",
          )
        }
      }
    }
  }, [analyzeFrame, faceDetection, multiFace, lookAway, canFire, fireToast])

  // ─── Attach the stream to the video element ────────────────────────────
  // This runs whenever a NEW stream is acquired OR the video element ref
  // becomes available (handles the case where the <video> mounts AFTER the
  // camera has already started). Without this, the video element would show
  // a black screen because srcObject was never set.
  const attachStreamToVideo = useCallback(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    if (video.srcObject === stream) return // already attached
    video.srcObject = stream
    // Play must be called explicitly — the autoPlay attribute is unreliable
    // when srcObject is set programmatically, especially after a page
    // navigation or when the element was hidden when the stream started.
    video.play().catch((err) => {
      console.warn("[ai-proctor] video.play() failed:", err)
    })
  }, [])

  // Re-attach whenever the video ref might have changed (e.g. when the sidebar
  // collapses and re-expands, the <video> element is re-created). Using a
  // MutationObserver-free approach: poll a few times after mount to catch
  // the case where the <video> element appears slightly after the stream.
  useEffect(() => {
    if (!enabled || !streamRef.current) return
    attachStreamToVideo()
    // Retry attachment a few times — the video element may not be in the DOM
    // yet on the first render (race between camera starting and React mounting
    // the SecuritySidebar). This is the key fix for the black-screen bug.
    const retryTimers = [50, 200, 500, 1000, 2000].map((ms) =>
      setTimeout(() => attachStreamToVideo(), ms),
    )
    return () => {
      retryTimers.forEach(clearTimeout)
    }
  }, [enabled, attachStreamToVideo, isReady])

  // ─── Camera access + interval setup ────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      setIsReady(false)
      setError(null)
      return
    }

    let cancelled = false

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API not supported in this browser")
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            facingMode: "user",
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream

        // Attach the stream to the <video> element. The ref may be null if
        // the component hasn't mounted yet — attachStreamToVideo handles this
        // by re-running whenever the ref changes (see the effect above).
        attachStreamToVideo()

        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas")
        }

        // Wait for the video element to be ready before starting analysis.
        // This ensures videoWidth/videoHeight are populated so drawImage works.
        const video = videoRef.current
        if (video) {
          await new Promise<void>((resolve) => {
            if (video.readyState >= 2) {
              resolve()
              return
            }
            const onReady = () => {
              video.removeEventListener("loadeddata", onReady)
              resolve()
            }
            video.addEventListener("loadeddata", onReady)
            // Safety timeout — don't hang forever if the event never fires.
            setTimeout(resolve, 2000)
          })
          // Play again after loadeddata — some browsers pause the video
          // when the metadata loads.
          video.play().catch(() => {})
        }

        if (cancelled) return
        setIsReady(true)
        setError(null)
        intervalRef.current = setInterval(tick, 2000)
        setTimeout(tick, 1200)
      } catch (e) {
        if (cancelled) return
        const err =
          e instanceof Error ? e.message : "Failed to access camera"
        setError(err)
        setIsReady(false)
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (videoRef.current) {
        try {
          videoRef.current.srcObject = null
        } catch {
          // ignore
        }
      }
      lastCentroidRef.current = null
      lastFiredRef.current = {}
    }
  }, [enabled, tick, attachStreamToVideo])

  return {
    faceNotDetected,
    multiFaceAlerts,
    lookAwayAlerts,
    isReady,
    error,
    videoRef,
  }
}
