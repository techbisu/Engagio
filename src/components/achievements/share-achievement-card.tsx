"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type {
  ShareableAchievementDto,
  PublicAchievementDto,
  AchievementTemplateId,
} from "@/types"
import { TYPE_META } from "./api"

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
 * Eye-catching social media shareable achievement card — in-app preview.
 * 5 styles: 3 dark + 2 light, with confetti/paper blast effects.
 * Bigger typography, better vertical distribution, no blank space.
 */
export function ShareAchievementCard({
  achievement,
  className,
}: ShareAchievementCardProps) {
  const template = achievement.templateId ?? "modern"
  const theme = THEMES[template] || THEMES.modern
  const meta = TYPE_META[achievement.type] ?? {
    label: achievement.type,
    emoji: "",
  }

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

  const eventName = achievement.subtitle || achievement.achievementData?.eventTitle || achievement.title

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-2xl shadow-2xl", className)}
      style={{
        aspectRatio: "4 / 5",
        background: theme.bg,
        color: theme.text,
      }}
    >
      {/* Decorative glowing circles */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 size-80 rounded-full opacity-50 blur-3xl"
        style={{ background: theme.accentGlow }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 size-72 rounded-full opacity-40 blur-3xl"
        style={{ background: theme.accentGlow }}
      />

      {/* Confetti / paper blast */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {generateConfetti(theme).map((c, i) => (
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
              transform: `rotate(${c.rotation}deg)`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col p-7 sm:p-9">
        {/* ═══ TYPE BADGE ═══ */}
        <div className="flex justify-center">
          <div
            className="inline-flex items-center rounded-full px-6 py-2.5 text-xs font-bold tracking-[0.3em] sm:text-sm"
            style={{
              background: theme.badgeBg,
              border: `1px solid ${theme.badgeBorder}`,
              color: theme.badgeText,
            }}
          >
            {isCertificate ? "CERTIFICATE OF COMPLETION" : meta.label}
          </div>
        </div>

        {/* ═══ HERO METRIC (BIGGER) ═══ */}
        <div className="mt-8 flex flex-col items-center">
          {isCertificate ? (
            <div
              className="grid size-20 place-items-center rounded-full shadow-lg sm:size-24"
              style={{ background: theme.accent }}
            >
              <svg viewBox="0 0 24 24" className="size-10 text-white sm:size-12" fill="currentColor">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </div>
          ) : hasPercent ? (
            <div className="flex items-baseline gap-0.5">
              <span className="text-8xl font-black leading-none tabular-nums sm:text-9xl">
                {achievement.percentage}
              </span>
              <span className="text-5xl font-bold leading-none sm:text-6xl" style={{ color: theme.accent }}>
                %
              </span>
            </div>
          ) : hasRank ? (
            <div className="flex flex-col items-center">
              <div className="mb-1 text-5xl sm:text-6xl">
                {achievement.rank === 1 ? "🥇" : achievement.rank === 2 ? "🥈" : achievement.rank === 3 ? "🥉" : "🏆"}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-7xl font-black leading-none tabular-nums sm:text-8xl">
                  {achievement.rank}
                </span>
                <span className="text-4xl font-bold leading-none sm:text-5xl" style={{ color: theme.accent }}>
                  {ordinalSuffix(achievement.rank as number)}
                </span>
              </div>
            </div>
          ) : hasScore ? (
            <div className="flex items-baseline gap-2">
              <span className="text-7xl font-black leading-none tabular-nums sm:text-8xl">
                {achievement.score}
              </span>
              <span className="text-4xl font-bold leading-none sm:text-5xl" style={{ color: theme.accent }}>
                / {achievement.totalScore}
              </span>
            </div>
          ) : (
            <div
              className="grid size-20 place-items-center rounded-full shadow-lg sm:size-24"
              style={{ background: theme.accent }}
            >
              <svg viewBox="0 0 24 24" className="size-10 text-white sm:size-12" fill="currentColor">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </div>
          )}
        </div>

        {/* ═══ SCORE LABEL ═══ */}
        {!isCertificate && (hasPercent || hasRank || hasScore) && (
          <p
            className="mt-4 text-center text-lg font-bold tracking-[0.4em] sm:text-xl"
            style={{ color: theme.accent }}
          >
            {hasRank
              ? achievement.totalParticipants
                ? `RANK OF ${achievement.totalParticipants}`
                : "RANK"
              : hasScore
                ? "POINTS"
                : "SCORE"}
          </p>
        )}

        {/* ═══ PARTICIPANT NAME (BIGGER) ═══ */}
        <div className="mt-8 flex flex-col items-center">
          <p className="mb-2 text-sm tracking-wider sm:text-base" style={{ color: theme.textMuted }}>
            {isCertificate ? "THIS CERTIFIES THAT" : "AWARDED TO"}
          </p>
          <p className="text-center text-3xl font-extrabold leading-tight sm:text-4xl">
            {achievement.participantName}
          </p>
        </div>

        {/* ═══ EVENT NAME (BIG, beautiful, with decorative line) ═══ */}
        <div className="mt-6 flex flex-col items-center">
          <div
            className="mb-3 h-1 w-14 rounded-full sm:w-16"
            style={{ background: theme.accent }}
          />
          <h3 className="text-center text-2xl font-extrabold leading-tight sm:text-3xl">
            {eventName}
          </h3>
        </div>

        {/* ═══ ACHIEVEMENT TITLE ═══ */}
        {achievement.title && achievement.title !== eventName && (
          <p className="mt-2 text-center text-base font-normal sm:text-lg" style={{ color: theme.textSecondary }}>
            {achievement.title}
          </p>
        )}

        {/* ═══ DATE + ORG (with divider) ═══ */}
        <div className="mt-5 flex flex-col items-center">
          <div className="mb-3 h-0.5 w-10" style={{ background: theme.divider }} />
          <p className="text-sm sm:text-base" style={{ color: theme.textMuted }}>{dateStr}</p>
          {achievement.achievementData?.orgName && (
            <p className="mt-1 text-base font-semibold sm:text-lg" style={{ color: theme.textSecondary }}>
              {achievement.achievementData.orgName}
            </p>
          )}
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-6">
          {/* Serial + Powered by */}
          <div className="flex flex-col">
            <p className="text-[10px] tracking-wider sm:text-xs" style={{ color: theme.textMuted }}>VERIFY AT</p>
            <p className="mt-1 font-mono text-base font-bold sm:text-lg" style={{ color: theme.textSecondary }}>{serial}</p>
            <p className="mt-2 text-xs sm:text-sm" style={{ color: theme.textMuted }}>Powered by Engagio</p>
          </div>
          {/* QR placeholder */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div
              className="grid size-16 place-items-center rounded-xl p-2.5 sm:size-20"
              style={{
                background: theme.isDark ? "rgba(255,255,255,0.08)" : theme.surface,
                border: `1px solid ${theme.badgeBorder}`,
              }}
            >
              <svg viewBox="0 0 24 24" className="size-8 sm:size-10" style={{ color: theme.textSecondary }} fill="currentColor">
                <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z" />
              </svg>
            </div>
            <p className="text-[9px] font-semibold tracking-wider sm:text-[10px]" style={{ color: theme.textMuted }}>
              SCAN TO VERIFY
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Confetti generator (deterministic) ────────────────────────────────────

interface ConfettiPiece {
  x: number
  y: number
  size: number
  color: string
  opacity: number
  rotation: number
  isCircle: boolean
}

function generateConfetti(theme: CardTheme): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = []
  let seed = 42
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let i = 0; i < theme.confettiCount; i++) {
    pieces.push({
      x: Math.floor(rand() * 100),
      y: Math.floor(rand() * 100),
      size: 4 + Math.floor(rand() * 10),
      color: theme.confettiColors[i % theme.confettiColors.length],
      opacity: 0.3 + rand() * 0.5,
      rotation: Math.floor(rand() * 360),
      isCircle: rand() > 0.5,
    })
  }
  return pieces
}

// ─── 5 Theme palettes ──────────────────────────────────────────────────────

interface CardTheme {
  isDark: boolean
  bg: string
  accent: string
  accentLight: string
  accentDark: string
  accentGlow: string
  surface: string
  text: string
  textSecondary: string
  textMuted: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  divider: string
  confettiColors: string[]
  confettiCount: number
}

const THEMES: Record<AchievementTemplateId, CardTheme> = {
  // 1. DARK — minimal slate
  minimal: {
    isDark: true,
    bg: "linear-gradient(160deg, #1e293b 0%, #0f172a 100%)",
    accent: "#14b8a6", accentLight: "#2dd4bf", accentDark: "#0f766e",
    accentGlow: "rgba(20,184,166,0.35)",
    surface: "#1e293b",
    text: "#ffffff", textSecondary: "#cbd5e1", textMuted: "#64748b",
    badgeBg: "rgba(20,184,166,0.15)", badgeText: "#5eead4", badgeBorder: "rgba(20,184,166,0.4)",
    divider: "rgba(255,255,255,0.1)",
    confettiColors: ["#14b8a6", "#2dd4bf", "#64748b"], confettiCount: 20,
  },
  // 2. DARK — modern emerald
  modern: {
    isDark: true,
    bg: "linear-gradient(160deg, #064e3b 0%, #0f172a 70%)",
    accent: "#10b981", accentLight: "#34d399", accentDark: "#059669",
    accentGlow: "rgba(16,185,129,0.4)",
    surface: "#0f172a",
    text: "#ffffff", textSecondary: "#d1fae5", textMuted: "#6b7280",
    badgeBg: "rgba(16,185,129,0.15)", badgeText: "#6ee7b7", badgeBorder: "rgba(16,185,129,0.4)",
    divider: "rgba(255,255,255,0.1)",
    confettiColors: ["#10b981", "#34d399", "#fbbf24", "#ffffff"], confettiCount: 35,
  },
  // 3. LIGHT — professional amber
  professional: {
    isDark: false,
    bg: "linear-gradient(160deg, #fffbeb 0%, #ffffff 50%)",
    accent: "#f59e0b", accentLight: "#fbbf24", accentDark: "#d97706",
    accentGlow: "rgba(245,158,11,0.2)",
    surface: "#ffffff",
    text: "#1f2937", textSecondary: "#4b5563", textMuted: "#9ca3af",
    badgeBg: "rgba(245,158,11,0.1)", badgeText: "#92400e", badgeBorder: "rgba(245,158,11,0.3)",
    divider: "#e5e7eb",
    confettiColors: ["#f59e0b", "#fbbf24", "#fde68a", "#d97706"], confettiCount: 25,
  },
  // 4. DARK — celebration gold (LOTS of confetti)
  celebration: {
    isDark: true,
    bg: "linear-gradient(160deg, #7c2d12 0%, #0f172a 60%)",
    accent: "#fbbf24", accentLight: "#fde68a", accentDark: "#d97706",
    accentGlow: "rgba(251,191,36,0.45)",
    surface: "#0f172a",
    text: "#ffffff", textSecondary: "#fef3c7", textMuted: "#92856a",
    badgeBg: "rgba(251,191,36,0.15)", badgeText: "#fef3c7", badgeBorder: "rgba(251,191,36,0.4)",
    divider: "rgba(255,255,255,0.1)",
    confettiColors: ["#fbbf24", "#fde68a", "#f43f5e", "#10b981", "#ffffff", "#f59e0b"], confettiCount: 50,
  },
  // 5. LIGHT — conference teal
  conference: {
    isDark: false,
    bg: "linear-gradient(160deg, #f0fdfa 0%, #ffffff 50%)",
    accent: "#14b8a6", accentLight: "#2dd4bf", accentDark: "#0f766e",
    accentGlow: "rgba(20,184,166,0.2)",
    surface: "#ffffff",
    text: "#0f172a", textSecondary: "#334155", textMuted: "#94a3b8",
    badgeBg: "rgba(20,184,166,0.1)", badgeText: "#0f766e", badgeBorder: "rgba(20,184,166,0.3)",
    divider: "#e2e8f0",
    confettiColors: ["#14b8a6", "#2dd4bf", "#0f766e"], confettiCount: 15,
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
