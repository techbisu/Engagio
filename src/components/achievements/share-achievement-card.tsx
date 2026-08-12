"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type {
  ShareableAchievementDto,
  PublicAchievementDto,
  AchievementTemplateId,
} from "@/types"

type AchievementLike = Pick<
  ShareableAchievementDto | PublicAchievementDto,
  | "type"
  | "title"
  | "subtitle"
  | "participantName"
  | "score"
  | "totalScore"
  | "percentage"
  | "rank"
  | "totalParticipants"
  | "achievementData"
  | "templateId"
  | "publicToken"
>

export interface ShareAchievementCardProps {
  achievement: AchievementLike
  className?: string
}

/**
 * Scroll-stopping social media card — minimal data, MASSIVE hero number.
 * Inspired by Spotify Wrapped, Duolingo, and gaming achievement unlocks.
 */
export function ShareAchievementCard({
  achievement,
  className,
}: ShareAchievementCardProps) {
  const template = achievement.templateId ?? "modern"
  const theme = THEMES[template] || THEMES.modern

  const hasPercent =
    typeof achievement.percentage === "number" && achievement.percentage >= 0
  const hasRank = typeof achievement.rank === "number" && achievement.rank > 0
  const hasScore =
    typeof achievement.score === "number" &&
    typeof achievement.totalScore === "number"
  const isCertificate = achievement.type === "CERTIFICATE_EARNED"

  const eventName =
    achievement.subtitle ||
    achievement.achievementData?.eventTitle ||
    achievement.title

  return (
    <div
      className={cn("relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl shadow-2xl", className)}
      style={{
        aspectRatio: "4 / 5",
        background: `linear-gradient(160deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)`,
      }}
    >
      {/* Glow behind hero number */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[15%] size-[500px] -translate-x-1/2 rounded-full"
        style={{ background: `radial-gradient(circle, ${theme.glow} 0%, transparent 60%)` }}
      />

      {/* Confetti explosion */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {generateConfetti(theme, 40).map((c, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: `${c.size}px`,
              height: `${c.size}px`,
              backgroundColor: c.color,
              borderRadius: c.isCircle ? "50%" : "3px",
              opacity: c.opacity,
              transform: `rotate(${c.rotation}deg)`,
            }}
          />
        ))}
      </div>

      {/* ═══ CENTER CONTENT ═══ */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-10 py-12">
        {/* Hero number — MASSIVE */}
        {isCertificate ? (
          <div
            className="grid size-28 place-items-center rounded-full shadow-2xl sm:size-32"
            style={{ background: theme.accent }}
          >
            <svg viewBox="0 0 24 24" className="size-14 text-white sm:size-16" fill="currentColor">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
            </svg>
          </div>
        ) : hasPercent ? (
          <div className="flex items-baseline gap-0.5">
            <span className="text-[180px] font-black leading-[0.85] tabular-nums sm:text-[200px]">
              {achievement.percentage}
            </span>
            <span className="text-[80px] font-bold leading-none" style={{ color: theme.accent }}>
              %
            </span>
          </div>
        ) : hasRank ? (
          <div className="flex flex-col items-center">
            <div className="mb-2 text-6xl sm:text-7xl">
              {achievement.rank === 1 ? "🥇" : achievement.rank === 2 ? "🥈" : achievement.rank === 3 ? "🥉" : "🏆"}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[140px] font-black leading-[0.85] tabular-nums sm:text-[160px]">
                {achievement.rank}
              </span>
              <span className="text-[60px] font-bold leading-none" style={{ color: theme.accent }}>
                {ordinalSuffix(achievement.rank as number)}
              </span>
            </div>
          </div>
        ) : hasScore ? (
          <div className="flex items-baseline gap-2">
            <span className="text-[140px] font-black leading-[0.85] tabular-nums sm:text-[160px]">
              {achievement.score}
            </span>
            <span className="text-[50px] font-bold leading-none" style={{ color: theme.accent }}>
              / {achievement.totalScore}
            </span>
          </div>
        ) : (
          <div
            className="grid size-28 place-items-center rounded-full shadow-2xl sm:size-32"
            style={{ background: theme.accent }}
          >
            <svg viewBox="0 0 24 24" className="size-14 text-white sm:size-16" fill="currentColor">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
            </svg>
          </div>
        )}

        {/* Participant name (medium, below hero) */}
        <p className="mt-10 max-w-full text-center text-3xl font-extrabold leading-tight sm:text-4xl">
          {achievement.participantName}
        </p>

        {/* Event name (accent color) */}
        <p
          className="mt-2 max-w-full text-center text-xl font-semibold sm:text-2xl"
          style={{ color: theme.accentLight }}
        >
          {eventName}
        </p>
      </div>

      {/* ═══ FOOTER (minimal: QR + Powered by) ═══ */}
      <div className="relative z-10 flex items-center justify-center gap-3 pb-6">
        {/* QR placeholder */}
        <div
          className="grid size-12 place-items-center rounded-lg p-1.5 sm:size-14"
          style={{ background: "rgba(255,255,255,0.1)" }}
        >
          <svg viewBox="0 0 24 24" className="size-7 text-white/60 sm:size-8" fill="currentColor">
            <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z" />
          </svg>
        </div>
        <span className="text-xs text-white/40 sm:text-sm">Powered by Engagio</span>
      </div>
    </div>
  )
}

// ─── Confetti generator (concentrated around center) ───────────────────────

interface ConfettiPiece {
  x: number
  y: number
  size: number
  color: string
  opacity: number
  rotation: number
  isCircle: boolean
}

function generateConfetti(theme: CardTheme, count: number): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = []
  let seed = 42
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2
    const distance = rand() * 45
    const centerX = 50
    const centerY = 42
    pieces.push({
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance * 0.8,
      size: 4 + Math.floor(rand() * 12),
      color: theme.confetti[i % theme.confetti.length],
      opacity: 0.4 + rand() * 0.5,
      rotation: Math.floor(rand() * 360),
      isCircle: rand() > 0.4,
    })
  }
  return pieces
}

// ─── 5 vibrant gradient themes ─────────────────────────────────────────────

interface CardTheme {
  bgFrom: string
  bgTo: string
  accent: string
  accentLight: string
  glow: string
  confetti: string[]
}

const THEMES: Record<AchievementTemplateId, CardTheme> = {
  // 1. Emerald fire
  minimal: {
    bgFrom: "#022c22", bgTo: "#000000",
    accent: "#34d399", accentLight: "#a7f3d0",
    glow: "rgba(16,185,129,0.6)",
    confetti: ["#34d399", "#a7f3d0", "#6ee7b7", "#ffffff"],
  },
  // 2. Ocean deep
  modern: {
    bgFrom: "#042f2e", bgTo: "#020617",
    accent: "#22d3ee", accentLight: "#67e8f9",
    glow: "rgba(34,211,238,0.6)",
    confetti: ["#22d3ee", "#67e8f9", "#a5f3fc", "#ffffff"],
  },
  // 3. Golden hour
  professional: {
    bgFrom: "#451a03", bgTo: "#000000",
    accent: "#fbbf24", accentLight: "#fde68a",
    glow: "rgba(251,191,36,0.6)",
    confetti: ["#fbbf24", "#fde68a", "#f59e0b", "#ffffff"],
  },
  // 4. Royal purple
  celebration: {
    bgFrom: "#2e1065", bgTo: "#000000",
    accent: "#f472b6", accentLight: "#fbcfe8",
    glow: "rgba(244,114,182,0.6)",
    confetti: ["#f472b6", "#fbcfe8", "#a78bfa", "#ffffff", "#fbbf24"],
  },
  // 5. Sunset
  conference: {
    bgFrom: "#7f1d1d", bgTo: "#000000",
    accent: "#fb923c", accentLight: "#fed7aa",
    glow: "rgba(251,146,60,0.6)",
    confetti: ["#fb923c", "#fed7aa", "#f87171", "#ffffff", "#fbbf24"],
  },
}

// ─── Utils ─────────────────────────────────────────────────────────────────

function ordinalSuffix(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return "th"
  switch (n % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}
