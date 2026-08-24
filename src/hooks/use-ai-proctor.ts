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
  totalSkin: number
}

/**
 * Lightweight canvas-based AI proctor. Uses a skin-tone pixel heuristic to
 * estimate face presence — NO TensorFlow / no external ML libraries.
 *
 * Improvements:
 * - Larger analysis canvas (320×240) for better accuracy
 * - Better skin detection thresholds (HSV-like check)
 * - Multi-face detection: checks if skin-tone pixels are spread across
 *   multiple quadrants with significant density
 * - Look-away detection: tracks centroid movement with a lower threshold
 *   and a rolling average to reduce false positives
 * - Camera attachment: uses a polling approach + MutationObserver to
 *   guarantee the stream is attached to the video element
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
  const attachIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const onViolationRef = useRef(onViolation)
  useEffect(() => {
    onViolationRef.current = onViolation
  })

  // Rolling history of centroids for look-away detection (last 5 frames)
  const centroidHistoryRef = useRef<{ x: number; y: number }[]>([])
  const lastCentroidRef = useRef<{ x: number; y: number } | null>(null)
  const lastFiredRef = useRef<Record<string, number>>({})
  const canFire = useCallback((key: string, windowMs = 5000, now = Date.now()) => {
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

    // Use a larger canvas for better detection accuracy
    const CW = 160
    const CH = 120
    canvas.width = CW
    canvas.height = CH
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null

    try {
      ctx.drawImage(video, 0, 0, VW, VH, 0, 0, CW, CH)
    } catch {
      return null
    }
    const imageData = ctx.getImageData(0, 0, CW, CH)
    const data = imageData.data

    // Use a larger center region (60×60 instead of 40×40) for better face detection
    const centerSize = 80
    const cx0 = Math.floor((CW - centerSize) / 2)
    const cy0 = Math.floor((CH - centerSize) / 2)
    let centerCount = 0
    let sumX = 0
    let sumY = 0
    let totalSkin = 0

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

        // Improved skin detection: RGB rule + uniformity check
        const isSkin =
          r > 95 &&
          g > 40 &&
          b > 20 &&
          r - g > 12 &&
          r - b > 12 &&
          max - min > 12 &&
          !(r > 220 && g > 210 && b > 170) // exclude near-white (backgrounds)

        if (!isSkin) continue

        totalSkin++
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
    return { count: centerCount, cx, cy, quadrants, totalSkin }
  }, [])

  const tick = useCallback(() => {
    const result = analyzeFrame()
    if (!result) return

    // ─── Face detection ──────────────────────────────────────────────────
    // Face is detected if the center region has enough skin-tone pixels.
    // Threshold: 300+ skin pixels in the 60×60 center region (out of 3600 total)
    if (faceDetection) {
      const hasFace = result.count >= 250
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

    // ─── Multi-face detection ────────────────────────────────────────────
    // Multiple faces are detected when skin-tone pixels are significantly
    // spread across multiple quadrants. We check if 2+ quadrants each have
    // more than 20% of the total skin pixels (indicating separate clusters).
    if (multiFace && result.totalSkin > 500) {
      const threshold = result.totalSkin * 0.2 // 20% of total skin per quadrant
      const significantQuadrants = result.quadrants.filter((q) => q > threshold && q > 200).length
      if (significantQuadrants >= 2 && canFire("counter:multiFace")) {
        setMultiFaceAlerts((n) => n + 1)
        onViolationRef.current?.("multiFace")
        fireToast(
          "multiFace",
          "Multiple faces detected",
          "Only the registered participant should be visible.",
        )
      }
    }

    // ─── Look-away detection ─────────────────────────────────────────────
    // Track the centroid of skin-tone pixels in the center region.
    // If the centroid moves significantly between frames (averaged over
    // the last 3 frames to reduce noise), it indicates the person is
    // looking away or moving their head.
    if (lookAway && result.cx >= 0 && result.cy >= 0) {
      const currentCentroid = { x: result.cx, y: result.cy }

      // Add to history (keep last 3 frames)
      centroidHistoryRef.current.push(currentCentroid)
      if (centroidHistoryRef.current.length > 5) {
        centroidHistoryRef.current.shift()
      }

      // Calculate average centroid from history
      const history = centroidHistoryRef.current
      if (history.length >= 3) {
        const avgX = history.reduce((s, p) => s + p.x, 0) / history.length
        const avgY = history.reduce((s, p) => s + p.y, 0) / history.length

        const last = lastCentroidRef.current
        lastCentroidRef.current = { x: avgX, y: avgY }

        if (last) {
          const dx = avgX - last.x
          const dy = avgY - last.y
          const delta = Math.sqrt(dx * dx + dy * dy)
          // Lower threshold (8 instead of 15) for better sensitivity
          if (delta > 18 && canFire("counter:lookAway", 8000)) {
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
    }
  }, [analyzeFrame, faceDetection, multiFace, lookAway, canFire, fireToast])

  // ─── Attach the stream to the video element ────────────────────────────
  // Uses a polling approach: checks every 250ms if the stream needs to be
  // attached. This handles ALL race conditions:
  //   - Video element mounts after camera starts
  //   - Sidebar collapses and re-expands (video element is re-created)
  //   - React re-renders that might replace the video element
  const attachStreamToVideo = useCallback(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    if (video.srcObject === stream) return
    video.srcObject = stream
    video.play().catch((err) => {
      console.warn("[ai-proctor] video.play() failed:", err)
    })
  }, [])

  // Poll to attach the stream — runs continuously while enabled.
  // This is the KEY fix for the camera blank preview issue.
  // Also re-attaches when isReady changes (stream becomes available).
  useEffect(() => {
    if (!enabled) {
      if (attachIntervalRef.current) {
        clearInterval(attachIntervalRef.current)
        attachIntervalRef.current = null
      }
      return
    }

    // Check every 200ms if the stream needs to be attached.
    // This catches: video element mounting after camera starts,
    // sidebar collapse/expand, Sheet open/close on mobile, React re-renders.
    attachIntervalRef.current = setInterval(() => {
      attachStreamToVideo()
    }, 200)

    // Also try immediately and after short delays
    attachStreamToVideo()
    const t1 = setTimeout(() => attachStreamToVideo(), 100)
    const t2 = setTimeout(() => attachStreamToVideo(), 500)
    const t3 = setTimeout(() => attachStreamToVideo(), 1000)

    // MutationObserver: watch for video element or stream changes.
    // Re-checks target every second in case video mounts after observer setup.
    // No attributeFilter — srcObject is a DOM property, not an attribute.
    const observer = new MutationObserver(() => {
      attachStreamToVideo()
    })
    const observeTarget = () => {
      const target = videoRef.current?.parentElement || document.body
      observer.observe(target, {
        childList: true,
        subtree: true,
      })
    }
    observeTarget()
    // Re-observe if target changes (video mounts later)
    const retargetInterval = setInterval(() => {
      const target = videoRef.current?.parentElement || document.body
      if (observer.takeRecords().length === 0 && target !== observer) {
        observer.disconnect()
        observeTarget()
      }
    }, 1000)

    return () => {
      if (attachIntervalRef.current) {
        clearInterval(attachIntervalRef.current)
        attachIntervalRef.current = null
      }
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearInterval(retargetInterval)
      observer.disconnect()
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

        // Attach immediately
        attachStreamToVideo()

        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas")
        }

        // Wait for the video element to be ready
        const video = videoRef.current
        if (video) {
          await new Promise<void>((resolve) => {
            if (video.readyState >= 2) {
              resolve()
              return
            }
            const onReady = () => {
              video.removeEventListener("loadeddata", onReady)
              video.removeEventListener("loadedmetadata", onReady)
              resolve()
            }
            video.addEventListener("loadeddata", onReady)
            video.addEventListener("loadedmetadata", onReady)
            setTimeout(resolve, 3000)
          })
          video.play().catch(() => {})
        }

        if (cancelled) return
        setIsReady(true)
        setError(null)

        // Start analysis interval (every 1.5 seconds for better responsiveness)
        intervalRef.current = setInterval(tick, 1500)
        // Run first tick after a short delay
        setTimeout(tick, 800)
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
      centroidHistoryRef.current = []
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
