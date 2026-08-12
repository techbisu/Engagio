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
 * Reference-matched achievement card — light gradient, trophy watermark,
 * confetti, clean professional layout.
 */
export function ShareAchievementCard({
  achievement,
  className,
}: ShareAchievementCardProps) {
  const template = achievement.templateId ?? "modern"
  const theme = THEMES[template] || THEMES.minimal

  const hasPercent =
    typeof achievement.percentage === "number" && achievement.percentage >= 0
  const hasRank = typeof achievement.rank === "number" && achievement.rank > 0
  const hasScore =
    typeof achievement.score === "number" &&
    typeof achievement.totalScore === "number"
  const isCertificate = achievement.type === "CERTIFICATE_EARNED"

  const serial = buildSerial(achievement.publicToken || "", achievement.achievementData?.orgName)
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const eventName =
    achievement.subtitle ||
    achievement.achievementData?.eventTitle ||
    achievement.title

  return (
    <div
      className={cn("relative flex w-full flex-col overflow-hidden rounded-2xl shadow-xl", className)}
      style={{
        aspectRatio: "4 / 5",
        background: `linear-gradient(160deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)`,
      }}
    >
      {/* Decorative blob (top-right) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full opacity-30"
        style={{ background: theme.blobColor }}
      />

      {/* Trophy watermark (behind text) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[35%] size-64 -translate-x-1/2 opacity-[0.08]"
      >
        <svg viewBox="0 0 100 100" className="size-full" fill="currentColor" style={{ color: theme.text }}>
          <path d="M30 15 L70 15 L68 45 Q68 55 60 58 L58 70 L72 70 L72 78 L28 78 L28 70 L42 70 L40 58 Q32 55 32 45 Z M20 20 L30 20 L30 30 Q30 38 24 38 Q18 38 18 30 Z M70 20 L80 20 L82 30 Q82 38 76 38 Q70 38 70 30 Z" />
        </svg>
      </div>

      {/* Confetti */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {generateConfetti(theme, 35).map((c, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: `${c.size}px`,
              height: `${c.size}px`,
              backgroundColor: c.color,
              borderRadius: c.isCircle ? "50%" : c.isDiamond ? "2px" : "50%",
              opacity: c.opacity,
              transform: c.isDiamond ? "rotate(45deg)" : "none",
            }}
          />
        ))}
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="relative z-10 flex flex-1 flex-col items-center px-8 py-10">
        {/* Badge (pill) */}
        <div
          className="inline-flex items-center rounded-full px-6 py-2 text-xs font-bold tracking-[0.3em] sm:text-sm"
          style={{ background: theme.badgeBg, color: theme.badgeText }}
        >
          {isCertificate ? "CERTIFICATE OF COMPLETION" : achievement.type.replace(/_/g, " ")}
        </div>

        {/* Hero metric */}
        <div className="mt-8 flex flex-col items-center">
          {isCertificate ? (
            <div
              className="grid size-20 place-items-center rounded-full shadow-lg"
              style={{ background: theme.accent }}
            >
              <svg viewBox="0 0 24 24" className="size-10 text-white" fill="currentColor">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </div>
          ) : hasPercent ? (
            <div className="flex items-baseline gap-0.5">
              <span className="text-7xl font-black leading-none tabular-nums sm:text-8xl" style={{ color: theme.text }}>
                {achievement.percentage}
              </span>
              <span className="text-4xl font-bold leading-none sm:text-5xl" style={{ color: theme.accent }}>
                %
              </span>
            </div>
          ) : hasRank ? (
            <div className="flex flex-col items-center">
              <div className="mb-1 text-4xl sm:text-5xl">
                {achievement.rank === 1 ? "🥇" : achievement.rank === 2 ? "🥈" : achievement.rank === 3 ? "🥉" : "🏆"}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-black leading-none tabular-nums sm:text-7xl" style={{ color: theme.text }}>
                  {achievement.rank}
                </span>
                <span className="text-3xl font-bold leading-none sm:text-4xl" style={{ color: theme.accent }}>
                  {ordinalSuffix(achievement.rank as number)}
                </span>
              </div>
            </div>
          ) : hasScore ? (
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-black leading-none tabular-nums sm:text-7xl" style={{ color: theme.text }}>
                {achievement.score}
              </span>
              <span className="text-3xl font-bold leading-none sm:text-4xl" style={{ color: theme.accent }}>
                / {achievement.totalScore}
              </span>
            </div>
          ) : (
            <div
              className="grid size-20 place-items-center rounded-full shadow-lg"
              style={{ background: theme.accent }}
            >
              <svg viewBox="0 0 24 24" className="size-10 text-white" fill="currentColor">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </div>
          )}
        </div>

        {/* Score label */}
        {!isCertificate && (hasPercent || hasRank || hasScore) && (
          <p className="mt-3 text-sm font-bold tracking-[0.4em] sm:text-base" style={{ color: theme.textSecondary }}>
            {hasRank
              ? achievement.totalParticipants
                ? `RANK OF ${achievement.totalParticipants}`
                : "RANK"
              : hasScore
                ? "POINTS"
                : "SCORE"}
          </p>
        )}

        {/* AWARDED TO */}
        <p className="mt-8 text-xs tracking-wider sm:text-sm" style={{ color: theme.textMuted }}>
          AWARDED TO
        </p>

        {/* Participant name */}
        <p className="mt-1 text-center text-2xl font-extrabold leading-tight sm:text-3xl" style={{ color: theme.text }}>
          {achievement.participantName}
        </p>

        {/* Event name */}
        <p className="mt-2 text-center text-base font-semibold sm:text-lg" style={{ color: theme.textSecondary }}>
          {eventName}
        </p>

        {/* Date */}
        <p className="mt-1 text-sm sm:text-base" style={{ color: theme.textMuted }}>
          {dateStr}
        </p>
      </div>

      {/* ═══ FOOTER (curved) ═══ */}
      <div
        className="relative flex items-end justify-between px-8 pb-6 pt-8"
        style={{
          background: theme.footerColor,
          borderTopLeftRadius: "32px",
          borderTopRightRadius: "32px",
        }}
      >
        {/* Serial + Powered by */}
        <div className="flex flex-col">
          <p className="text-[9px] tracking-wider sm:text-[10px]" style={{ color: theme.textMuted }}>VERIFY AT</p>
          <p className="mt-1 font-mono text-xs font-bold sm:text-sm" style={{ color: theme.text }}>{serial}</p>
          <p className="mt-2 text-[10px] sm:text-xs" style={{ color: theme.textMuted }}>Powered by Engagio</p>
        </div>
        {/* QR placeholder */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="grid size-14 place-items-center rounded-xl bg-white p-2 shadow-sm sm:size-16">
            <svg viewBox="0 0 24 24" className="size-8 sm:size-10" style={{ color: theme.text }} fill="currentColor">
              <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z" />
            </svg>
          </div>
          <p className="text-[8px] font-semibold tracking-wider sm:text-[9px]" style={{ color: theme.textMuted }}>
            SCAN TO VERIFY
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Confetti generator ────────────────────────────────────────────────────

interface ConfettiPiece {
  x: number
  y: number
  size: number
  color: string
  opacity: number
  isCircle: boolean
  isDiamond: boolean
}

function generateConfetti(theme: CardTheme, count: number): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = []
  let seed = 42
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let i = 0; i < count; i++) {
    const shape = rand()
    pieces.push({
      x: Math.floor(rand() * 100),
      y: Math.floor(rand() * 70),
      size: 4 + Math.floor(rand() * 8),
      color: theme.confetti[i % theme.confetti.length],
      opacity: 0.3 + rand() * 0.5,
      isCircle: shape > 0.66,
      isDiamond: shape > 0.33 && shape <= 0.66,
    })
  }
  return pieces
}

// ─── 5 light color palettes ────────────────────────────────────────────────

interface CardTheme {
  bgFrom: string
  bgTo: string
  blobColor: string
  footerColor: string
  text: string
  textSecondary: string
  textMuted: string
  accent: string
  accentDark: string
  badgeBg: string
  badgeText: string
  confetti: string[]
}

const THEMES: Record<AchievementTemplateId, CardTheme> = {
  // 1. Mint/aqua (reference match)
  minimal: {
    bgFrom: "#e0f7f4", bgTo: "#a8d5da",
    blobColor: "#7bc4c9",
    footerColor: "#f5f9f8",
    text: "#1a3a3a", textSecondary: "#2c5f5f", textMuted: "#5a8585",
    accent: "#0d9488", accentDark: "#0f766e",
    badgeBg: "#8fb8b8", badgeText: "#1a4a4a",
    confetti: ["#f4d03f", "#00ced1", "#48d1cc", "#7bc4c9", "#ffffff"],
  },
  // 2. Emerald/mint
  modern: {
    bgFrom: "#d1fae5", bgTo: "#6ee7b7",
    blobColor: "#34d399",
    footerColor: "#f0fdf4",
    text: "#064e3b", textSecondary: "#047857", textMuted: "#059669",
    accent: "#059669", accentDark: "#047857",
    badgeBg: "#a7f3d0", badgeText: "#064e3b",
    confetti: ["#fbbf24", "#10b981", "#34d399", "#6ee7b7", "#ffffff"],
  },
  // 3. Amber/cream
  professional: {
    bgFrom: "#fef3c7", bgTo: "#fcd34d",
    blobColor: "#fbbf24",
    footerColor: "#fffbeb",
    text: "#78350f", textSecondary: "#92400e", textMuted: "#b45309",
    accent: "#d97706", accentDark: "#92400e",
    badgeBg: "#fde68a", badgeText: "#78350f",
    confetti: ["#f59e0b", "#fbbf24", "#fde68a", "#ffffff", "#d97706"],
  },
  // 4. Pink/rose
  celebration: {
    bgFrom: "#fce7f3", bgTo: "#f9a8d4",
    blobColor: "#f472b6",
    footerColor: "#fdf2f8",
    text: "#831843", textSecondary: "#9d174d", textMuted: "#be185d",
    accent: "#db2777", accentDark: "#9d174d",
    badgeBg: "#fbcfe8", badgeText: "#831843",
    confetti: ["#ec4899", "#f472b6", "#f9a8d4", "#ffffff", "#fbbf24"],
  },
  // 5. Teal/sky
  conference: {
    bgFrom: "#ccfbf1", bgTo: "#5eead4",
    blobColor: "#2dd4bf",
    footerColor: "#f0fdfa",
    text: "#134e4a", textSecondary: "#0f766e", textMuted: "#0d9488",
    accent: "#0d9488", accentDark: "#0f766e",
    badgeBg: "#99f6e4", badgeText: "#134e4a",
    confetti: ["#14b8a6", "#2dd4bf", "#5eead4", "#ffffff", "#0d9488"],
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

function buildSerial(publicToken: string, orgName?: string): string {
  const orgCode = (orgName || "ENG")
    .replace(/[^A-Z]/gi, "")
    .toUpperCase()
    .slice(0, 3) || "ENG"
  const year = new Date().getFullYear()
  const hash = (publicToken || "default")
    .split("")
    .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffffff, 7)
    .toString(36)
    .toUpperCase()
    .padStart(6, "0")
    .slice(0, 6)
  return `${orgCode}-${year}-${hash}`
}
