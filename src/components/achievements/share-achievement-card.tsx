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
 * Clean white certificate-style shareable achievement card — in-app preview.
 *
 * Design: White background, emerald accents, clean typography.
 * Matches the generated PNG card style.
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

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl bg-white text-slate-900 shadow-xl ring-1 ring-slate-200",
        className,
      )}
      style={{ aspectRatio: "4 / 5" }}
    >
      {/* Top accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: theme.accent }}
      />

      {/* Content */}
      <div className="relative flex h-full flex-col p-6 sm:p-8">
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between gap-3 pb-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="grid size-9 place-items-center rounded-xl shadow-sm sm:size-10"
              style={{ background: theme.accent }}
            >
              <svg viewBox="0 0 24 24" className="size-5 sm:size-6 text-white" fill="currentColor">
                <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
              </svg>
            </div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
              Engagio
            </span>
          </div>
          {/* Verified badge */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold sm:text-sm"
            style={{
              background: theme.accentBg,
              border: `1.5px solid ${theme.accent}`,
              color: theme.accentDark,
            }}
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Verified
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200" />

        {/* ═══ TYPE LABEL ═══ */}
        <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
          <p
            className="text-xs font-bold uppercase tracking-[0.3em] sm:text-sm"
            style={{ color: theme.accent }}
          >
            {meta.label}
          </p>
          <div
            className="mt-2 h-0.5 w-10 rounded-full"
            style={{ background: theme.accent }}
          />

          {/* ═══ HERO ═══ */}
          {isCertificate ? (
            <>
              <p className="mt-4 text-sm font-normal text-slate-400">This certifies that</p>
              <h2 className="mt-2 text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">
                {achievement.participantName}
              </h2>
              <p className="mt-2 text-sm font-normal italic text-slate-500">
                has successfully completed
              </p>
            </>
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

          {/* ═══ PARTICIPANT NAME (for non-certificate types) ═══ */}
          {!isCertificate && (
            <>
              <p className="mt-3 text-xs font-normal text-slate-400">Awarded to</p>
              <p className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                {achievement.participantName}
              </p>
            </>
          )}

          {/* ═══ TITLE ═══ */}
          <h3 className="mt-4 line-clamp-2 text-base font-bold leading-tight text-slate-900 sm:text-lg">
            {achievement.title}
          </h3>
          {achievement.subtitle && (
            <p className="mt-1 line-clamp-2 text-sm font-normal text-slate-500">
              {achievement.subtitle}
            </p>
          )}

          {/* ═══ DATE + ORG ═══ */}
          <p className="mt-3 text-xs font-normal text-slate-500">
            Issued on {dateStr}
          </p>
          {achievement.achievementData?.orgName && (
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {achievement.achievementData.orgName}
            </p>
          )}
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="border-t border-dashed border-slate-200 pt-4">
          <div className="flex items-end justify-between gap-3">
            {/* Serial number */}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {theme.label} No.
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold text-slate-900 sm:text-base">
                {serial}
              </p>
              <p className="mt-1 truncate font-mono text-[10px] text-slate-400">
                engagio.app/s/{serial.split("-").pop()}
              </p>
            </div>
            {/* QR placeholder */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div className="grid size-14 place-items-center rounded-lg bg-slate-50 ring-1 ring-slate-200 sm:size-16">
                <svg viewBox="0 0 24 24" className="size-7 text-slate-400 sm:size-8" fill="currentColor">
                  <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h8v8h-8v-8zm2 2v4h4v-4h-4z" />
                </svg>
              </div>
              <p className="text-[9px] font-semibold tracking-wider text-slate-400">
                SCAN TO VERIFY
              </p>
            </div>
          </div>
          {/* Powered by */}
          <p className="mt-3 text-center text-[10px] font-medium text-slate-400">
            Powered by Engagio
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Metric subcomponents ──────────────────────────────────────────────────

function MetricPercent({ value, theme }: { value: number; theme: ThemePalette }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-baseline gap-0.5">
        <span className="text-5xl font-black tabular-nums leading-none text-slate-900 sm:text-6xl">
          {value}
        </span>
        <span className="text-3xl font-bold leading-none sm:text-4xl" style={{ color: theme.accent }}>
          %
        </span>
      </div>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] sm:text-sm" style={{ color: theme.accent }}>
        Score
      </p>
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
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-baseline gap-1">
        <span className="text-5xl font-black tabular-nums leading-none text-slate-900 sm:text-6xl">
          {value}
        </span>
        <span className="text-2xl font-bold leading-none sm:text-3xl" style={{ color: theme.accent }}>
          {suffix}
        </span>
      </div>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] sm:text-sm" style={{ color: theme.accent }}>
        {total ? `Rank of ${total}` : "Rank"}
      </p>
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
    <div className="flex flex-col items-center">
      <div className="flex items-baseline gap-2">
        <span className="text-5xl font-black tabular-nums leading-none text-slate-900 sm:text-6xl">
          {score}
        </span>
        <span className="text-2xl font-bold leading-none sm:text-3xl" style={{ color: theme.accent }}>
          / {total}
        </span>
      </div>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] sm:text-sm" style={{ color: theme.accent }}>
        Points
      </p>
    </div>
  )
}

function MetricDefault({ theme }: { theme: ThemePalette }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="grid size-14 place-items-center rounded-full shadow-lg sm:size-16"
        style={{ background: theme.accent }}
      >
        <svg viewBox="0 0 24 24" className="size-7 text-white sm:size-8" fill="currentColor">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
        </svg>
      </div>
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] sm:text-sm" style={{ color: theme.accent }}>
        Completed
      </p>
    </div>
  )
}

// ─── Theme palettes ────────────────────────────────────────────────────────

interface ThemePalette {
  accent: string
  accentDark: string
  accentLight: string
  accentBg: string
  label: string
}

const THEMES: Record<AchievementTemplateId, ThemePalette> = {
  minimal: {
    accent: "#14b8a6",
    accentDark: "#0f766e",
    accentLight: "#14b8a6",
    accentBg: "#f0fdfa",
    label: "ACHIEVEMENT",
  },
  modern: {
    accent: "#10b981",
    accentDark: "#059669",
    accentLight: "#34d399",
    accentBg: "#ecfdf5",
    label: "ACHIEVEMENT",
  },
  professional: {
    accent: "#f59e0b",
    accentDark: "#d97706",
    accentLight: "#fbbf24",
    accentBg: "#fffbeb",
    label: "CERTIFICATE",
  },
  celebration: {
    accent: "#f59e0b",
    accentDark: "#d97706",
    accentLight: "#fbbf24",
    accentBg: "#fffbeb",
    label: "ACHIEVEMENT",
  },
  conference: {
    accent: "#14b8a6",
    accentDark: "#0f766e",
    accentLight: "#14b8a6",
    accentBg: "#f0fdfa",
    label: "ATTENDEE PASS",
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
