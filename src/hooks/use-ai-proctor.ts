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

export interface AiProctorState {
  faceNotDetected: number
  multiFaceAlerts: number
  lookAwayAlerts: number
  isReady: boolean
  error: string | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  facePresent: boolean
  faceCount: number
}

/**
 * AI proctor hook using @tensorflow-models/blazeface for accurate face
 * detection. BlazeFace is a lightweight (~1MB) ML model that runs on
 * TensorFlow.js, works in all modern browsers, and accurately detects
 * multiple faces with bounding boxes.
 *
 * Detection:
 * - Face presence: BlazeFace detects ≥1 face
 * - Multi-face: BlazeFace detects ≥2 faces
 * - Look-away: Face bounding box center shifts >6% horizontally
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

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const analysisVideoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const attachIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const modelRef = useRef<any>(null)

  const onViolationRef = useRef(onViolation)
  useEffect(() => {
    onViolationRef.current = onViolation
  })

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

  // Look-away tracking
  const centerHistoryRef = useRef<{ x: number; y: number }[]>([])

  // ─── Load BlazeFace model ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    async function loadModel() {
      try {
        // Dynamically import to avoid bundling TFJS on pages that don't use the proctor
        const blazeface = await import("@tensorflow-models/blazeface")
        await import("@tensorflow/tfjs") // Ensure TFJS backend is registered
        const model = await blazeface.load()
        if (!cancelled) {
          modelRef.current = model
        }
      } catch (e) {
        console.error("[ai-proctor] Failed to load BlazeFace model:", e)
        // Model load failed — face detection won't work, but we still
        // have the anti-cheat counters (tab switches, copy, etc.)
      }
    }
    void loadModel()

    return () => {
      cancelled = true
      modelRef.current = null
    }
  }, [enabled])

  // ─── Main analysis tick ───────────────────────────────────────────────
  const tick = useCallback(async () => {
    const video = analysisVideoRef.current
    const model = modelRef.current
    if (!video || video.readyState < 2) return

    // If model isn't loaded yet, skip (will retry next tick)
    if (!model) return

    let predictions: any[] = []
    try {
      // BlazeFace returns array of predictions, each with:
      // - topLeft: [x, y]
      // - bottomRight: [x, y]
      // - probability: number (0-1 confidence)
      // - landmarks (optional)
      predictions = await model.estimateFaces(video, false)
    } catch (e) {
      // If detection fails (e.g., video not ready), skip this tick
      return
    }

    // Filter predictions by confidence threshold
    const faces = predictions.filter((p: any) => p.probability && p.probability[0] > 0.5)
    const count = faces.length

    setFaceCount(count)
    setFacePresent(count > 0)

    // ─── Face not detected ──────────────────────────────────────────────
    if (faceDetection && count === 0 && canFire("counter:face", 3000)) {
      setFaceNotDetected((n) => n + 1)
      onViolationRef.current?.("face")
      fireToast("face", "No face detected", "Please keep your face visible to the camera.")
    }

    // ─── Multi-face detection ───────────────────────────────────────────
    if (multiFace && count >= 2 && canFire("counter:multiFace", 5000)) {
      setMultiFaceAlerts((n) => n + 1)
      onViolationRef.current?.("multiFace")
      fireToast("multiFace", "Multiple faces detected", "Only the registered participant should be visible.")
    }

    // ─── Look-away detection ────────────────────────────────────────────
    if (lookAway && count >= 1) {
      const face = faces[0]
      // Calculate face bounding box center
      const topLeft = face.topLeft
      const bottomRight = face.bottomRight
      const centerX = (topLeft[0] + bottomRight[0]) / 2
      const centerY = (topLeft[1] + bottomRight[1]) / 2
      const currentCenter = { x: centerX, y: centerY }

      // Normalize to video dimensions (percentage shift)
      const VW = video.videoWidth || 320
      const normalizedX = centerX / VW * 100

      centerHistoryRef.current.push({ x: normalizedX, y: centerY })
      if (centerHistoryRef.current.length > 4) {
        centerHistoryRef.current.shift()
      }

      if (centerHistoryRef.current.length >= 3) {
        const oldest = centerHistoryRef.current[0]
        const newest = centerHistoryRef.current[centerHistoryRef.current.length - 1]
        const dx = Math.abs(newest.x - oldest.x)

        // If face center shifts >6% of video width, it's a look-away
        if (dx > 6 && canFire("counter:lookAway", 3000)) {
          setLookAwayAlerts((n) => n + 1)
          onViolationRef.current?.("lookAway")
          fireToast("lookAway", "Looking away detected", "Please keep your eyes on the screen.")
        }
      }
    }
  }, [faceDetection, multiFace, lookAway, canFire, fireToast])

  // ─── Attach stream to preview video ──────────────────────────────────
  const attachStreamToVideo = useCallback(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    if (video.srcObject === stream) return
    video.srcObject = stream
    video.play().catch(() => {})
  }, [])

  useEffect(() => {
    if (!enabled) {
      if (attachIntervalRef.current) {
        clearInterval(attachIntervalRef.current)
        attachIntervalRef.current = null
      }
      return
    }
    attachIntervalRef.current = setInterval(attachStreamToVideo, 200)
    attachStreamToVideo()
    const t1 = setTimeout(attachStreamToVideo, 100)
    const t2 = setTimeout(attachStreamToVideo, 500)
    return () => {
      if (attachIntervalRef.current) clearInterval(attachIntervalRef.current)
      clearTimeout(t1); clearTimeout(t2)
    }
  }, [enabled, attachStreamToVideo])

  // ─── Camera + analysis loop ──────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      setIsReady(false); setError(null); return
    }
    let cancelled = false

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API not supported in this browser")
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream

        if (!analysisVideoRef.current) {
          analysisVideoRef.current = document.createElement("video")
          analysisVideoRef.current.muted = true
          analysisVideoRef.current.playsInline = true
          analysisVideoRef.current.autoPlay = true
        }
        analysisVideoRef.current.srcObject = stream
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
        attachStreamToVideo()

        if (cancelled) return
        setIsReady(true); setError(null)

        // Run detection every 2 seconds (BlazeFace is async + needs time)
        intervalRef.current = setInterval(() => void tick(), 2000)
        // First tick after a short delay (model may still be loading)
        setTimeout(() => void tick(), 1500)
      } catch (e: any) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to access camera")
        setIsReady(false)
      }
    }
    void startCamera()

    return () => {
      cancelled = true
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
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
      centerHistoryRef.current = []
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
    faceCount,
  }
}
