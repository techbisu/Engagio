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
 *
 * Design: Gradient background, BIG typography, decorative glowing circles.
 * Optimized for social media sharing (LinkedIn, WhatsApp, Twitter).
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
      className={cn("relative w-full overflow-hidden rounded-2xl text-white shadow-2xl", className)}
      style={{
        aspectRatio: "4 / 5",
        background: `linear-gradient(135deg, ${theme.bgFrom} 0%, ${theme.bgTo} 100%)`,
      }}
    >
      {/* Decorative glowing circles */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 size-64 rounded-full opacity-40 blur-3xl"
        style={{ background: theme.accentGlow }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 size-56 rounded-full opacity-30 blur-3xl"
        style={{ background: theme.accentGlow }}
      />
      {/* Dot pattern overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, ${theme.accent}40 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col p-6 sm:p-8">
        {/* ═══ TYPE LABEL BADGE ═══ */}
        <div className="mb-6 flex justify-center">
          <div
            className="inline-flex items-center rounded-full px-5 py-2 text-xs font-bold tracking-wider sm:text-sm"
            style={{
              background: theme.badgeBg,
              border: `1px solid ${theme.accent}60`,
              color: theme.badgeText,
            }}
          >
            {isCertificate ? "CERTIFICATE OF COMPLETION" : meta.label}
          </div>
        </div>

        {/* ═══ HERO METRIC ═══ */}
        <div className="flex flex-col items-center justify-center">
          {isCertificate ? (
            <div
              className="grid size-16 place-items-center rounded-full shadow-lg sm:size-20"
              style={{ background: theme.accent }}
            >
              <svg viewBox="0 0 24 24" className="size-8 text-white sm:size-10" fill="currentColor">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </div>
          ) : hasPercent ? (
            <MetricPercent value={achievement.percentage as number} theme={theme} />
          ) : hasRank ? (
            <MetricRank
              value={achievement.rank as number}
              total={achievement.totalParticipants ?? null}
              theme={theme}
            />
          ) : hasScore ? (
            <MetricScore
              score={achievement.score as number}
              total={achievement.totalScore as number}
              theme={theme}
            />
          ) : (
            <MetricDefault theme={theme} />
          )}
        </div>

        {/* ═══ SCORE LABEL ═══ */}
        {!isCertificate && (hasPercent || hasRank || hasScore) && (
          <p
            className="mt-3 text-center text-sm font-bold tracking-[0.3em] sm:text-base"
            style={{ color: theme.accent }}
          >
            {hasRank ? (achievement.totalParticipants ? `RANK OF ${achievement.totalParticipants}` : "RANK") : "SCORE"}
          </p>
        )}

        {/* ═══ PARTICIPANT NAME ═══ */}
        <div className="mt-6 flex flex-col items-center">
          <p className="mb-2 text-xs tracking-wider text-white/50 sm:text-sm">
            {isCertificate ? "THIS CERTIFIES THAT" : "AWARDED TO"}
          </p>
          <p className="text-center text-2xl font-extrabold leading-tight sm:text-3xl">
            {achievement.participantName}
          </p>
        </div>

        {/* ═══ EVENT NAME (BIG, beautiful) ═══ */}
        <div className="mt-6 flex flex-col items-center">
          {/* Decorative line */}
          <div
            className="mb-4 h-0.5 w-12 rounded-full sm:w-16"
            style={{ background: theme.accent }}
          />
          <h3 className="text-center text-xl font-extrabold leading-tight sm:text-2xl">
            {eventName}
          </h3>
        </div>

        {/* ═══ ACHIEVEMENT TITLE (quiz/test name) ═══ */}
        {achievement.title && achievement.title !== eventName && (
          <p className="mt-2 text-center text-sm font-normal text-white/70 sm:text-base">
            {achievement.title}
          </p>
        )}

        {/* ═══ DATE + ORG ═══ */}
        <p className="mt-3 text-center text-sm text-white/50">{dateStr}</p>
        {achievement.achievementData?.orgName && (
          <p className="mt-1 text-center text-base font-semibold text-white/80">
            {achievement.achievementData.orgName}
          </p>
        )}

        {/* ═══ FOOTER ═══ */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-6">
          {/* Serial + Powered by */}
          <div className="flex flex-col">
            <p className="text-[9px] tracking-wider text-white/40 sm:text-[10px]">VERIFY AT</p>
            <p className="mt-1 font-mono text-sm font-bold text-white/80 sm:text-base">{serial}</p>
            <p className="mt-3 text-xs text-white/40 sm:text-sm">Powered by Engagio</p>
          </div>
          {/* QR placeholder */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div
              className="grid size-14 place-items-center rounded-xl p-2 sm:size-16"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: `1px solid ${theme.accent}40`,
              }}
            >
              <svg viewBox="0 0 24 24" className="size-7 text-white/70 sm:size-8" fill="currentColor">
                <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z" />
              </svg>
            </div>
            <p className="text-[8px] font-semibold tracking-wider text-white/50 sm:text-[9px]">
              SCAN TO VERIFY
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Metric subcomponents ──────────────────────────────────────────────────

function MetricPercent({ value, theme }: { value: number; theme: ThemePalette }) {
  return (
    <div className="flex items-baseline gap-0.5">
      <span className="text-7xl font-black tabular-nums leading-none sm:text-8xl">
        {value}
      </span>
      <span className="text-4xl font-bold leading-none sm:text-5xl" style={{ color: theme.accentLight }}>
        %
      </span>
    </div>
  )
}

function MetricRank({
  value,
  total,
  theme,
}: {
  value: number
  total: number | null
  theme: ThemePalette
}) {
  const suffix = ordinalSuffix(value)
  const medal = value === 1 ? "🥇" : value === 2 ? "🥈" : value === 3 ? "🥉" : "🏆"
  return (
    <div className="flex flex-col items-center">
      <div className="mb-1 text-4xl sm:text-5xl">{medal}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-6xl font-black tabular-nums leading-none sm:text-7xl">
          {value}
        </span>
        <span className="text-3xl font-bold leading-none sm:text-4xl" style={{ color: theme.accentLight }}>
          {suffix}
        </span>
      </div>
    </div>
  )
}

function MetricScore({
  score,
  total,
  theme,
}: {
  score: number
  total: number
  theme: ThemePalette
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-6xl font-black tabular-nums leading-none sm:text-7xl">
        {score}
      </span>
      <span className="text-3xl font-bold leading-none sm:text-4xl" style={{ color: theme.accentLight }}>
        / {total}
      </span>
    </div>
  )
}

function MetricDefault({ theme }: { theme: ThemePalette }) {
  return (
    <div
      className="grid size-16 place-items-center rounded-full shadow-lg sm:size-20"
      style={{ background: theme.accent }}
    >
      <svg viewBox="0 0 24 24" className="size-8 text-white sm:size-10" fill="currentColor">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
      </svg>
    </div>
  )
}

// ─── Theme palettes ────────────────────────────────────────────────────────

interface ThemePalette {
  bgFrom: string
  bgTo: string
  accent: string
  accentLight: string
  accentGlow: string
  badgeBg: string
  badgeText: string
}

const THEMES: Record<AchievementTemplateId, ThemePalette> = {
  minimal: {
    bgFrom: "#0f172a",
    bgTo: "#1e293b",
    accent: "#14b8a6",
    accentLight: "#2dd4bf",
    accentGlow: "rgba(20,184,166,0.4)",
    badgeBg: "rgba(20,184,166,0.2)",
    badgeText: "#5eead4",
  },
  modern: {
    bgFrom: "#064e3b",
    bgTo: "#0f172a",
    accent: "#10b981",
    accentLight: "#34d399",
    accentGlow: "rgba(16,185,129,0.4)",
    badgeBg: "rgba(16,185,129,0.2)",
    badgeText: "#6ee7b7",
  },
  professional: {
    bgFrom: "#78350f",
    bgTo: "#0f172a",
    accent: "#f59e0b",
    accentLight: "#fbbf24",
    accentGlow: "rgba(245,158,11,0.4)",
    badgeBg: "rgba(245,158,11,0.2)",
    badgeText: "#fcd34d",
  },
  celebration: {
    bgFrom: "#7c2d12",
    bgTo: "#0f172a",
    accent: "#fbbf24",
    accentLight: "#fde68a",
    accentGlow: "rgba(251,191,36,0.5)",
    badgeBg: "rgba(251,191,36,0.2)",
    badgeText: "#fef3c7",
  },
  conference: {
    bgFrom: "#134e4a",
    bgTo: "#0f172a",
    accent: "#14b8a6",
    accentLight: "#2dd4bf",
    accentGlow: "rgba(20,184,166,0.4)",
    badgeBg: "rgba(20,184,166,0.2)",
    badgeText: "#5eead4",
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
