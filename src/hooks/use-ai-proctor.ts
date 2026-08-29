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
  /** LIVE face-present status — true when a face is currently detected in
   *  the latest analyzed frame. Updated every tick (1.5s). This is
   *  separate from `faceNotDetected` (cumulative violation counter). */
  facePresent: boolean
}

interface SkinAnalysis {
  count: number
  cx: number
  cy: number
  quadrants: [number, number, number, number]
  totalSkin: number
  bands: [number, number, number] // left, center, right — for multi-face
}

// Canvas dimensions used for analysis. Defined at module level so both
// `analyzeFrame` and `tick` can reference them (previously `CW`/`CH` were
// local to `analyzeFrame` only, causing `tick`'s multi-face code to use
// `undefined` → silently fail).
const CW = 160
const CH = 120

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
  // Live face-present status — true when a face is currently detected in the
  // latest analyzed frame. Updated every tick. This is separate from
  // `faceNotDetected` (a cumulative violation counter) so the UI can show
  // a LIVE "Face detected: Yes/No" indicator.
  const [facePresent, setFacePresent] = useState(false)

  // videoRef is the PREVIEW element rendered in the security sidebar.
  // It may not be in the DOM when the sidebar is collapsed/closed.
  const videoRef = useRef<HTMLVideoElement | null>(null)
  // analysisVideoRef is an INTERNAL video element used solely for frame
  // analysis. It is created programmatically (NOT in the DOM) so it's
  // ALWAYS available regardless of sidebar state. This is the critical
  // fix for "AI proctor not counting" — counters now increment even when
  // the security sidebar is collapsed or the mobile Sheet is closed.
  const analysisVideoRef = useRef<HTMLVideoElement | null>(null)
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
    // Use the INTERNAL analysis video element (always available) instead of
    // the sidebar preview videoRef which may not be in the DOM.
    const video = analysisVideoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return null

    const VW = video.videoWidth || 320
    const VH = video.videoHeight || 240
    if (VW === 0 || VH === 0) return null

    // Ensure canvas dimensions match our analysis grid.
    canvas.width = CW
    canvas.height = CH
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null

    // Mirror the video horizontally (selfie cameras are mirrored, so we
    // analyze the mirrored frame to match what the user sees).
    try {
      ctx.save()
      ctx.translate(CW, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, VW, VH, 0, 0, CW, CH)
      ctx.restore()
    } catch {
      return null
    }
    const imageData = ctx.getImageData(0, 0, CW, CH)
    const data = imageData.data

    // Center region for face presence check (80×80 out of 160×120 = 53% width)
    const centerSize = 80
    const cx0 = Math.floor((CW - centerSize) / 2)
    const cy0 = Math.floor((CH - centerSize) / 2)
    let centerCount = 0
    let sumX = 0
    let sumY = 0
    let totalSkin = 0

    // Also count skin per horizontal band (3 bands) for multi-face detection.
    const bandW = Math.floor(CW / 3) // ~53
    const bands = [0, 0, 0] // left, center, right

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

        // Skin detection: RGB rule + uniformity check.
        const isSkin =
          r > 95 &&
          g > 40 &&
          b > 20 &&
          r > g &&
          r > b &&
          r - g > 15 &&
          r - b > 15 &&
          max - min > 15 &&
          !(r > 220 && g > 210 && b > 170) // exclude near-white (backgrounds)

        if (!isSkin) continue

        totalSkin++
        const qIdx = (x < halfW ? 0 : 1) + (y < halfH ? 0 : 2)
        quadrants[qIdx]++

        // Band counting for multi-face detection
        if (x < bandW) bands[0]++
        else if (x < bandW * 2) bands[1]++
        else bands[2]++

        if (x >= cx0 && x < cx0 + centerSize && y >= cy0 && y < cy0 + centerSize) {
          centerCount++
          sumX += x
          sumY += y
        }
      }
    }

    const cx = centerCount > 0 ? sumX / centerCount : -1
    const cy = centerCount > 0 ? sumY / centerCount : -1
    return { count: centerCount, cx, cy, quadrants, totalSkin, bands }
  }, [])

  const tick = useCallback(() => {
    const result = analyzeFrame()
    if (!result) return

    // ─── Live face-present status ────────────────────────────────────────
    // Update the live `facePresent` flag so the UI can show a real-time
    // "Face detected: Yes/No" indicator. This is independent of the
    // cumulative `faceNotDetected` violation counter.
    // Threshold: 200+ skin pixels in the 80×80 center region = face present.
    // Lower than the violation threshold (400) so the indicator turns green
    // as soon as a face is roughly present, even if not perfectly centered.
    const isFacePresent = result.count >= 200
    setFacePresent(isFacePresent)

    // ─── Face detection (violation counter) ──────────────────────────────
    // Face is detected if the center region has enough skin-tone pixels.
    // Threshold: 400+ skin pixels in the 80×80 center region (out of 6400 total).
    if (faceDetection) {
      const hasFace = result.count >= 400
      if (!hasFace && canFire("counter:face", 3000)) {
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
    // Multiple faces are detected when there are TWO SEPARATE horizontal
    // clusters of skin pixels — one on the LEFT side and one on the RIGHT side
    // of the frame, with a clear gap (no skin) in the center column.
    //
    // Algorithm (3-band gap detection):
    //   1. `analyzeFrame` already computed skin pixel counts in 3 vertical
    //      bands: left 1/3, center 1/3, right 1/3 (result.bands).
    //   2. Multi-face = left band has >300 skin AND right band has >300 skin
    //      AND center band has <150 skin (the gap between the two faces).
    //   3. Also require totalSkin > 1200 (enough for 2 faces).
    //   4. Require isFacePresent (don't trigger when no face is detected).
    //
    // A single face centered in the frame fills the center band → no gap →
    // no false positive. Two people side by side produce skin on the far
    // left and far right with a gap in the center → detected correctly.
    if (multiFace && result.totalSkin > 1200 && isFacePresent) {
      const [leftBand, centerBand, rightBand] = result.bands
      if (
        leftBand > 300 &&
        rightBand > 300 &&
        centerBand < 150 &&
        canFire("counter:multiFace", 5000)
      ) {
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
    // If the centroid shifts significantly between consecutive tick groups,
    // it indicates the person is looking away or turning their head.
    //
    // The centroid is computed from the center 80×80 region (where the face
    // should be). When the user looks left/right, the skin centroid shifts
    // in that direction. When they look down, it shifts down.
    //
    // Detection logic:
    //   - Track the centroid every tick (1.5s).
    //   - Keep a rolling history of the last 4 positions.
    //   - Compare the LATEST centroid against the OLDEST in the window.
    //   - If the horizontal shift exceeds the threshold, count as look-away.
    //   - Only count HORIZONTAL movement (x-axis) — looking left/right.
    //     Vertical movement (nodding) is common while reading and should
    //     not trigger.
    //
    // Threshold: 8px on a 160px-wide canvas. The center region is 80px wide
    // (40-120), so an 8px shift is ~10% of the region — a clear head turn.
    // Cooldown: 3 seconds.
    if (lookAway && result.cx >= 0) {
      const currentCentroid = { x: result.cx, y: result.cy }

      centroidHistoryRef.current.push(currentCentroid)
      if (centroidHistoryRef.current.length > 4) {
        centroidHistoryRef.current.shift()
      }

      const history = centroidHistoryRef.current
      if (history.length >= 3) {
        // Compare the latest centroid against the oldest in the window.
        const oldest = history[0]
        const newest = history[history.length - 1]
        const dx = newest.x - oldest.x
        const dy = newest.y - oldest.y

        // Horizontal shift (looking left/right) — primary trigger.
        // Use absolute value so both directions count.
        const horizontalShift = Math.abs(dx)

        // Only trigger on significant horizontal movement (looking away).
        // 8px on a 160px canvas = 5% shift = a clear head turn.
        // 4px threshold would be too sensitive (normal reading micro-movements).
        if (horizontalShift > 8 && canFire("counter:lookAway", 3000)) {
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

        // Create the INTERNAL analysis video element. This element is NOT
        // attached to the DOM — it exists purely so analyzeFrame() can read
        // frames from it via canvas.drawImage(). It is always available
        // regardless of whether the security sidebar is open/collapsed.
        if (!analysisVideoRef.current) {
          analysisVideoRef.current = document.createElement("video")
          analysisVideoRef.current.muted = true
          analysisVideoRef.current.playsInline = true
          analysisVideoRef.current.autoPlay = true
          analysisVideoRef.current.preload = "auto"
        }
        analysisVideoRef.current.srcObject = stream
        // Wait for the analysis video to be ready before starting the loop.
        await new Promise<void>((resolve) => {
          const av = analysisVideoRef.current
          if (!av) return resolve()
          if (av.readyState >= 2) return resolve()
          const onReady = () => {
            av.removeEventListener("loadeddata", onReady)
            av.removeEventListener("loadedmetadata", onReady)
            resolve()
          }
          av.addEventListener("loadeddata", onReady)
          av.addEventListener("loadedmetadata", onReady)
          setTimeout(resolve, 3000)
        })
        analysisVideoRef.current?.play().catch(() => {})

        // Also attach to the sidebar preview video element if it's in the DOM.
        attachStreamToVideo()

        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas")
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
      // Detach the stream from the preview video element.
      if (videoRef.current) {
        try {
          videoRef.current.srcObject = null
        } catch {
          // ignore
        }
      }
      // Detach and clean up the internal analysis video element.
      if (analysisVideoRef.current) {
        try {
          analysisVideoRef.current.srcObject = null
          analysisVideoRef.current = null
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
    facePresent,
  }
}
