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
 * Filled celebration-style achievement card.
 * BIG trophy + paper burst + confetti. No blank space.
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
      {/* Decorative blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full opacity-25"
        style={{ background: theme.blobColor }}
      />

      {/* Paper burst (radiating rays) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] size-64 -translate-x-1/2 -translate-y-1/2"
      >
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i / 16) * 360
          const length = i % 2 === 0 ? 100 : 80
          const width = i % 2 === 0 ? 14 : 10
          const color = i % 2 === 0 ? theme.burstColor : theme.burstColor2
          const opacity = i % 2 === 0 ? 0.25 : 0.15
          return (
            <div
              key={i}
              className="absolute left-1/2 top-0"
              style={{
                width: `${width}px`,
                height: `${length}px`,
                backgroundColor: color,
                opacity,
                transform: `rotate(${angle}deg)`,
                transformOrigin: "top center",
                clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
              }}
            />
          )
        })}
      </div>

      {/* Confetti */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {generateConfetti(theme, 50).map((c, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: `${c.size}px`,
              height: `${c.size}px`,
              backgroundColor: c.color,
              borderRadius: c.isCircle ? "50%" : "2px",
              opacity: c.opacity,
              transform: c.isDiamond ? "rotate(45deg)" : "none",
            }}
          />
        ))}
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="relative z-10 flex flex-1 flex-col items-center px-8 py-6">
        {/* Badge */}
        <div
          className="inline-flex items-center rounded-full px-7 py-2.5 text-xs font-bold tracking-[0.3em] sm:text-sm"
          style={{ background: theme.badgeBg, color: theme.badgeText }}
        >
          {isCertificate ? "CERTIFICATE OF COMPLETION" : achievement.type.replace(/_/g, " ")}
        </div>

        {/* BIG TROPHY 🏆 */}
        <div className="mt-4">
          <TrophyIcon theme={theme} size={100} />
        </div>

        {/* Hero metric */}
        <div className="mt-2 flex flex-col items-center">
          {isCertificate ? (
            <span className="text-4xl font-black" style={{ color: theme.text }}>COMPLETED</span>
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
            <div className="flex items-baseline gap-1">
              <span className="text-6xl font-black leading-none tabular-nums sm:text-7xl" style={{ color: theme.text }}>
                {achievement.rank}
              </span>
              <span className="text-3xl font-bold leading-none sm:text-4xl" style={{ color: theme.accent }}>
                {ordinalSuffix(achievement.rank as number)}
              </span>
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
            <span className="text-4xl font-black" style={{ color: theme.text }}>COMPLETED</span>
          )}
        </div>

        {/* Score label */}
        {!isCertificate && (hasPercent || hasRank || hasScore) && (
          <p className="mt-1 text-sm font-bold tracking-[0.3em] sm:text-base" style={{ color: theme.textSecondary }}>
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
        <p className="mt-6 text-xs tracking-wider sm:text-sm" style={{ color: theme.textMuted }}>
          AWARDED TO
        </p>

        {/* Participant name */}
        <p className="mt-1 text-center text-2xl font-extrabold leading-tight sm:text-3xl" style={{ color: theme.text }}>
          {achievement.participantName}
        </p>

        {/* Event name */}
        <p className="mt-1.5 text-center text-base font-semibold sm:text-lg" style={{ color: theme.textSecondary }}>
          {eventName}
        </p>

        {/* Date */}
        <p className="mt-1 text-sm sm:text-base" style={{ color: theme.textMuted }}>
          {dateStr}
        </p>
      </div>

      {/* ═══ FOOTER (curved) ═══ */}
      <div
        className="relative flex items-end justify-between px-8 pb-5 pt-6"
        style={{
          background: theme.footerColor,
          borderTopLeftRadius: "28px",
          borderTopRightRadius: "28px",
        }}
      >
        <div className="flex flex-col">
          <p className="text-[9px] tracking-wider sm:text-[10px]" style={{ color: theme.textMuted }}>VERIFY AT</p>
          <p className="mt-1 font-mono text-xs font-bold sm:text-sm" style={{ color: theme.text }}>{serial}</p>
          <p className="mt-1.5 text-[10px] sm:text-xs" style={{ color: theme.textMuted }}>Powered by Engagio</p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="grid size-12 place-items-center rounded-xl bg-white p-2 shadow-sm sm:size-14">
            <svg viewBox="0 0 24 24" className="size-7 sm:size-8" style={{ color: theme.text }} fill="currentColor">
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

// ─── Trophy icon component (SVG vector) ────────────────────────────────────

function TrophyIcon({ theme, size }: { theme: CardTheme; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Trophy cup */}
      <path
        d="M25 10 L75 10 L73 40 Q73 55 60 58 L58 72 L70 72 L70 82 L30 82 L30 72 L42 72 L40 58 Q27 55 27 40 Z"
        fill={theme.accent}
        stroke={theme.accentDark}
        strokeWidth="1"
      />
      {/* Left handle */}
      <path
        d="M15 15 L25 15 L25 30 Q25 40 18 40 Q11 40 11 30 Z"
        fill={theme.accent}
        stroke={theme.accentDark}
        strokeWidth="1"
      />
      {/* Right handle */}
      <path
        d="M75 15 L85 15 L89 30 Q89 40 82 40 Q75 40 75 30 Z"
        fill={theme.accent}
        stroke={theme.accentDark}
        strokeWidth="1"
      />
      {/* Base */}
      <rect x="25" y="82" width="50" height="8" fill={theme.accentDark} rx="2" />
      {/* Star */}
      <path
        d="M50 25 L53 33 L62 33 L55 38 L57 47 L50 42 L43 47 L45 38 L38 33 L47 33 Z"
        fill="#ffffff"
        opacity="0.9"
      />
    </svg>
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
    const angle = rand() * Math.PI * 2
    const distance = rand() * 40
    const centerX = 50
    const centerY = 42
    pieces.push({
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance * 0.7,
      size: 4 + Math.floor(rand() * 10),
      color: theme.confetti[i % theme.confetti.length],
      opacity: 0.4 + rand() * 0.5,
      isCircle: rand() > 0.5,
      isDiamond: rand() > 0.5 && rand() <= 0.8,
    })
  }
  return pieces
}

// ─── 5 color palettes ──────────────────────────────────────────────────────

interface CardTheme {
  bgFrom: string
  bgTo: string
  blobColor: string
  footerColor: string
  text: string
  textSecondary: string
  textMuted: string
  accent: string
  accentLight: string
  accentDark: string
  badgeBg: string
  badgeText: string
  burstColor: string
  burstColor2: string
  confetti: string[]
}

const THEMES: Record<AchievementTemplateId, CardTheme> = {
  minimal: {
    bgFrom: "#e0f7f4", bgTo: "#a8d5da",
    blobColor: "#7bc4c9", footerColor: "#f5f9f8",
    text: "#1a3a3a", textSecondary: "#2c5f5f", textMuted: "#5a8585",
    accent: "#0d9488", accentLight: "#5eead4", accentDark: "#0f766e",
    badgeBg: "#8fb8b8", badgeText: "#1a4a4a",
    burstColor: "#fbbf24", burstColor2: "#34d399",
    confetti: ["#f4d03f", "#00ced1", "#48d1cc", "#7bc4c9", "#ffffff", "#fbbf24"],
  },
  modern: {
    bgFrom: "#d1fae5", bgTo: "#6ee7b7",
    blobColor: "#34d399", footerColor: "#f0fdf4",
    text: "#064e3b", textSecondary: "#047857", textMuted: "#059669",
    accent: "#059669", accentLight: "#6ee7b7", accentDark: "#047857",
    badgeBg: "#a7f3d0", badgeText: "#064e3b",
    burstColor: "#fbbf24", burstColor2: "#34d399",
    confetti: ["#fbbf24", "#10b981", "#34d399", "#6ee7b7", "#ffffff", "#f59e0b"],
  },
  professional: {
    bgFrom: "#fef3c7", bgTo: "#fcd34d",
    blobColor: "#fbbf24", footerColor: "#fffbeb",
    text: "#78350f", textSecondary: "#92400e", textMuted: "#b45309",
    accent: "#d97706", accentLight: "#fde68a", accentDark: "#92400e",
    badgeBg: "#fde68a", badgeText: "#78350f",
    burstColor: "#f59e0b", burstColor2: "#fbbf24",
    confetti: ["#f59e0b", "#fbbf24", "#fde68a", "#ffffff", "#d97706", "#fcd34d"],
  },
  celebration: {
    bgFrom: "#fce7f3", bgTo: "#f9a8d4",
    blobColor: "#f472b6", footerColor: "#fdf2f8",
    text: "#831843", textSecondary: "#9d174d", textMuted: "#be185d",
    accent: "#db2777", accentLight: "#fbcfe8", accentDark: "#9d174d",
    badgeBg: "#fbcfe8", badgeText: "#831843",
    burstColor: "#fbbf24", burstColor2: "#f472b6",
    confetti: ["#ec4899", "#f472b6", "#f9a8d4", "#ffffff", "#fbbf24", "#a78bfa"],
  },
  conference: {
    bgFrom: "#ccfbf1", bgTo: "#5eead4",
    blobColor: "#2dd4bf", footerColor: "#f0fdfa",
    text: "#134e4a", textSecondary: "#0f766e", textMuted: "#0d9488",
    accent: "#0d9488", accentLight: "#5eead4", accentDark: "#0f766e",
    badgeBg: "#99f6e4", badgeText: "#134e4a",
    burstColor: "#fbbf24", burstColor2: "#2dd4bf",
    confetti: ["#14b8a6", "#2dd4bf", "#5eead4", "#ffffff", "#0d9488", "#fbbf24"],
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
