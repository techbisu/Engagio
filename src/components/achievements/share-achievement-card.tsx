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
>

export interface ShareAchievementCardProps {
  achievement: AchievementLike
  className?: string
}

/**
 * A presentational, in-app preview of an achievement card — designed to look
 * like a premium "digital token" / collectible.
 *
 * Renders a styled div (NOT the generated PNG). The visual style is driven
 * by the achievement's `templateId`. Mobile-first: aspect-ratio based so it
 * scales nicely on small screens AND looks great when screenshotted for
 * social sharing.
 *
 * Design principles:
 *   - BIG metric (percentage / rank / score) is the hero
 *   - Bold typography with clear hierarchy
 *   - Premium "token" aesthetic — gradient backgrounds, subtle patterns,
 *     glassmorphism accents
 *   - Readable at ALL sizes — from 320px mobile to 1200px social share
 */
export function ShareAchievementCard({
  achievement,
  className,
}: ShareAchievementCardProps) {
  const template = achievement.templateId ?? "modern"
  const meta = TYPE_META[achievement.type] ?? {
    label: achievement.type,
    emoji: "🎉",
  }

  const hasPercent =
    typeof achievement.percentage === "number" && achievement.percentage >= 0
  const hasRank = typeof achievement.rank === "number" && achievement.rank > 0
  const hasScore =
    typeof achievement.score === "number" &&
    typeof achievement.totalScore === "number"

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-3xl text-slate-900 shadow-2xl ring-1 ring-black/10",
        TEMPLATE_THEMES[template].wrapper,
        className,
      )}
      style={{ aspectRatio: "1 / 1" }}
    >
      {/* Decorative background layer */}
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0", TEMPLATE_THEMES[template].bg)}
      />
      {/* Premium dot-pattern overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, currentColor 1.5px, transparent 1.5px)",
          backgroundSize: "22px 22px",
        }}
      />
      {/* Top accent bar */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-1.5",
          TEMPLATE_THEMES[template].accentBar,
        )}
      />

      {/* Card content */}
      <div className="relative z-10 flex h-full flex-col p-6 sm:p-8">
        {/* Header row — brand + type chip */}
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] sm:text-sm",
              TEMPLATE_THEMES[template].brand,
            )}
          >
            <span className="grid size-6 place-items-center rounded-lg bg-emerald-500 text-white shadow-sm sm:size-7">
              <svg viewBox="0 0 24 24" className="size-3.5 sm:size-4" fill="currentColor" aria-hidden>
                <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
              </svg>
            </span>
            ENGAGIO
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide backdrop-blur sm:text-sm",
              TEMPLATE_THEMES[template].chip,
            )}
          >
            <span aria-hidden className="text-base sm:text-lg">{meta.emoji}</span>
            {meta.label}
          </div>
        </div>

        {/* BIG metric — the hero */}
        <div className="flex flex-1 flex-col items-center justify-center text-center py-4">
          {hasPercent ? (
            <MetricPercent value={achievement.percentage as number} template={template} />
          ) : hasRank ? (
            <MetricRank
              value={achievement.rank as number}
              total={achievement.totalParticipants ?? null}
              template={template}
            />
          ) : hasScore ? (
            <MetricScore
              score={achievement.score as number}
              total={achievement.totalScore as number}
              template={template}
            />
          ) : (
            <MetricDefault template={template} />
          )}
        </div>

        {/* Title + subtitle */}
        <div className="space-y-1.5 text-center">
          <h3
            className={cn(
              "line-clamp-2 font-bold leading-tight",
              "text-xl sm:text-2xl",
              TEMPLATE_THEMES[template].title,
            )}
          >
            {achievement.title}
          </h3>
          {achievement.subtitle && (
            <p
              className={cn(
                "line-clamp-2 text-sm font-medium sm:text-base",
                TEMPLATE_THEMES[template].subtitle,
              )}
            >
              {achievement.subtitle}
            </p>
          )}
        </div>

        {/* Participant name — prominent pill */}
        <div className="mt-5">
          <div
            className={cn(
              "flex items-center justify-center gap-3 rounded-2xl px-4 py-3",
              TEMPLATE_THEMES[template].namePill,
            )}
          >
            <div
              className={cn(
                "grid size-9 place-items-center rounded-full text-sm font-bold uppercase shadow-sm sm:size-10 sm:text-base",
                TEMPLATE_THEMES[template].avatar,
              )}
            >
              {(achievement.participantName || "?").slice(0, 1)}
            </div>
            <span
              className={cn(
                "text-base font-bold sm:text-lg",
                TEMPLATE_THEMES[template].name,
              )}
            >
              {achievement.participantName}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          className={cn(
            "mt-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider sm:text-xs",
            TEMPLATE_THEMES[template].footer,
          )}
        >
          <span className="truncate">{achievement.achievementData?.orgName ?? "Engagio"}</span>
          <span className="shrink-0">Powered by Engagio</span>
        </div>
      </div>
    </div>
  )
}

// ---- Metric subcomponents (BIGGER, more impactful) ----

function MetricPercent({
  value,
  template,
}: {
  value: number
  template: AchievementTemplateId
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-baseline justify-center gap-1">
        <span
          className={cn(
            "font-black tabular-nums leading-none",
            "text-7xl sm:text-8xl",
            TEMPLATE_THEMES[template].metric,
          )}
        >
          {value}
        </span>
        <span
          className={cn(
            "font-bold leading-none",
            "text-4xl sm:text-5xl",
            TEMPLATE_THEMES[template].metricUnit,
          )}
        >
          %
        </span>
      </div>
      <p
        className={cn(
          "mt-2 text-xs font-bold uppercase tracking-[0.25em] sm:text-sm",
          TEMPLATE_THEMES[template].metricLabel,
        )}
      >
        Final Score
      </p>
    </div>
  )
}

function MetricRank({
  value,
  total,
  template,
}: {
  value: number
  total: number | null
  template: AchievementTemplateId
}) {
  const suffix = ordinalSuffix(value)
  const medal = value === 1 ? "🥇" : value === 2 ? "🥈" : value === 3 ? "🥉" : "🏆"
  return (
    <div className="flex flex-col items-center">
      <div className="text-5xl sm:text-6xl" aria-hidden>
        {medal}
      </div>
      <div className="mt-2 flex items-baseline justify-center gap-1">
        <span
          className={cn(
            "font-black tabular-nums leading-none",
            "text-6xl sm:text-7xl",
            TEMPLATE_THEMES[template].metric,
          )}
        >
          {value}
        </span>
        <span
          className={cn(
            "font-bold leading-none",
            "text-3xl sm:text-4xl",
            TEMPLATE_THEMES[template].metricUnit,
          )}
        >
          {suffix}
        </span>
      </div>
      <p
        className={cn(
          "mt-2 text-xs font-bold uppercase tracking-[0.25em] sm:text-sm",
          TEMPLATE_THEMES[template].metricLabel,
        )}
      >
        {total ? `Rank of ${total}` : "Rank"}
      </p>
    </div>
  )
}

function MetricScore({
  score,
  total,
  template,
}: {
  score: number
  total: number
  template: AchievementTemplateId
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-baseline justify-center gap-2">
        <span
          className={cn(
            "font-black tabular-nums leading-none",
            "text-6xl sm:text-7xl",
            TEMPLATE_THEMES[template].metric,
          )}
        >
          {score}
        </span>
        <span
          className={cn(
            "font-bold leading-none",
            "text-3xl sm:text-4xl",
            TEMPLATE_THEMES[template].metricUnit,
          )}
        >
          / {total}
        </span>
      </div>
      <p
        className={cn(
          "mt-2 text-xs font-bold uppercase tracking-[0.25em] sm:text-sm",
          TEMPLATE_THEMES[template].metricLabel,
        )}
      >
        Points
      </p>
    </div>
  )
}

function MetricDefault({
  template,
}: {
  template: AchievementTemplateId
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "grid size-20 place-items-center rounded-full shadow-xl sm:size-24",
          TEMPLATE_THEMES[template].defaultBadge,
        )}
      >
        <svg viewBox="0 0 24 24" className="size-10 sm:size-12" fill="currentColor" aria-hidden>
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
        </svg>
      </div>
      <p
        className={cn(
          "mt-3 text-xs font-bold uppercase tracking-[0.25em] sm:text-sm",
          TEMPLATE_THEMES[template].metricLabel,
        )}
      >
        Completed
      </p>
    </div>
  )
}

// ---- Theme palettes per template ----
type ThemePalette = {
  wrapper: string
  bg: string
  accentBar: string
  brand: string
  chip: string
  metric: string
  metricUnit: string
  metricLabel: string
  title: string
  subtitle: string
  namePill: string
  avatar: string
  name: string
  footer: string
  defaultBadge: string
}

const TEMPLATE_THEMES: Record<AchievementTemplateId, ThemePalette> = {
  minimal: {
    wrapper: "bg-white",
    bg: "bg-white",
    accentBar: "bg-gradient-to-r from-emerald-500 to-teal-500",
    brand: "text-slate-500",
    chip: "bg-slate-100 text-slate-700",
    metric: "text-slate-900",
    metricUnit: "text-slate-500",
    metricLabel: "text-slate-400",
    title: "text-slate-900",
    subtitle: "text-slate-500",
    namePill: "bg-slate-50 ring-1 ring-slate-200",
    avatar: "bg-emerald-100 text-emerald-700",
    name: "text-slate-800",
    footer: "text-slate-400",
    defaultBadge: "bg-emerald-500 text-white",
  },
  modern: {
    wrapper:
      "bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950 text-slate-900 dark:text-white",
    bg: "bg-gradient-to-br from-emerald-500/15 via-transparent to-teal-500/15",
    accentBar: "bg-gradient-to-r from-emerald-500 to-teal-500",
    brand: "text-emerald-700 dark:text-emerald-300",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
    metric: "text-emerald-700 dark:text-emerald-300",
    metricUnit: "text-emerald-500",
    metricLabel: "text-emerald-700/70 dark:text-emerald-200/70",
    title: "text-slate-900 dark:text-white",
    subtitle: "text-slate-500 dark:text-slate-300",
    namePill:
      "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-600/20",
    avatar: "bg-white/20 text-white",
    name: "text-white",
    footer: "text-slate-400 dark:text-slate-500",
    defaultBadge: "bg-emerald-500 text-white",
  },
  professional: {
    wrapper:
      "bg-white text-slate-900 dark:bg-slate-900 dark:text-white ring-slate-200 dark:ring-slate-700",
    bg: "bg-gradient-to-br from-slate-100 to-transparent dark:from-slate-800 dark:to-transparent",
    accentBar: "bg-gradient-to-r from-amber-500 to-emerald-600",
    brand: "text-slate-500 dark:text-slate-300",
    chip: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
    metric: "text-slate-900 dark:text-white",
    metricUnit: "text-slate-500 dark:text-slate-300",
    metricLabel: "text-slate-400",
    title: "text-slate-900 dark:text-white",
    subtitle: "text-slate-500 dark:text-slate-300",
    namePill: "bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700",
    avatar: "bg-emerald-600 text-white",
    name: "text-slate-800 dark:text-slate-100",
    footer: "text-slate-400 dark:text-slate-500",
    defaultBadge: "bg-gradient-to-br from-amber-400 to-amber-600 text-white",
  },
  celebration: {
    wrapper:
      "bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 text-white",
    bg: "bg-gradient-to-tr from-amber-400/20 via-emerald-400/15 to-rose-400/15",
    accentBar: "bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-400",
    brand: "text-amber-300",
    chip: "bg-amber-500/25 text-amber-100",
    metric: "text-white",
    metricUnit: "text-amber-300",
    metricLabel: "text-amber-200/80",
    title: "text-white",
    subtitle: "text-slate-200",
    namePill: "bg-white/15 backdrop-blur ring-1 ring-white/20",
    avatar: "bg-amber-400 text-emerald-900",
    name: "text-white",
    footer: "text-emerald-200/70",
    defaultBadge: "bg-gradient-to-br from-amber-300 to-amber-600 text-white",
  },
  conference: {
    wrapper: "bg-white text-slate-900 dark:bg-slate-900 dark:text-white",
    bg: "bg-gradient-to-br from-emerald-600/10 via-transparent to-teal-600/10",
    accentBar: "bg-gradient-to-r from-slate-900 to-emerald-700",
    brand: "text-emerald-700 dark:text-emerald-300",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
    metric: "text-slate-900 dark:text-white",
    metricUnit: "text-slate-500 dark:text-slate-300",
    metricLabel: "text-slate-400",
    title: "text-slate-900 dark:text-white",
    subtitle: "text-slate-500 dark:text-slate-300",
    namePill: "bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-900",
    avatar: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
    name: "text-slate-800 dark:text-slate-100",
    footer: "text-slate-400 dark:text-slate-500",
    defaultBadge: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
  },
}

// ---- Utils ----

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
