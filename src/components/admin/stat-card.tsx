"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { TrendingUp, TrendingDown } from "lucide-react"

import { cn } from "@/lib/utils"

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  hint?: string
  trend?: { value: number; positive?: boolean }
  className?: string
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 tabular-nums">
            {value}
          </p>
          {hint && (
            <p className="mt-1 text-xs text-muted-foreground truncate">{hint}</p>
          )}
        </div>
        <div className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 ring-1 ring-emerald-100 dark:ring-emerald-500/20">
          <Icon className="size-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {trend.positive ? (
            <TrendingUp className="size-3.5 text-emerald-600" />
          ) : (
            <TrendingDown className="size-3.5 text-rose-500" />
          )}
          <span
            className={cn(
              "font-medium",
              trend.positive ? "text-emerald-600" : "text-rose-500"
            )}
          >
            {trend.value > 0 ? "+" : ""}
            {trend.value}%
          </span>
          <span className="text-muted-foreground">vs last period</span>
        </div>
      )}
    </div>
  )
}
