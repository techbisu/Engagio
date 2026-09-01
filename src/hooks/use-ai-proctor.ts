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

  // ─── Confidence thresholds ────────────────────────────────────────────
  const FACE_CONFIDENCE = 0.8 // High confidence for face presence
  const MULTIFACE_CONFIDENCE = 0.85 // Even higher for multi-face
  const MIN_FACE_AREA_RATIO = 0.05 // Face must be >5% of video frame area
  const LOOKAWAY_THRESHOLD = 15 // 15% deviation from baseline
  const LOOKAWAY_CONSECUTIVE = 3 // 3 consecutive ticks away
  const GRACE_PERIOD_MS = 5000 // 5s after ready before counting
  const TICK_INTERVAL_MS = 3000 // 3 seconds between detections
  const BASELINE_SAMPLES = 5 // 5 ticks to establish baseline (~15s)

  // ─── Main analysis tick ───────────────────────────────────────────────
  const tick = useCallback(async () => {
    const video = analysisVideoRef.current
    const model = modelRef.current
    if (!video || video.readyState < 2 || !model) return

    // Grace period check — don't count violations in the first 5 seconds
    const inGracePeriod = Date.now() - readyTimeRef.current < GRACE_PERIOD_MS

    let predictions: any[] = []
    try {
      predictions = await model.estimateFaces(video, false)
    } catch {
      return
    }

    // ─── Face presence (0.8 confidence) ────────────────────────────────
    const faces = predictions.filter((p: any) => p.probability && p.probability[0] > FACE_CONFIDENCE)
    const count = faces.length

    setFaceCount(count)
    setFacePresent(count > 0)

    // Face not detected
    if (!inGracePeriod && faceDetection && count === 0 && canFire("counter:face", 3000)) {
      setFaceNotDetected((n) => n + 1)
      onViolationRef.current?.("face")
      fireToast("face", "No face detected", "Please keep your face visible to the camera.")
    }

    // ─── Multi-face detection (0.85 confidence + area filter) ──────────
    if (!inGracePeriod && multiFace && count >= 2) {
      // Filter by bounding box area — only count "real" faces
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

    // ─── Look-away detection (baseline + 15% + consecutive) ────────────
    if (!inGracePeriod && lookAway && count >= 1) {
      const face = faces[0]
      const topLeft = face.topLeft
      const bottomRight = face.bottomRight
      const centerX = (topLeft[0] + bottomRight[0]) / 2
      const VW = video.videoWidth || 320
      const normalizedX = (centerX / VW) * 100

      // ── Baseline calibration phase ───────────────────────────────────
      if (baselineXRef.current === null) {
        // Still calibrating — collect samples
        baselineSamplesRef.current.push(normalizedX)
        if (baselineSamplesRef.current.length >= BASELINE_SAMPLES) {
          // Calculate baseline as the average of samples
          const sum = baselineSamplesRef.current.reduce((a, b) => a + b, 0)
          baselineXRef.current = sum / baselineSamplesRef.current.length
          // Calibration complete — the quiz runner will detect initPhase change
        }
        return // Don't check for look-away during calibration
      }

      // ── Detection phase ───────────────────────────────────────────────
      const deviation = Math.abs(normalizedX - baselineXRef.current)

      if (deviation > LOOKAWAY_THRESHOLD) {
        // Face is away from baseline — increment consecutive counter
        consecutiveAwayRef.current++

        if (consecutiveAwayRef.current >= LOOKAWAY_CONSECUTIVE && canFire("counter:lookAway", 5000)) {
          setLookAwayAlerts((n) => n + 1)
          onViolationRef.current?.("lookAway")
          fireToast("lookAway", "Looking away detected", "Please keep your eyes on the screen.")
          // Reset consecutive counter after firing
          consecutiveAwayRef.current = 0
        }
      } else {
        // Face is back at center — reset consecutive counter
        consecutiveAwayRef.current = 0

        // Slowly drift the baseline if user has been at center for a while
        // (handles natural position changes over a long exam)
        // Weighted average: 95% old baseline + 5% current position
        baselineXRef.current = baselineXRef.current * 0.95 + normalizedX * 0.05
      }
    }
  }, [faceDetection, multiFace, lookAway, canFire, fireToast])

  // ─── Start camera + model (sequential init) ───────────────────────────
  const startProctor = useCallback(async () => {
    if (!enabled) return
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
      analysisVideoRef.current?.play().catch(() => {})

      // Also attach to the visible preview video
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }

      // Step 3: Load BlazeFace model
      setInitPhase("loading-model")
      const blazeface = await import("@tensorflow-models/blazeface")
      await import("@tensorflow/tfjs")
      const model = await blazeface.load()
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

      const faces = predictions.filter((p: any) => p.probability && p.probability[0] > FACE_CONFIDENCE)
      if (faces.length === 0) {
        // No face detected on first check — tell the user
        setInitPhase("error")
        setError("No face detected. Please position your face in the camera and click 'Retry'.")
        setFacePresent(false)
        return
      }

      setFacePresent(true)
      setFaceCount(faces.length)

      // Step 5: Start calibration phase
      setInitPhase("calibrating")
      baselineXRef.current = null
      baselineSamplesRef.current = []
      consecutiveAwayRef.current = 0

      // Start the detection tick
      readyTimeRef.current = Date.now()
      setIsReady(true)
      setInitPhase("ready")

      // Run detection every 3 seconds
      intervalRef.current = setInterval(() => void tick(), TICK_INTERVAL_MS)
      // First tick after 3 seconds
      setTimeout(() => void tick(), TICK_INTERVAL_MS)
    } catch (e: any) {
      if (e?.name === "NotAllowedError") {
        setError("Camera access denied. Please grant camera permission to start the proctored exam.")
      } else {
        setError(e instanceof Error ? e.message : "Failed to initialize AI proctor")
      }
      setInitPhase("error")
      setIsReady(false)
    }
  }, [enabled, tick])

  // ─── Auto-start when enabled ──────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      setInitPhase("idle")
      setIsReady(false)
      return
    }
    void startProctor()

    return () => {
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
  }, [enabled, startProctor])

  // ─── Re-attach stream to preview video periodically ───────────────────
  useEffect(() => {
    if (!enabled || !streamRef.current) return
    const attachInterval = setInterval(() => {
      const video = videoRef.current
      const stream = streamRef.current
      if (video && stream && video.srcObject !== stream) {
        video.srcObject = stream
        video.play().catch(() => {})
      }
    }, 500)
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
