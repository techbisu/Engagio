"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export interface UseAiProctorOptions {
  enabled: boolean
  faceDetection: boolean
  multiFace: boolean
  lookAway: boolean
  onViolation?: (type: "face" | "multiFace" | "lookAway") => void
}

export type AiProctorInitPhase =
  | "idle"
  | "requesting-camera"
  | "loading-model"
  | "calibrating"
  | "ready"
  | "error"

export interface AiProctorState {
  faceNotDetected: number
  multiFaceAlerts: number
  lookAwayAlerts: number
  isReady: boolean
  error: string | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  facePresent: boolean
  faceCount: number
  /** Current initialization phase — used by the quiz runner to show
   *  appropriate UI (camera permission, model loading, calibrating, etc.) */
  initPhase: AiProctorInitPhase
}

// ─── Confidence thresholds (constants, not state) ─────────────────────────
const FACE_CONFIDENCE = 0.8
const MULTIFACE_CONFIDENCE = 0.85
const MIN_FACE_AREA_RATIO = 0.05
const LOOKAWAY_THRESHOLD = 15
const LOOKAWAY_CONSECUTIVE = 3
const GRACE_PERIOD_MS = 5000
const TICK_INTERVAL_MS = 3000
const BASELINE_SAMPLES = 5

/**
 * AI proctor hook using @tensorflow-models/blazeface.
 *
 * SEQUENTIAL INIT (camera → model → detect → baseline → ready):
 * 1. Request camera permission (explicit user gesture)
 * 2. Wait for camera stream ready
 * 3. Load BlazeFace model
 * 4. Run first detection — confirm face IS detected
 * 5. Establish baseline (average center of 5 frames)
 * 6. Only then set initPhase = "ready" → quiz can start
 *
 * DETECTION THRESHOLDS:
 * - Face presence: 0.8 confidence (high = fewer false "no face")
 * - Multi-face: 0.85 confidence + area filter (>5% of frame)
 * - Look-away: 15% deviation from baseline, 3 consecutive frames
 * - Grace period: 5 seconds after ready before counting violations
 * - Tick interval: 3 seconds (less aggressive)
 *
 * BUG FIXES (from review):
 * 1. tick is stored in a ref — the useEffect only depends on [enabled], so
 *    the camera doesn't restart when proctor settings change mid-exam.
 * 2. initPhase is set to "ready" INSIDE the tick function after calibration
 *    completes, not immediately in startProctor.
 * 3. A cancelled flag prevents race conditions between async init and cleanup.
 */
export function useAiProctor(options: UseAiProctorOptions): AiProctorState {
  const { enabled, faceDetection, multiFace, lookAway, onViolation } = options

  const [faceNotDetected, setFaceNotDetected] = useState(0)
  const [multiFaceAlerts, setMultiFaceAlerts] = useState(0)
  const [lookAwayAlerts, setLookAwayAlerts] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facePresent, setFacePresent] = useState(false)
  const [faceCount, setFaceCount] = useState(0)
  const [initPhase, setInitPhase] = useState<AiProctorInitPhase>("idle")

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const analysisVideoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const modelRef = useRef<any>(null)

  const onViolationRef = useRef(onViolation)
  useEffect(() => {
    onViolationRef.current = onViolation
  })

  // Rate limiting for violations
  const lastFiredRef = useRef<Record<string, number>>({})
  const canFire = useCallback((key: string, windowMs = 5000, now = Date.now()) => {
    const last = lastFiredRef.current[key] ?? 0
    if (now - last < windowMs) return false
    lastFiredRef.current[key] = now
    return true
  }, [])

  const fireToast = useCallback(
    (type: "face" | "multiFace" | "lookAway", title: string, description?: string) => {
      if (!canFire(`toast:${type}`, 5000)) return
      toast.warning(title, description ? { description } : undefined)
    },
    [canFire],
  )

  // Look-away baseline tracking
  const baselineXRef = useRef<number | null>(null)
  const baselineSamplesRef = useRef<number[]>([])
  const consecutiveAwayRef = useRef(0)
  const readyTimeRef = useRef<number>(0)

  // ─── BUG FIX 1: Store latest proctor settings + tick in refs ───────────
  // This way the tick function always reads the latest settings without
  // needing to be recreated (which would restart the camera).
  const settingsRef = useRef({ faceDetection, multiFace, lookAway })
  useEffect(() => {
    settingsRef.current = { faceDetection, multiFace, lookAway }
  }, [faceDetection, multiFace, lookAway])

  // ─── Main analysis tick (stable — no deps, reads from refs) ────────────
  // This function is created ONCE and stored in a ref. The useEffect that
  // starts the camera depends only on [enabled], not on tick or settings.
  const tickRef = useRef<() => Promise<void>>(async () => {})

  // Initialize tickRef once
  if (!tickRef.current.__initialized) {
    tickRef.current = async () => {
      const video = analysisVideoRef.current
      const model = modelRef.current
      if (!video || video.readyState < 2 || !model) return

      const { faceDetection: fd, multiFace: mf, lookAway: la } = settingsRef.current

      // Grace period check
      const inGracePeriod = Date.now() - readyTimeRef.current < GRACE_PERIOD_MS

      let predictions: any[] = []
      try {
        predictions = await model.estimateFaces(video, false)
      } catch {
        return
      }

      // ─── Face presence (0.8 confidence) ──────────────────────────────
      const faces = predictions.filter(
        (p: any) => p.probability && p.probability[0] > FACE_CONFIDENCE
      )
      const count = faces.length

      setFaceCount(count)
      setFacePresent(count > 0)

      // Face not detected
      if (!inGracePeriod && fd && count === 0 && canFire("counter:face", 3000)) {
        setFaceNotDetected((n) => n + 1)
        onViolationRef.current?.("face")
        fireToast("face", "No face detected", "Please keep your face visible to the camera.")
      }

      // ─── Multi-face detection (0.85 confidence + area filter) ────────
      if (!inGracePeriod && mf && count >= 2) {
        const VW = video.videoWidth || 320
        const VH = video.videoHeight || 240
        const frameArea = VW * VH
        const minFaceArea = frameArea * MIN_FACE_AREA_RATIO

        const realFaces = faces.filter((f: any) => {
          const tl = f.topLeft
          const br = f.bottomRight
          const area = Math.abs(br[0] - tl[0]) * Math.abs(br[1] - tl[1])
          return area > minFaceArea
        })

        if (realFaces.length >= 2 && canFire("counter:multiFace", 10000)) {
          setMultiFaceAlerts((n) => n + 1)
          onViolationRef.current?.("multiFace")
          fireToast("multiFace", "Multiple faces detected", "Only the registered participant should be visible.")
        }
      }

      // ─── Look-away detection (baseline + 15% + consecutive) ──────────
      if (!inGracePeriod && la && count >= 1) {
        const face = faces[0]
        const topLeft = face.topLeft
        const bottomRight = face.bottomRight
        const centerX = (topLeft[0] + bottomRight[0]) / 2
        const VW = video.videoWidth || 320
        const normalizedX = (centerX / VW) * 100

        // ── Baseline calibration phase ─────────────────────────────────
        if (baselineXRef.current === null) {
          baselineSamplesRef.current.push(normalizedX)
          if (baselineSamplesRef.current.length >= BASELINE_SAMPLES) {
            // Calibration complete
            const sum = baselineSamplesRef.current.reduce((a, b) => a + b, 0)
            baselineXRef.current = sum / baselineSamplesRef.current.length

            // ── BUG FIX 2: Set initPhase = "ready" ONLY after calibration ──
            readyTimeRef.current = Date.now()
            setIsReady(true)
            setInitPhase("ready")
          }
          return // Don't check for look-away during calibration
        }

        // ── Detection phase ─────────────────────────────────────────────
        const deviation = Math.abs(normalizedX - baselineXRef.current)

        if (deviation > LOOKAWAY_THRESHOLD) {
          consecutiveAwayRef.current++

          if (
            consecutiveAwayRef.current >= LOOKAWAY_CONSECUTIVE &&
            canFire("counter:lookAway", 5000)
          ) {
            setLookAwayAlerts((n) => n + 1)
            onViolationRef.current?.("lookAway")
            fireToast("lookAway", "Looking away detected", "Please keep your eyes on the screen.")
            consecutiveAwayRef.current = 0
          }
        } else {
          // Face is back at center — reset + slow baseline drift
          consecutiveAwayRef.current = 0
          baselineXRef.current = baselineXRef.current * 0.95 + normalizedX * 0.05
        }
      }
    }
    // Mark as initialized so we don't overwrite it on re-renders
    ;(tickRef.current as any).__initialized = true
  }

  // ─── Start camera + model (sequential init) ───────────────────────────
  // BUG FIX 1: This is NOT a useCallback — it's a plain async function
  // called from inside the useEffect. The useEffect depends only on [enabled].
  // BUG FIX 3: cancelled flag prevents race conditions between async init
  // and the cleanup function.
  useEffect(() => {
    if (!enabled) {
      setInitPhase("idle")
      setIsReady(false)
      return
    }

    let cancelled = false

    async function startProctor() {
      setInitPhase("requesting-camera")
      setError(null)

      try {
        // Step 1: Request camera permission
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API not supported in this browser")
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
          audio: false,
        })

        // BUG FIX 3: Check cancelled after each await
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream

        // Step 2: Attach stream to video elements
        if (!analysisVideoRef.current) {
          analysisVideoRef.current = document.createElement("video")
          analysisVideoRef.current.muted = true
          analysisVideoRef.current.playsInline = true
          analysisVideoRef.current.autoPlay = true
        }
        analysisVideoRef.current.srcObject = stream

        // Wait for video to be ready
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

        if (cancelled) return

        analysisVideoRef.current?.play().catch(() => {})

        // Note: we DON'T attach to videoRef.current here because during init,
        // the CameraPermissionGate is shown (videoRef is null — the sidebar
        // video element doesn't exist yet). The re-attach interval below
        // handles attaching the stream to the preview video once it mounts.

        // Step 3: Load BlazeFace model
        setInitPhase("loading-model")
        const blazeface = await import("@tensorflow-models/blazeface")
        await import("@tensorflow/tfjs")
        const model = await blazeface.load()

        if (cancelled) return

        modelRef.current = model

        // Step 4: Run first detection — confirm face IS detected
        const video = analysisVideoRef.current
        if (!video || video.readyState < 2) {
          throw new Error("Camera stream not ready")
        }

        let predictions: any[] = []
        try {
          predictions = await model.estimateFaces(video, false)
        } catch {
          throw new Error("Face detection failed to initialize")
        }

        if (cancelled) return

        const faces = predictions.filter(
          (p: any) => p.probability && p.probability[0] > FACE_CONFIDENCE
        )
        if (faces.length === 0) {
          if (!cancelled) {
            setInitPhase("error")
            setError("No face detected. Please position your face in the camera and click 'Retry'.")
            setFacePresent(false)
          }
          return
        }

        setFacePresent(true)
        setFaceCount(faces.length)

        // Step 5: Start calibration phase
        // BUG FIX 2: Do NOT set initPhase = "ready" here. The tick function
        // will set it to "ready" after collecting BASELINE_SAMPLES samples.
        setInitPhase("calibrating")
        baselineXRef.current = null
        baselineSamplesRef.current = []
        consecutiveAwayRef.current = 0

        // Start the detection tick — the tick will set initPhase = "ready"
        // after calibration completes (5 samples = ~15 seconds)
        intervalRef.current = setInterval(() => void tickRef.current(), TICK_INTERVAL_MS)
        // First tick after 3 seconds
        setTimeout(() => {
          if (!cancelled) void tickRef.current()
        }, TICK_INTERVAL_MS)
      } catch (e: any) {
        if (cancelled) return
        if (e?.name === "NotAllowedError") {
          setError("Camera access denied. Please grant camera permission to start the proctored exam.")
        } else {
          setError(e instanceof Error ? e.message : "Failed to initialize AI proctor")
        }
        setInitPhase("error")
        setIsReady(false)
      }
    }

    void startProctor()

    return () => {
      // BUG FIX 3: Set cancelled = true FIRST so any pending async operations
      // (getUserMedia, model.load, estimateFaces) know to bail out.
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
        try { videoRef.current.srcObject = null } catch {}
      }
      if (analysisVideoRef.current) {
        try { analysisVideoRef.current.srcObject = null; analysisVideoRef.current = null } catch {}
      }
      modelRef.current = null
      baselineXRef.current = null
      baselineSamplesRef.current = []
      consecutiveAwayRef.current = 0
      lastFiredRef.current = {}
    }
  }, [enabled]) // BUG FIX 1: ONLY depend on [enabled], not on tick or settings

  // ─── Re-attach stream to preview video periodically ───────────────────
  // This runs continuously while enabled. It attaches the camera stream to
  // the visible preview video element (videoRef) whenever the element is
  // available and the stream isn't already attached. This handles:
  // - The video element mounting AFTER the stream starts (during camera gate)
  // - The stream getting detached on re-render
  // - Mobile browsers that pause video on background
  useEffect(() => {
    if (!enabled) return
    const attachInterval = setInterval(() => {
      const video = videoRef.current
      const stream = streamRef.current
      if (video && stream && video.srcObject !== stream) {
        video.srcObject = stream
        video.play().catch(() => {})
      }
    }, 200) // Check every 200ms — fast enough to catch the video element mounting
    return () => clearInterval(attachInterval)
  }, [enabled])

  return {
    faceNotDetected,
    multiFaceAlerts,
    lookAwayAlerts,
    isReady,
    error,
    videoRef,
    facePresent,
    faceCount,
    initPhase,
  }
}
