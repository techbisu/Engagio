"use client"

import { useEffect, useState } from "react"

interface WatermarkOverlayProps {
  email: string
  enabled: boolean
}

/**
 * Fixed-position semi-transparent watermark overlay. Scatters 6 watermark
 * elements across the viewport (corners + mid-edges) so any photo/video
 * capture includes at least one. Uses pointer-events: none + select-none so
 * it never blocks interaction. Each watermark shows the student's email + a
 * live timestamp (updates every second).
 *
 * Designed to be subtle but readable: opacity 0.10, rotated -15deg,
 * monospace timestamp, slate text color (works on both light + dark
 * backgrounds).
 *
 * When `enabled` is false, renders nothing.
 */
export function WatermarkOverlay({ email, enabled }: WatermarkOverlayProps) {
  const [now, setNow] = useState(() => new Date())

  // Update timestamp every second.
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [enabled])

  if (!enabled) return null

  const stamp = now.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  // 6 watermarks scattered across the viewport — corners + mid-edges.
  // Position is set via inline `top/left` so we can also apply the rotation
  // transform without conflicting with Tailwind's translate utilities.
  const positions = [
    { top: "1rem", left: "1rem" },
    { top: "1rem", left: "50%" },
    { top: "1rem", right: "1rem" },
    { bottom: "1rem", left: "1rem" },
    { top: "50%", left: "1rem" },
    { bottom: "1rem", right: "1rem" },
  ]

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] select-none"
    >
      {positions.map((pos, i) => (
        <div
          key={i}
          className="absolute font-mono text-[11px] leading-tight text-slate-700 dark:text-slate-200"
          style={{
            opacity: 0.1,
            transform: "rotate(-15deg)",
            whiteSpace: "nowrap",
            ...pos,
          }}
        >
          <div className="font-semibold">{email}</div>
          <div>{stamp}</div>
        </div>
      ))}
    </div>
  )
}
