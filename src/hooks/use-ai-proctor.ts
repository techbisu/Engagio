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
  /** Total skin-tone pixel count in the sampled region. */
  count: number
  /** Centroid of skin-tone pixels (x, y) in sampled coords. */
  cx: number
  cy: number
  /** Per-quadrant skin-tone counts (4 entries: TL, TR, BL, BR). */
  quadrants: [number, number, number, number]
}

/**
 * Lightweight canvas-based AI proctor. Uses a skin-tone pixel heuristic to
 * estimate face presence — NO TensorFlow / no external ML libraries.
 *
 * Algorithm:
 *   1. Capture a frame from the video stream to a hidden canvas every ~2s.
 *   2. Sample pixels in the center 100x100 region (downscaled from 200x200).
 *   3. Count pixels matching the skin-tone range:
 *        R > 95, G > 40, B > 20, R-G > 15, R-B > 15, max-min > 15
 *   4. If skin-tone count < 500 in the center region → "no face detected".
 *   5. For multi-face: count skin-tone in each of 4 quadrants of the frame.
 *      If >1 quadrant has significant skin-tone (>300 pixels), alert.
 *   6. For look-away: track skin-tone centroid between frames; if it moves
 *      > 30 sample-pixels between consecutive frames, count as look-away.
 *
 * Counters are debounced — at most one increment per violation type per 3s.
 * Cleanup: stops all video tracks + clears intervals on unmount.
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

  // Live callback ref so the analysis loop sees the latest version.
  const onViolationRef = useRef(onViolation)
  useEffect(() => {
    onViolationRef.current = onViolation
  })

  // Last-frame centroid for look-away tracking.
  const lastCentroidRef = useRef<{ x: number; y: number } | null>(null)
  // Debounce timestamps per violation type.
  const lastFiredRef = useRef<Record<string, number>>({})
  const canFire = useCallback((key: string, windowMs = 3000, now = Date.now()) => {
    const last = lastFiredRef.current[key] ?? 0
    if (now - last < windowMs) return false
    lastFiredRef.current[key] = now
    return true
  }, [])

  // Toast debounce — at most 1 toast per violation type per 3s.
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

  // Skin-tone analysis on the captured canvas.
  const analyzeFrame = useCallback((): SkinAnalysis | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return null

    const VW = video.videoWidth || 320
    const VH = video.videoHeight || 240
    if (VW === 0 || VH === 0) return null

    // Downscale to a small canvas for performance — 160x120 is enough.
    const CW = 160
    const CH = 120
    canvas.width = CW
    canvas.height = CH
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null

    ctx.drawImage(video, 0, 0, VW, VH, 0, 0, CW, CH)
    const imageData = ctx.getImageData(0, 0, CW, CH)
    const data = imageData.data

    // Center region (40x40 around the middle) for face-detection sampling.
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
        // Skin-tone heuristic (Kovac et al. — standard RGB rule).
        const isSkin =
          r > 95 &&
          g > 40 &&
          b > 20 &&
          r - g > 15 &&
          r - b > 15 &&
          max - min > 15
        if (!isSkin) continue

        // Quadrant tally for multi-face detection.
        const qIdx = (x < halfW ? 0 : 1) + (y < halfH ? 0 : 2)
        quadrants[qIdx]++

        // Center-region tally + centroid for face/look-away detection.
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

  // Main analysis tick — runs every 2s once isReady.
  const tick = useCallback(() => {
    const result = analyzeFrame()
    if (!result) return

    // Face detection — based on center-region skin-tone pixel count.
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

    // Multi-face detection — count quadrants with significant skin-tone.
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

    // Look-away detection — track centroid movement between frames.
    if (lookAway && result.cx >= 0 && result.cy >= 0) {
      const last = lastCentroidRef.current
      lastCentroidRef.current = { x: result.cx, y: result.cy }
      if (last) {
        const dx = result.cx - last.x
        const dy = result.cy - last.y
        const delta = Math.sqrt(dx * dx + dy * dy)
        // 30 sample-pixels in a 40x40 region ≈ noticeable head turn.
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

  // Camera access + interval setup.
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
          video: { width: 320, height: 240, facingMode: "user" },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // Wait for the first frame to be ready before sampling.
          await videoRef.current.play().catch(() => {})
        }
        // Create the offscreen analysis canvas.
        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas")
        }
        setIsReady(true)
        setError(null)
        // Start the analysis loop — 2s cadence per spec.
        intervalRef.current = setInterval(tick, 2000)
        // Run an initial tick after the stream warms up.
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
  }, [enabled, tick])

  return {
    faceNotDetected,
    multiFaceAlerts,
    lookAwayAlerts,
    isReady,
    error,
    videoRef,
  }
}
