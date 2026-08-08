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
 * A presentational, in-app preview of an achievement card.
 *
 * Renders a styled div (NOT the generated PNG). The visual style is driven
 * by the achievement's `templateId`. Designed to look great when shared as
 * a screenshot on social media too.
 *
 * Mobile-first: aspect-ratio based so it scales nicely on small screens.
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

  // Big metric: prefer percentage (most shareable), then rank, then score.
  const hasPercent =
    typeof achievement.percentage === "number" && achievement.percentage >= 0
  const hasRank = typeof achievement.rank === "number" && achievement.rank > 0
  const hasScore =
    typeof achievement.score === "number" &&
    typeof achievement.totalScore === "number"

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl text-slate-900 shadow-xl ring-1 ring-black/5",
        TEMPLATE_THEMES[template].wrapper,
        className,
      )}
    >
      {/* Decorative background layer */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0",
          TEMPLATE_THEMES[template].bg,
        )}
      />
      {/* Pattern overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, currentColor 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />

      {/* Card content */}
      <div className="relative z-10 flex flex-col gap-4 p-5 sm:gap-6 sm:p-7">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div
            className={cn(
              "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] sm:text-xs",
              TEMPLATE_THEMES[template].brand,
            )}
          >
            <span className="grid size-5 place-items-center rounded-md bg-emerald-500 text-white shadow-sm">
              <svg
                viewBox="0 0 24 24"
                className="size-3"
                fill="currentColor"
                aria-hidden
              >
                <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
              </svg>
            </span>
            ENGAGIO
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide backdrop-blur sm:text-xs",
              TEMPLATE_THEMES[template].chip,
            )}
          >
            <span aria-hidden>{meta.emoji}</span>
            {meta.label}
          </div>
        </div>

        {/* Big metric */}
        <div className="flex flex-col items-center text-center">
          {hasPercent ? (
            <MetricPercent
              value={achievement.percentage as number}
              template={template}
            />
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
        <div className="space-y-1 text-center">
          <h3
            className={cn(
              "line-clamp-2 font-bold leading-tight",
              "text-lg sm:text-xl",
              TEMPLATE_THEMES[template].title,
            )}
          >
            {achievement.title}
          </h3>
          {achievement.subtitle && (
            <p
              className={cn(
                "line-clamp-2 text-xs sm:text-sm",
                TEMPLATE_THEMES[template].subtitle,
              )}
            >
              {achievement.subtitle}
            </p>
          )}
        </div>

        {/* Participant row */}
        <div
          className={cn(
            "flex items-center justify-center gap-2 border-t pt-3",
            TEMPLATE_THEMES[template].divider,
          )}
        >
          <div className="grid size-7 place-items-center rounded-full bg-emerald-100 text-xs font-bold uppercase text-emerald-700">
            {(achievement.participantName || "?").slice(0, 1)}
          </div>
          <span
            className={cn(
              "text-xs font-medium sm:text-sm",
              TEMPLATE_THEMES[template].name,
            )}
          >
            {achievement.participantName}
          </span>
        </div>

        {/* Footer */}
        <div
          className={cn(
            "flex items-center justify-between text-[9px] uppercase tracking-wider sm:text-[10px]",
            TEMPLATE_THEMES[template].footer,
          )}
        >
          <span>{achievement.achievementData?.orgName ?? "Engagio"}</span>
          <span>Powered by Engagio</span>
        </div>
      </div>
    </div>
  )
}

// ---- Metric subcomponents ----

function MetricPercent({
  value,
  template,
}: {
  value: number
  template: AchievementTemplateId
}) {
  return (
    <>
      <div className="flex items-baseline justify-center gap-0.5">
        <span
          className={cn(
            "font-black tabular-nums leading-none",
            "text-5xl sm:text-6xl",
            TEMPLATE_THEMES[template].metric,
          )}
        >
          {value}
        </span>
        <span
          className={cn(
            "font-bold text-2xl sm:text-3xl",
            TEMPLATE_THEMES[template].metricUnit,
          )}
        >
          %
        </span>
      </div>
      <p
        className={cn(
          "mt-1 text-[10px] font-medium uppercase tracking-wider sm:text-xs",
          TEMPLATE_THEMES[template].metricLabel,
        )}
      >
        Score
      </p>
    </>
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
  return (
    <>
      <div className="flex items-baseline justify-center gap-1">
        <span
          className={cn(
            "font-black tabular-nums leading-none",
            "text-5xl sm:text-6xl",
            TEMPLATE_THEMES[template].metric,
          )}
        >
          {value}
          <span className="text-2xl sm:text-3xl">{suffix}</span>
        </span>
      </div>
      <p
        className={cn(
          "mt-1 text-[10px] font-medium uppercase tracking-wider sm:text-xs",
          TEMPLATE_THEMES[template].metricLabel,
        )}
      >
        {total ? `of ${total} participants` : "Rank"}
      </p>
    </>
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
    <>
      <div className="flex items-baseline justify-center gap-1">
        <span
          className={cn(
            "font-black tabular-nums leading-none",
            "text-5xl sm:text-6xl",
            TEMPLATE_THEMES[template].metric,
          )}
        >
          {score}
        </span>
        <span
          className={cn(
            "font-bold text-2xl sm:text-3xl",
            TEMPLATE_THEMES[template].metricUnit,
          )}
        >
          / {total}
        </span>
      </div>
      <p
        className={cn(
          "mt-1 text-[10px] font-medium uppercase tracking-wider sm:text-xs",
          TEMPLATE_THEMES[template].metricLabel,
        )}
      >
        Marks
      </p>
    </>
  )
}

function MetricDefault({
  template,
}: {
  template: AchievementTemplateId
}) {
  return (
    <div
      className={cn(
        "grid size-14 place-items-center rounded-full bg-emerald-500 text-white shadow-lg sm:size-16",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-7 sm:size-8"
        fill="currentColor"
        aria-hidden
      >
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
      </svg>
    </div>
  )
}

// ---- Theme palettes per template ----
type ThemePalette = {
  wrapper: string
  bg: string
  brand: string
  chip: string
  metric: string
  metricUnit: string
  metricLabel: string
  title: string
  subtitle: string
  divider: string
  name: string
  footer: string
}

const TEMPLATE_THEMES: Record<AchievementTemplateId, ThemePalette> = {
  minimal: {
    wrapper: "bg-white",
    bg: "bg-white",
    brand: "text-slate-500",
    chip: "bg-slate-100 text-slate-600",
    metric: "text-slate-900",
    metricUnit: "text-slate-500",
    metricLabel: "text-slate-400",
    title: "text-slate-900",
    subtitle: "text-slate-500",
    divider: "border-slate-100",
    name: "text-slate-700",
    footer: "text-slate-300",
  },
  modern: {
    wrapper:
      "bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950 text-slate-900 dark:text-white",
    bg: "bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10",
    brand: "text-emerald-700 dark:text-emerald-300",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
    metric: "text-emerald-700 dark:text-emerald-300",
    metricUnit: "text-emerald-500",
    metricLabel: "text-emerald-700/70 dark:text-emerald-200/70",
    title: "text-slate-900 dark:text-white",
    subtitle: "text-slate-500 dark:text-slate-300",
    divider: "border-emerald-500/15",
    name: "text-slate-700 dark:text-slate-200",
    footer: "text-slate-400 dark:text-slate-500",
  },
  professional: {
    wrapper:
      "bg-white text-slate-900 dark:bg-slate-900 dark:text-white ring-slate-200 dark:ring-slate-700",
    bg:
      "bg-gradient-to-br from-slate-100 to-transparent dark:from-slate-800 dark:to-transparent",
    brand: "text-slate-500 dark:text-slate-300",
    chip: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
    metric: "text-slate-900 dark:text-white",
    metricUnit: "text-slate-500 dark:text-slate-300",
    metricLabel: "text-slate-400",
    title: "text-slate-900 dark:text-white",
    subtitle: "text-slate-500 dark:text-slate-300",
    divider: "border-slate-200 dark:border-slate-700",
    name: "text-slate-700 dark:text-slate-200",
    footer: "text-slate-400 dark:text-slate-500",
  },
  celebration: {
    wrapper:
      "bg-gradient-to-br from-amber-50 via-emerald-50 to-rose-50 dark:from-amber-950 dark:via-emerald-950 dark:to-rose-950 text-slate-900 dark:text-white",
    bg: "bg-gradient-to-tr from-amber-400/15 via-emerald-400/15 to-rose-400/15",
    brand: "text-amber-700 dark:text-amber-300",
    chip: "bg-amber-500/20 text-amber-800 dark:text-amber-200",
    metric: "text-emerald-700 dark:text-emerald-300",
    metricUnit: "text-amber-600 dark:text-amber-300",
    metricLabel: "text-amber-700/70 dark:text-amber-200/70",
    title: "text-slate-900 dark:text-white",
    subtitle: "text-slate-500 dark:text-slate-300",
    divider: "border-amber-500/20",
    name: "text-slate-700 dark:text-slate-200",
    footer: "text-slate-400 dark:text-slate-500",
  },
  conference: {
    wrapper:
      "bg-slate-900 text-white ring-1 ring-white/10",
    bg: "bg-gradient-to-br from-emerald-600/30 via-transparent to-teal-600/30",
    brand: "text-emerald-300",
    chip: "bg-emerald-500/20 text-emerald-200",
    metric: "text-white",
    metricUnit: "text-emerald-300",
    metricLabel: "text-emerald-200/80",
    title: "text-white",
    subtitle: "text-slate-300",
    divider: "border-white/10",
    name: "text-slate-100",
    footer: "text-slate-400",
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
