"use client"

import * as React from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  AlertTriangle,
  Ban,
  BarChart3,
  Check,
  CreditCard,
  Crown,
  Globe,
  Loader2,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users as UsersIcon,
  X,
  Zap,
} from "lucide-react"
import { format, parseISO } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { api, type PlanName } from "./api"

// ─── Types ────────────────────────────────────────────────────────────────

interface UsageInfo {
  used: number
  limit: number // -1 = unlimited
  remaining: number // -1 = unlimited
  percentage: number // 0-100, or 0 if unlimited
}

interface BillingSummary {
  plan: {
    name: PlanName
    displayName: string
    priceMonthly: number
    priceYearly: number
  }
  subscription: {
    status: string
    currentPeriodEnd: string | null
  } | null
  usage: {
    events: UsageInfo
    members: UsageInfo
    assessments: UsageInfo
    custom_domains: UsageInfo
  }
  entitlements: {
    features: Record<string, boolean>
    limits: Record<string, unknown>
  }
  allPlans?: PlanSummaryDto[]
}

interface PlanSummaryDto {
  id: string
  name: PlanName
  displayName: string
  priceMonthly: number
  priceYearly: number
  limits: Record<string, unknown>
}

interface UpgradeResponse {
  success: boolean
  plan: PlanName
  subscription: { status: string; currentPeriodEnd: string | null }
  note: string
}

interface CancelResponse {
  success: boolean
  plan: PlanName
  note?: string
}

interface BillingDashboardProps {
  orgId: string
  /** Hide the page header (when embedded in settings tabs). */
  hideHeader?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────

const PLAN_ORDER: PlanName[] = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"];

interface UsageCardDef {
  key: keyof BillingSummary["usage"]
  label: string
  icon: typeof BarChart3
  hint: string
}

const USAGE_CARDS: UsageCardDef[] = [
  { key: "events", label: "Events", icon: Zap, hint: "Total events created" },
  { key: "members", label: "Members", icon: UsersIcon, hint: "Active members in your org" },
  { key: "assessments", label: "Assessments", icon: BarChart3, hint: "Quiz / assessment links" },
  { key: "custom_domains", label: "Custom Domains", icon: Globe, hint: "Verified custom domains" },
];

const FEATURE_LABELS: { key: string; label: string }[] = [
  { key: "custom_domain", label: "Custom Domain" },
  { key: "ai_proctor", label: "AI Proctor" },
  { key: "advanced_security", label: "Advanced Security" },
  { key: "advanced_analytics", label: "Advanced Analytics" },
  { key: "custom_branding", label: "Custom Branding" },
  { key: "remove_engagio_branding", label: "Remove Engagio Branding" },
  { key: "priority_support", label: "Priority Support" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatPrice(paise: number): string {
  if (paise === 0) return "Free";
  // Prices are stored in paise (₹1 = 100 paise).
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

function formatLimit(n: number): string {
  if (n === -1) return "Unlimited";
  return String(n);
}

function usageColor(pct: number, unlimited: boolean): string {
  if (unlimited) return "bg-emerald-500";
  if (pct >= 100) return "bg-rose-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

function usageTone(pct: number, unlimited: boolean): string {
  if (unlimited) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 100) return "text-rose-600 dark:text-rose-400";
  if (pct >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

// ─── Component ─────────────────────────────────────────────────────────────

export function BillingDashboard({ orgId, hideHeader = false }: BillingDashboardProps) {
  const queryClient = useQueryClient()
  const [upgradeTarget, setUpgradeTarget] = React.useState<PlanSummaryDto | null>(null)
  const [cancelOpen, setCancelOpen] = React.useState(false)

  const billingQuery = useQuery<BillingSummary>({
    queryKey: ["organizations", orgId, "billing"],
    queryFn: () => api<BillingSummary>(`/api/organizations/${orgId}/billing`),
    retry: 1,
    staleTime: 30_000,
  })

  const upgradeMutation = useMutation({
    mutationFn: (planName: PlanName) =>
      api<UpgradeResponse>(`/api/organizations/${orgId}/billing/upgrade`, {
        method: "POST",
        body: JSON.stringify({ planName }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "billing"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "domains"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "audit-log"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId] })
      toast.success("Plan upgraded", {
        description: `You are now on the ${data.plan} plan. ${data.note}`,
      })
      setUpgradeTarget(null)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to upgrade plan"
      toast.error("Could not upgrade plan", { description: msg })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () =>
      api<CancelResponse>(`/api/organizations/${orgId}/billing/cancel`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "billing"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "domains"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId, "audit-log"] })
      queryClient.invalidateQueries({ queryKey: ["organizations", orgId] })
      toast.success("Subscription cancelled", {
        description:
          data.note ??
          "Your organization has been reverted to the Free plan.",
      })
      setCancelOpen(false)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to cancel subscription"
      toast.error("Could not cancel subscription", { description: msg })
    },
  })

  if (billingQuery.isLoading) {
    return (
      <div className="space-y-4">
        {!hideHeader && <BillingDashboardHeader />}
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  const data = billingQuery.data
  if (!data) {
    return (
      <div className="space-y-4">
        {!hideHeader && <BillingDashboardHeader />}
        <Card>
          <CardContent className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-slate-500 dark:text-slate-400">
            <AlertTriangle className="size-4" />
            Could not load billing information. Please try again.
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentPlanName = data.plan.name
  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlanName)
  const allPlans = (data.allPlans ?? []).slice().sort((a, b) => {
    return PLAN_ORDER.indexOf(a.name) - PLAN_ORDER.indexOf(b.name)
  })

  const renewalDate = data.subscription?.currentPeriodEnd
    ? parseISO(data.subscription.currentPeriodEnd)
    : null

  return (
    <div className="space-y-5">
      {!hideHeader && <BillingDashboardHeader />}

      {/* ─── Current plan card ──────────────────────────────────────────────── */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute right-0 top-0 size-32 -translate-y-12 translate-x-12 rounded-full bg-emerald-500/10 blur-2xl" />
        <CardHeader className="relative">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Current plan</CardTitle>
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Sparkles className="size-3" />
                  {data.plan.displayName}
                </Badge>
              </div>
              <CardDescription>
                {data.subscription?.status === "ACTIVE"
                  ? "Your subscription is active."
                  : "You're on the free tier."}{" "}
                {renewalDate && (
                  <>
                    Renews on {format(renewalDate, "MMM d, yyyy")}.
                  </>
                )}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                {formatPrice(data.plan.priceMonthly)}
                <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                  /month
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                or {formatPrice(data.plan.priceYearly)}/year
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const el = document.getElementById("plans-comparison")
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
            >
              <Rocket className="size-3.5" />
              Upgrade plan
            </Button>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Demo mode — no real charges.
            </span>
          </div>

          {currentPlanName === "FREE" ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" />
              <p>
                You&apos;re on the Free plan. Pick a plan above to reactivate your
                subscription and unlock higher limits and premium features.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-900 dark:hover:bg-rose-950/40"
                onClick={() => setCancelOpen(true)}
              >
                <Ban className="size-3.5" />
                Cancel subscription
              </Button>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Cancelling reverts your organization to the Free plan.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Usage section ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Usage this period
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track resource consumption against your plan limits.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {USAGE_CARDS.map((def) => {
            const usage = data.usage[def.key]
            const unlimited = usage.limit === -1
            const pct = unlimited ? 0 : Math.min(100, usage.percentage)
            const Icon = def.icon
            return (
              <motion.div
                key={def.key}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <Icon className="size-3.5" />
                        {def.label}
                      </div>
                      {unlimited && (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Unlimited
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                        {usage.used}
                      </span>
                      <span className={cn("text-xs font-medium", usageTone(pct, unlimited))}>
                        {unlimited ? "used" : `/ ${formatLimit(usage.limit)}`}
                      </span>
                    </div>
                    {!unlimited && (
                      <div className="mt-3 space-y-1">
                        <Progress
                          value={pct}
                          className="h-1.5 bg-slate-100 dark:bg-slate-800"
                        />
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{pct}% used</span>
                          <span>
                            {usage.remaining > 0
                              ? `${usage.remaining} remaining`
                              : "Limit reached"}
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                      {def.hint}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ─── Plans comparison ───────────────────────────────────────────────── */}
      <section id="plans-comparison" className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Compare plans
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose a plan that fits your team. Upgrades take effect immediately.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {allPlans.map((plan) => {
            const isCurrent = plan.name === currentPlanName
            const planIndex = PLAN_ORDER.indexOf(plan.name)
            const isUpgrade = planIndex > currentPlanIndex
            const isDowngrade = planIndex < currentPlanIndex
            const isEnterprise = plan.name === "ENTERPRISE"
            const highlight = isCurrent
            const limits = plan.limits ?? {}

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex h-full flex-col overflow-hidden transition-all",
                  highlight &&
                    "border-emerald-300 ring-1 ring-emerald-400/40 dark:border-emerald-700 dark:ring-emerald-500/30",
                  !highlight && "hover:border-slate-300 dark:hover:border-slate-700"
                )}
              >
                {highlight && (
                  <div className="absolute inset-x-0 top-0 bg-emerald-500 px-3 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-white">
                    Current Plan
                  </div>
                )}
                <CardHeader className={cn(highlight && "pt-8")}>
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    {plan.name === "PROFESSIONAL" && <Sparkles className="size-3.5 text-emerald-500" />}
                    {plan.name === "ENTERPRISE" && <Crown className="size-3.5 text-amber-500" />}
                    {plan.displayName}
                  </CardTitle>
                  <CardDescription>
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-50">
                      {formatPrice(plan.priceMonthly)}
                    </span>
                    <span className="text-xs"> /month</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <PlanLimitRow
                      label="Events"
                      value={limits.max_events as number}
                    />
                    <PlanLimitRow
                      label="Members"
                      value={limits.max_members as number}
                    />
                    <PlanLimitRow
                      label="Assessments"
                      value={limits.max_assessments as number}
                    />
                    <PlanLimitRow
                      label="Custom domains"
                      value={limits.max_custom_domains as number}
                    />
                    <PlanLimitRow
                      label="Participants / event"
                      value={limits.max_participants_per_event as number}
                    />
                  </ul>

                  <div className="mt-auto pt-2">
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        <Check className="size-3.5" />
                        Current
                      </Button>
                    ) : isEnterprise ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          toast.info("Contact sales", {
                            description:
                              "Email hello@engagio.app to set up an Enterprise plan.",
                          })
                        }
                      >
                        <CreditCard className="size-3.5" />
                        Contact Sales
                      </Button>
                    ) : isUpgrade ? (
                      <Button
                        className="w-full"
                        onClick={() => setUpgradeTarget(plan)}
                      >
                        <Rocket className="size-3.5" />
                        Upgrade
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setUpgradeTarget(plan)}
                      >
                        Downgrade
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* ─── Entitlements ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Features included
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            What&apos;s available on your current plan.
          </p>
        </div>
        <Card>
          <CardContent className="grid grid-cols-1 gap-x-6 gap-y-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_LABELS.map((feat) => {
              const enabled = data.entitlements.features[feat.key] === true
              return (
                <div
                  key={feat.key}
                  className="flex items-center justify-between gap-2 py-1.5"
                >
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    {feat.label}
                  </span>
                  {enabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <Check className="size-3" />
                      Included
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                      <X className="size-3" />
                      Not included
                    </span>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </section>

      {/* ─── Upgrade confirmation dialog ──────────────────────────────────── */}
      <Dialog
        open={!!upgradeTarget}
        onOpenChange={(open) => !open && setUpgradeTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {upgradeTarget && PLAN_ORDER.indexOf(upgradeTarget.name) > currentPlanIndex ? (
                <Rocket className="size-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              )}
              {upgradeTarget
                ? PLAN_ORDER.indexOf(upgradeTarget.name) > currentPlanIndex
                  ? `Upgrade to ${upgradeTarget.displayName}?`
                  : `Switch to ${upgradeTarget.displayName}?`
                : ""}
            </DialogTitle>
            <DialogDescription>
              {upgradeTarget && (
                <>
                  You&apos;ll be switched from <strong>{data.plan.displayName}</strong>{" "}
                  to <strong>{upgradeTarget.displayName}</strong> ({formatPrice(upgradeTarget.priceMonthly)}/mo).
                  {upgradeTarget.priceMonthly === 0 &&
                    " You will not be charged — this is a demo upgrade."}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Demo upgrade</p>
                <p className="mt-0.5">
                  No payment will be processed — this flow is for testing.
                  Real payment integration coming soon.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setUpgradeTarget(null)}
              disabled={upgradeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={upgradeMutation.isPending || !upgradeTarget}
              onClick={() => {
                if (upgradeTarget) {
                  upgradeMutation.mutate(upgradeTarget.name)
                }
              }}
            >
              {upgradeMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel subscription confirmation ──────────────────────────── */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
              Cancel subscription?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cancelling your subscription will revert your organization to the
              Free plan at the end of the current billing period. Features
              above the Free plan limits will be disabled.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <div className="flex items-start gap-2">
              <Ban className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">This action cannot be undone</p>
                <p className="mt-0.5">
                  You can re-subscribe anytime by choosing a plan above, but
                  your current billing period will not be refunded.
                </p>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              Keep plan
            </AlertDialogCancel>
            <AlertDialogAction
              className="border-rose-600 bg-rose-600 text-white hover:bg-rose-700 dark:border-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500"
              disabled={cancelMutation.isPending}
              onClick={(e) => {
                e.preventDefault()
                cancelMutation.mutate()
              }}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Ban className="size-3.5" />
              )}
              Yes, cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────

function PlanLimitRow({ label, value }: { label: string; value: number | undefined }) {
  const display =
    value === undefined
      ? "—"
      : value === -1
      ? "Unlimited"
      : String(value)
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-700 dark:text-slate-200">
        {display}
      </span>
    </li>
  )
}

function BillingDashboardHeader() {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        <CreditCard className="size-5 text-emerald-600 dark:text-emerald-400" />
        Billing &amp; usage
      </h2>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        View your plan, track resource usage, and upgrade when you need more.
      </p>
    </div>
  )
}

export { BillingDashboardHeader }
