"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export interface UseAiProctorOptions {
  /** Master toggle — when false, no camera access, no analysis. */
  enabled: boolean
  /** When true, check for face presence. */
  faceDetection: boolean
  /** When true, detect multiple faces. */
  multiFace: boolean
  /** When true, detect looking away. */
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
  /** LIVE face-present status — true when a face is currently detected. */
  facePresent: boolean
  /** Number of faces detected in the latest frame (0, 1, or 2+). */
  faceCount: number
}

// Canvas dimensions for skin-tone analysis (fallback only).
const CW = 160
const CH = 120

/**
 * AI proctor hook. Uses the browser's native FaceDetector API (Chrome/Edge)
 * for accurate face detection. Falls back to a skin-tone pixel heuristic
 * when FaceDetector is not available (Firefox, Safari).
 *
 * Detection methods:
 * - Face presence: FaceDetector detects ≥1 face OR skin-tone heuristic finds ≥200 skin pixels in center
 * - Multi-face: FaceDetector detects ≥2 faces OR skin-tone heuristic finds left+right clusters with center gap
 * - Look-away: FaceDetector face bounding box center shifts >8px horizontally between frames
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const attachIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // FaceDetector instance (Chrome/Edge only). null if not supported.
  const faceDetectorRef = useRef<any>(null)

  const onViolationRef = useRef(onViolation)
  useEffect(() => {
    onViolationRef.current = onViolation
  })

  // Look-away tracking
  const lastFaceCenterRef = useRef<{ x: number; y: number } | null>(null)
  const centerHistoryRef = useRef<{ x: number; y: number }[]>([])
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

  // ─── Initialize FaceDetector (if supported) ──────────────────────────
  useEffect(() => {
    if (!enabled) return
    // FaceDetector is available in Chrome/Edge (behind "Experimental Web
    // Platform Features" flag in older versions, enabled by default in newer).
    // Safari and Firefox do NOT support it.
    try {
      if (typeof window !== "undefined" && "FaceDetector" in window) {
        // @ts-ignore — FaceDetector is not in TS DOM lib
        faceDetectorRef.current = new (window as any).FaceDetector({
          maxDetectedFaces: 5,
          fastMode: true,
        })
      }
    } catch {
      faceDetectorRef.current = null
    }
  }, [enabled])

  // ─── Skin-tone fallback analysis ─────────────────────────────────────
  const analyzeSkinTone = useCallback((): {
    centerCount: number
    cx: number
    cy: number
    bands: [number, number, number]
    totalSkin: number
  } | null => {
    const video = analysisVideoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return null

    const VW = video.videoWidth || 320
    const VH = video.videoHeight || 240
    if (VW === 0 || VH === 0) return null

    canvas.width = CW
    canvas.height = CH
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null

    try {
      ctx.drawImage(video, 0, 0, VW, VH, 0, 0, CW, CH)
    } catch {
      return null
    }
    const data = ctx.getImageData(0, 0, CW, CH).data

    const centerSize = 80
    const cx0 = Math.floor((CW - centerSize) / 2)
    const cy0 = Math.floor((CH - centerSize) / 2)
    let centerCount = 0, sumX = 0, sumY = 0, totalSkin = 0
    const bandW = Math.floor(CW / 3)
    const bands = [0, 0, 0]
    const halfW = Math.floor(CW / 2)
    const halfH = Math.floor(CH / 2)

    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const idx = (y * CW + x) * 4
        const r = data[idx], g = data[idx + 1], b = data[idx + 2]
        const max = Math.max(r, g, b), min = Math.min(r, g, b)
        const isSkin = r > 95 && g > 40 && b > 20 && r > g && r > b &&
          r - g > 15 && r - b > 15 && max - min > 15 &&
          !(r > 220 && g > 210 && b > 170)
        if (!isSkin) continue
        totalSkin++
        if (x < bandW) bands[0]++
        else if (x < bandW * 2) bands[1]++
        else bands[2]++
        if (x >= cx0 && x < cx0 + centerSize && y >= cy0 && y < cy0 + centerSize) {
          centerCount++; sumX += x; sumY += y
        }
      }
    }
    return {
      centerCount,
      cx: centerCount > 0 ? sumX / centerCount : -1,
      cy: centerCount > 0 ? sumY / centerCount : -1,
      bands: bands as [number, number, number],
      totalSkin,
    }
  }, [])

  // ─── Main analysis tick ───────────────────────────────────────────────
  const tick = useCallback(async () => {
    const video = analysisVideoRef.current
    if (!video || video.readyState < 2) return

    const detector = faceDetectorRef.current
    let detectedFaces: any[] = []
    let useFallback = false

    // ── Primary: FaceDetector API ─────────────────────────────────────
    if (detector) {
      try {
        detectedFaces = await detector.detect(video)
      } catch {
        useFallback = true
      }
    } else {
      useFallback = true
    }

    // ── Fallback: skin-tone heuristic ──────────────────────────────────
    if (useFallback) {
      const result = analyzeSkinTone()
      if (!result) return

      const isFacePresent = result.centerCount >= 150
      setFacePresent(isFacePresent)
      setFaceCount(isFacePresent ? 1 : 0)

      // Face not detected
      if (faceDetection && !isFacePresent && canFire("counter:face", 3000)) {
        setFaceNotDetected((n) => n + 1)
        onViolationRef.current?.("face")
        fireToast("face", "No face detected", "Please keep your face visible to the camera.")
      }

      // Multi-face (3-band gap detection)
      if (multiFace && result.totalSkin > 1000 && isFacePresent) {
        const [leftBand, centerBand, rightBand] = result.bands
        if (leftBand > 250 && rightBand > 250 && centerBand < 120 && canFire("counter:multiFace", 5000)) {
          setMultiFaceAlerts((n) => n + 1)
          onViolationRef.current?.("multiFace")
          fireToast("multiFace", "Multiple faces detected", "Only the registered participant should be visible.")
        }
      }

      // Look-away (horizontal centroid shift)
      if (lookAway && result.cx >= 0) {
        const centroid = { x: result.cx, y: result.cy }
        centerHistoryRef.current.push(centroid)
        if (centerHistoryRef.current.length > 4) centerHistoryRef.current.shift()
        if (centerHistoryRef.current.length >= 3) {
          const oldest = centerHistoryRef.current[0]
          const newest = centerHistoryRef.current[centerHistoryRef.current.length - 1]
          const dx = Math.abs(newest.x - oldest.x)
          if (dx > 8 && canFire("counter:lookAway", 3000)) {
            setLookAwayAlerts((n) => n + 1)
            onViolationRef.current?.("lookAway")
            fireToast("lookAway", "Looking away detected", "Please keep your eyes on the screen.")
          }
        }
      }
      return
    }

    // ── FaceDetector API results ──────────────────────────────────────
    const count = detectedFaces.length
    setFaceCount(count)
    setFacePresent(count > 0)

    // Face not detected
    if (faceDetection && count === 0 && canFire("counter:face", 3000)) {
      setFaceNotDetected((n) => n + 1)
      onViolationRef.current?.("face")
      fireToast("face", "No face detected", "Please keep your face visible to the camera.")
    }

    // Multi-face
    if (multiFace && count >= 2 && canFire("counter:multiFace", 5000)) {
      setMultiFaceAlerts((n) => n + 1)
      onViolationRef.current?.("multiFace")
      fireToast("multiFace", "Multiple faces detected", "Only the registered participant should be visible.")
    }

    // Look-away (face bounding box center shift)
    if (lookAway && count >= 1) {
      const face = detectedFaces[0]
      const box = face.boundingBox
      const centerX = box.x + box.width / 2
      const centerY = box.y + box.height / 2
      const currentCenter = { x: centerX, y: centerY }

      centerHistoryRef.current.push(currentCenter)
      if (centerHistoryRef.current.length > 4) centerHistoryRef.current.shift()
      if (centerHistoryRef.current.length >= 3) {
        const oldest = centerHistoryRef.current[0]
        const newest = centerHistoryRef.current[centerHistoryRef.current.length - 1]
        // Normalize to video dimensions so threshold is proportional
        const VW = video.videoWidth || 320
        const dx = Math.abs(newest.x - oldest.x) / VW * 100 // percentage shift
        // If face center shifts >5% of video width, it's a look-away
        if (dx > 5 && canFire("counter:lookAway", 3000)) {
          setLookAwayAlerts((n) => n + 1)
          onViolationRef.current?.("lookAway")
          fireToast("lookAway", "Looking away detected", "Please keep your eyes on the screen.")
        }
      }
    }
  }, [analyzeSkinTone, faceDetection, multiFace, lookAway, canFire, fireToast])

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
          const onReady = () => { av.removeEventListener("loadeddata", onReady); av.removeEventListener("loadedmetadata", onReady); resolve() }
          av.addEventListener("loadeddata", onReady)
          av.addEventListener("loadedmetadata", onReady)
          setTimeout(resolve, 3000)
        })
        analysisVideoRef.current?.play().catch(() => {})
        attachStreamToVideo()
        if (!canvasRef.current) canvasRef.current = document.createElement("canvas")
        if (cancelled) return
        setIsReady(true); setError(null)
        // Run every 2 seconds (FaceDetector is async, so 2s is reasonable)
        intervalRef.current = setInterval(() => void tick(), 2000)
        setTimeout(() => void tick(), 800)
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
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
      if (videoRef.current) try { videoRef.current.srcObject = null } catch {}
      if (analysisVideoRef.current) try { analysisVideoRef.current.srcObject = null; analysisVideoRef.current = null } catch {}
      lastFaceCenterRef.current = null
      centerHistoryRef.current = []
      lastFiredRef.current = {}
    }
  }, [enabled, tick, attachStreamToVideo])

  return {
    faceNotDetected, multiFaceAlerts, lookAwayAlerts, isReady, error, videoRef,
    facePresent, faceCount,
  }
}
