"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import { format, parseISO } from "date-fns"
import {
  Building2,
  CreditCard,
  LineChart as LineChartIcon,
  TrendingDown,
  Users,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { formatCurrency, formatNumber } from "@/lib/i18n"

type Range = "30d" | "90d" | "12m"

interface GrowthPoint {
  date: string
  newOrgs: number
  newUsers: number
  newSubs: number
}

interface MrrPoint {
  date: string
  mrr: number
}

interface RevenueByPlan {
  planId: string
  plan: string
  planDisplayName: string
  count: number
  mrr: number
}

interface AnalyticsPayload {
  range: Range
  growth: GrowthPoint[]
  mrr: MrrPoint[]
  churn: { rate: number; churnedThisMonth: number; activeAtStart: number }
  revenueByPlan: RevenueByPlan[]
}

const growthConfig: ChartConfig = {
  newOrgs: { label: "New Orgs", color: "#10b981" },
  newUsers: { label: "New Users", color: "#14b8a6" },
  newSubs: { label: "New Subs", color: "#f59e0b" },
}

const mrrConfig: ChartConfig = {
  mrr: { label: "MRR", color: "#10b981" },
}

const revenueConfig: ChartConfig = {
  mrr: { label: "MRR", color: "#14b8a6" },
}

function fmtAxisDate(date: string, monthly: boolean): string {
  try {
    const d = parseISO(date)
    return monthly ? format(d, "MMM yy") : format(d, "MMM d")
  } catch {
    return date
  }
}

// Compact currency for Y axis ticks (e.g. ₹249k, ₹1.2L).
function compactCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${Math.round(value / 1000)}k`
  return `₹${value}`
}

export function PlatformAnalytics() {
  const [range, setRange] = React.useState<Range>("30d")
  const monthly = range === "12m"

  const { data, isLoading, isError } = useQuery<AnalyticsPayload>({
    queryKey: ["platform-analytics", range],
    queryFn: async () => {
      const res = await fetch(`/api/platform/analytics?range=${range}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<AnalyticsPayload>
    },
  })

  // Pre-format date strings for display so we don't re-parse on every render
  const growthData = React.useMemo(() => {
    if (!data?.growth) return []
    return data.growth.map((g) => ({ ...g, label: fmtAxisDate(g.date, monthly) }))
  }, [data, monthly])

  const mrrData = React.useMemo(() => {
    if (!data?.mrr) return []
    return data.mrr.map((m) => ({ ...m, label: fmtAxisDate(m.date, true) }))
  }, [data])

  const revenueData = React.useMemo(() => {
    if (!data?.revenueByPlan) return []
    return data.revenueByPlan.map((r) => ({
      label: r.planDisplayName || r.plan,
      mrr: r.mrr,
      count: r.count,
    }))
  }, [data])

  const totalNewOrgs = data?.growth?.reduce((s, g) => s + g.newOrgs, 0) ?? 0
  const totalNewUsers = data?.growth?.reduce((s, g) => s + g.newUsers, 0) ?? 0
  const currentMrr = data?.mrr?.length ? data.mrr[data.mrr.length - 1].mrr : 0
  const mrrRangeMonths = range === "30d" ? 3 : range === "90d" ? 6 : 12

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Time-series growth, MRR trend, churn rate, and revenue by plan.
          </p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            <TabsTrigger value="30d">30 days</TabsTrigger>
            <TabsTrigger value="90d">90 days</TabsTrigger>
            <TabsTrigger value="12m">12 months</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isError ? (
        <Card className="border-rose-200 dark:border-rose-500/30">
          <CardContent className="pt-6">
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Failed to load analytics. Please try again.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <AnalyticsSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Churn + headline numbers */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ChurnCard churn={data?.churn} />
            <HeadlineCard
              icon={Building2}
              label={`New Orgs (${range === "12m" ? "12mo" : range})`}
              value={formatNumber(totalNewOrgs)}
              tone="emerald"
            />
            <HeadlineCard
              icon={Users}
              label={`New Users (${range === "12m" ? "12mo" : range})`}
              value={formatNumber(totalNewUsers)}
              tone="teal"
            />
            <HeadlineCard
              icon={CreditCard}
              label="Current MRR"
              value={formatCurrency(currentMrr, "INR")}
              tone="amber"
            />
          </div>

          {/* Growth chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LineChartIcon className="size-4 text-emerald-600" />
                Growth — New Organizations & Users
              </CardTitle>
              <CardDescription>
                {monthly ? "Per month" : "Per day"} · last{" "}
                {range === "12m" ? "12 months" : range === "30d" ? "30 days" : "90 days"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                {growthData.length === 0 ||
                growthData.every((d) => d.newOrgs === 0 && d.newUsers === 0 && d.newSubs === 0) ? (
                  <EmptyChart label="No new organizations or users in this range." />
                ) : (
                  <ChartContainer config={growthConfig} className="h-full w-full">
                    <LineChart data={growthData} margin={{ left: 4, right: 12, top: 5, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        minTickGap={24}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        width={36}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line
                        type="monotone"
                        dataKey="newOrgs"
                        stroke="var(--color-newOrgs)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="newUsers"
                        stroke="var(--color-newUsers)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* MRR + Revenue by Plan side by side */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="size-4 text-emerald-600" />
                  Monthly Recurring Revenue
                </CardTitle>
                <CardDescription>
                  Sum of active subscription plan prices · last {mrrRangeMonths} months
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  {mrrData.length === 0 || mrrData.every((d) => d.mrr === 0) ? (
                    <EmptyChart label="No MRR data yet." />
                  ) : (
                    <ChartContainer config={mrrConfig} className="h-full w-full">
                      <AreaChart data={mrrData} margin={{ left: 4, right: 12, top: 5, bottom: 0 }}>
                        <defs>
                          <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-mrr)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--color-mrr)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                          width={48}
                          tickFormatter={(v: number) => compactCurrency(Number(v))}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) => (
                                <span className="font-mono font-medium tabular-nums">
                                  {formatCurrency(Number(value), "INR")}
                                </span>
                              )}
                            />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="mrr"
                          stroke="var(--color-mrr)"
                          strokeWidth={2}
                          fill="url(#mrrGrad)"
                          dot={false}
                        />
                      </AreaChart>
                    </ChartContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="size-4 text-teal-600" />
                  Revenue by Plan
                </CardTitle>
                <CardDescription>Current MRR contribution per plan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  {revenueData.length === 0 ? (
                    <EmptyChart label="No active paid subscriptions yet." />
                  ) : (
                    <ChartContainer config={revenueConfig} className="h-full w-full">
                      <BarChart data={revenueData} margin={{ left: 4, right: 12, top: 5, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                          width={48}
                          tickFormatter={(v: number) => compactCurrency(Number(v))}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) => (
                                <span className="font-mono font-medium tabular-nums">
                                  {formatCurrency(Number(value), "INR")}
                                </span>
                              )}
                            />
                          }
                        />
                        <Bar dataKey="mrr" fill="var(--color-mrr)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue by plan breakdown table */}
          {revenueData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription Breakdown</CardTitle>
                <CardDescription>Active subscriptions grouped by plan</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40">
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Plan</th>
                        <th className="px-4 py-2.5 text-right font-medium">Active Subs</th>
                        <th className="px-4 py-2.5 text-right font-medium">Monthly Revenue</th>
                        <th className="px-4 py-2.5 text-right font-medium">% of MRR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data?.revenueByPlan.map((p) => {
                        const pct = currentMrr > 0 ? (p.mrr / currentMrr) * 100 : 0
                        return (
                          <tr key={p.planId} className="hover:bg-muted/30">
                            <td className="px-4 py-2.5 font-medium">{p.planDisplayName}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {formatNumber(p.count)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                              {formatCurrency(p.mrr, "INR")}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-xs",
                                  pct >= 50
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {pct.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {data?.revenueByPlan.length ? (
                      <tfoot className="border-t bg-muted/40">
                        <tr className="font-semibold">
                          <td className="px-4 py-2.5">Total</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {formatNumber(
                              data?.revenueByPlan.reduce((s, p) => s + p.count, 0) ?? 0,
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                            {formatCurrency(currentMrr, "INR")}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">100.0%</td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function ChurnCard({ churn }: { churn?: AnalyticsPayload["churn"] }) {
  const rate = churn?.rate ?? 0
  const churned = churn?.churnedThisMonth ?? 0
  const active = churn?.activeAtStart ?? 0
  const tone =
    rate >= 8
      ? "text-rose-600 dark:text-rose-400"
      : rate >= 4
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400"
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <TrendingDown className="size-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Churn Rate (this month)</p>
            <p className={cn("text-2xl font-bold", tone)}>{rate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">
              {churned} churned / {active} active at start
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function HeadlineCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  tone: "emerald" | "teal" | "amber"
}) {
  const toneMap: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    teal: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  }
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex size-10 items-center justify-center rounded-lg", toneMap[tone])}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed">
      <p className="px-6 text-center text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[360px] rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[340px] rounded-xl" />
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
    </div>
  )
}
