'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  HelpCircle,
  Mail,
  Sparkles,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/i18n'
import type { ViewName } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────

interface CurrencyDto {
  code: string
  symbol: string
  name: string
}

interface PlanLimitsDto {
  max_events?: number
  max_participants_per_event?: number
  max_members?: number
  max_storage_bytes?: number
  max_custom_domains?: number
  max_assessments?: number
  customBranding?: boolean
  certificates?: boolean
  aiProctor?: boolean
  advancedSecurity?: boolean
  advancedAnalytics?: boolean
  customDomain?: boolean
  removeEngagioBranding?: boolean
  prioritySupport?: boolean
  [key: string]: unknown
}

interface PlanPriceDto {
  currency: string
  monthlyAmount: number
  yearlyAmount: number
}

interface PlanDto {
  id: string
  name: string
  displayName: string
  limits: PlanLimitsDto
  prices: PlanPriceDto[]
  isFeatured?: boolean
}

interface PricingResponse {
  plans: PlanDto[]
  currencies: CurrencyDto[]
}

type BillingCycle = 'monthly' | 'yearly'

interface PricingSectionProps {
  /** Navigation callback for CTA buttons. */
  onNavigate?: (view: ViewName) => void
  /** When true, render with extra vertical padding (standalone page use). */
  standalone?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_CURRENCY = 'INR'

const CURRENCY_LABELS: Record<string, string> = {
  INR: '₹ INR',
  USD: '$ USD',
  EUR: '€ EUR',
  GBP: '£ GBP',
}

// Features included on every plan (the "All plans include" footer list).
const INCLUDED_EVERYWHERE: Array<{ icon: LucideIcon; label: string }> = [
  { icon: CheckCircle2, label: 'Unlimited participants per free event' },
  { icon: CheckCircle2, label: 'Auto-generated certificates with QR verification' },
  { icon: CheckCircle2, label: 'Live polls, Q&A, surveys, and live quizzes' },
  { icon: CheckCircle2, label: 'CSV question importer + question bank' },
  { icon: CheckCircle2, label: 'Public certificate verification page' },
  { icon: CheckCircle2, label: 'Anti-cheat: fullscreen, tab detection, watermark' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Build the bullet-point feature list shown on each plan card. */
function buildPlanFeatures(plan: PlanDto): Array<{ label: string; included: boolean }> {
  const L = plan.limits
  const fmt = (n: number | undefined, fallback = '—'): string =>
    typeof n === 'number' ? (n === -1 ? 'Unlimited' : n.toLocaleString('en-US')) : fallback

  return [
    {
      label: `${fmt(L.max_events)} events`,
      included: typeof L.max_events === 'number' ? L.max_events !== 0 : false,
    },
    {
      label: `${fmt(L.max_participants_per_event)} participants / event`,
      included:
        typeof L.max_participants_per_event === 'number'
          ? L.max_participants_per_event !== 0
          : false,
    },
    {
      label: `${fmt(L.max_members)} team members`,
      included: typeof L.max_members === 'number' ? L.max_members !== 0 : false,
    },
    {
      label: `${fmt(L.max_assessments)} assessments`,
      included: typeof L.max_assessments === 'number' ? L.max_assessments !== 0 : false,
    },
    {
      label: L.customDomain ? 'Custom domain' : 'No custom domain',
      included: !!L.customDomain,
    },
    {
      label: L.aiProctor ? 'AI proctoring' : 'No AI proctoring',
      included: !!L.aiProctor,
    },
    {
      label: L.advancedSecurity ? 'Advanced security suite' : 'Standard security',
      included: !!L.advancedSecurity,
    },
    {
      label: L.advancedAnalytics ? 'Advanced analytics' : 'Basic analytics',
      included: !!L.advancedAnalytics,
    },
    {
      label: L.customBranding ? 'Custom branding' : 'Engagio branding',
      included: !!L.customBranding,
    },
    {
      label: L.prioritySupport ? 'Priority support' : 'Community support',
      included: !!L.prioritySupport,
    },
  ]
}

/** Resolve the price for a plan in the given currency. */
function getPriceFor(
  plan: PlanDto,
  currency: string,
): { monthly: number; yearly: number } | null {
  const priceRow = plan.prices.find((p) => p.currency === currency)
  if (!priceRow) return null
  return { monthly: priceRow.monthlyAmount, yearly: priceRow.yearlyAmount }
}

// ─── Component ─────────────────────────────────────────────────────────────

export function PricingSection({ onNavigate, standalone = false }: PricingSectionProps) {
  const [currency, setCurrency] = React.useState<string>(DEFAULT_CURRENCY)
  const [cycle, setCycle] = React.useState<BillingCycle>('monthly')

  const { data, isLoading, isError } = useQuery<PricingResponse>({
    queryKey: ['pricing'],
    queryFn: async () => {
      const res = await fetch('/api/pricing')
      if (!res.ok) throw new Error(`Failed to load pricing (status ${res.status})`)
      return (await res.json()) as PricingResponse
    },
    staleTime: 5 * 60 * 1000,
  })

  // Keep the selected currency in the list of currencies returned by the API.
  React.useEffect(() => {
    if (!data?.currencies?.length) return
    if (!data.currencies.some((c) => c.code === currency)) {
      setCurrency(data.currencies[0]?.code ?? DEFAULT_CURRENCY)
    }
  }, [data?.currencies, currency])

  const currencies = data?.currencies ?? []
  const plans = data?.plans ?? []

  const handleCta = (plan: PlanDto) => {
    if (plan.name === 'ENTERPRISE') {
      // Enterprise → mailto is cleaner than a forced navigation.
      if (typeof window !== 'undefined') {
        window.open(
          'mailto:sales@engagio.app?subject=Engagio Enterprise inquiry',
          '_self',
        )
      }
      return
    }
    onNavigate?.('login')
  }

  const ctaLabel = (plan: PlanDto): string => {
    if (plan.name === 'FREE') return 'Get started'
    if (plan.name === 'ENTERPRISE') return 'Contact sales'
    return 'Choose plan'
  }

  return (
    <section
      id="pricing"
      className={cn(
        'relative overflow-hidden bg-background',
        standalone ? 'py-20 sm:py-24' : 'py-16 sm:py-24',
      )}
      aria-labelledby="pricing-heading"
    >
      {/* Background mesh — subtle emerald/teal orbs (no indigo/blue). */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/4 size-[28rem] rounded-full bg-emerald-400/10 blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 size-[24rem] rounded-full bg-teal-400/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <Sparkles className="size-3.5" />
            Pricing
          </span>
          <h2
            id="pricing-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Pricing that grows with your events
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Start free, upgrade when you need more. Every plan includes
            registration, live activities, quizzes, certificates, and verification.
          </p>
        </motion.div>

        {/* Controls: currency selector + billing toggle */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
          {/* Currency selector */}
          <div
            role="radiogroup"
            aria-label="Select currency"
            className="inline-flex rounded-full border border-border bg-muted/40 p-1"
          >
            {currencies.map((c) => {
              const active = c.code === currency
              return (
                <button
                  key={c.code}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCurrency(c.code)}
                  title={`${c.symbol} ${c.name}`}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:text-sm',
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {CURRENCY_LABELS[c.code] ?? `${c.symbol} ${c.code}`}
                </button>
              )
            })}
            {currencies.length === 0 && !isLoading && (
              <span className="px-3 py-1.5 text-xs text-muted-foreground">
                Currency unavailable
              </span>
            )}
          </div>

          {/* Billing toggle */}
          <div
            role="radiogroup"
            aria-label="Select billing cycle"
            className="inline-flex items-center rounded-full border border-border bg-muted/40 p-1"
          >
            <button
              role="radio"
              aria-checked={cycle === 'monthly'}
              onClick={() => setCycle('monthly')}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:text-sm',
                cycle === 'monthly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Monthly
            </button>
            <button
              role="radio"
              aria-checked={cycle === 'yearly'}
              onClick={() => setCycle('yearly')}
              className={cn(
                'relative rounded-full px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:text-sm',
                cycle === 'yearly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Annual
              <Badge
                variant="outline"
                className="ml-1.5 border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
              >
                Save 20%
              </Badge>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <PricingCardSkeleton key={i} featured={i === 2} />
            ))}

          {!isLoading &&
            plans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                currency={currency}
                cycle={cycle}
                featured={!!plan.isFeatured}
                ctaLabel={ctaLabel(plan)}
                onCta={() => handleCta(plan)}
              />
            ))}

          {!isLoading && plans.length === 0 && !isError && (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No plans configured yet. Please check back later.
            </div>
          )}

          {isError && (
            <div className="col-span-full rounded-2xl border border-rose-500/40 bg-rose-500/5 p-8 text-center text-sm text-rose-700 dark:text-rose-400">
              Failed to load pricing. Please refresh the page or contact support.
            </div>
          )}
        </div>

        {/* "All plans include" footer */}
        <div className="mx-auto mt-14 max-w-4xl">
          <h3 className="text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            All plans include
          </h3>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {INCLUDED_EVERYWHERE.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5"
              >
                <item.icon className="size-4 shrink-0 text-emerald-600" />
                <span className="text-sm text-foreground">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Small print */}
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Prices shown in {currency}. Annual billing is charged yearly. Taxes may apply.
          Need a custom plan?{' '}
          <a
            href="mailto:sales@engagio.app"
            className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
          >
            Contact sales
          </a>
          .
        </p>
      </div>
    </section>
  )
}

// ─── PricingCard ────────────────────────────────────────────────────────────

interface PricingCardProps {
  plan: PlanDto
  currency: string
  cycle: BillingCycle
  featured: boolean
  ctaLabel: string
  onCta: () => void
}

function PricingCard({
  plan,
  currency,
  cycle,
  featured,
  ctaLabel,
  onCta,
}: PricingCardProps) {
  const features = React.useMemo(() => buildPlanFeatures(plan), [plan])
  const isFree = plan.name === 'FREE'
  const isEnterprise = plan.name === 'ENTERPRISE'

  // Resolve display price.
  const price = getPriceFor(plan, currency)
  const amount = cycle === 'monthly' ? price?.monthly : price?.yearly
  const cycleLabel = cycle === 'monthly' ? '/month' : '/year'

  // Render the price line:
  //   - Free plan: "Free"
  //   - Enterprise: "Custom"
  //   - Plan with no price for currency: "Contact us"
  //   - Otherwise: formatted currency + cycle
  let priceDisplay: React.ReactNode
  if (isFree) {
    priceDisplay = <span className="text-4xl font-bold text-foreground">Free</span>
  } else if (isEnterprise) {
    priceDisplay = <span className="text-4xl font-bold text-foreground">Custom</span>
  } else if (price && typeof amount === 'number' && amount > 0) {
    priceDisplay = (
      <>
        <span className="text-4xl font-bold tracking-tight text-foreground">
          {formatCurrency(amount, currency)}
        </span>
        <span className="ml-1 text-sm font-medium text-muted-foreground">{cycleLabel}</span>
      </>
    )
  } else {
    priceDisplay = (
      <span className="text-2xl font-semibold text-muted-foreground">Contact us</span>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className={cn('relative h-full', featured && 'lg:-mt-4 lg:mb-4')}
    >
      {featured && (
        <div className="absolute -inset-px -z-10 rounded-2xl bg-gradient-to-br from-emerald-500/40 to-teal-500/40 blur-sm" />
      )}
      <Card
        className={cn(
          'flex h-full flex-col gap-0 overflow-hidden py-0',
          featured
            ? 'border-emerald-500/60 shadow-xl shadow-emerald-500/10'
            : 'border-border',
        )}
      >
        {/* Featured ribbon */}
        {featured && (
          <div className="flex items-center justify-center bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
            <Sparkles className="mr-1.5 size-3.5" />
            Most popular
          </div>
        )}

        <CardContent className="flex h-full flex-col gap-5 p-6">
          {/* Plan name + description */}
          <div>
            <h3 className="text-lg font-semibold text-foreground">{plan.displayName}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {planDescription(plan.name)}
            </p>
          </div>

          {/* Price */}
          <div className="flex h-12 items-end gap-0.5">{priceDisplay}</div>

          {/* CTA */}
          <Button
            onClick={onCta}
            className={cn(
              'w-full',
              featured || isFree || isEnterprise
                ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white hover:from-emerald-600/95 hover:to-teal-500/95'
                : '',
            )}
            variant={featured || isFree || isEnterprise ? 'default' : 'outline'}
          >
            {isEnterprise ? (
              <Mail className="size-4" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            {ctaLabel}
          </Button>

          {/* Feature list */}
          <ul className="mt-2 space-y-2.5">
            {features.map((feature, idx) => (
              <li
                key={`${plan.id}-feature-${idx}`}
                className={cn(
                  'flex items-start gap-2 text-sm',
                  feature.included
                    ? 'text-foreground'
                    : 'text-muted-foreground line-through opacity-70',
                )}
              >
                {feature.included ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                )}
                <span>{feature.label}</span>
              </li>
            ))}
          </ul>

          {/* Plan icon watermark */}
          <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <PlanIcon name={plan.name} />
            <span>
              {isFree && 'No credit card required'}
              {isEnterprise && 'Volume discounts available'}
              {!isFree && !isEnterprise && 'Cancel anytime'}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────

function PricingCardSkeleton({ featured }: { featured?: boolean }) {
  return (
    <Card
      className={cn(
        'flex h-full flex-col gap-5 p-6',
        featured ? 'border-emerald-500/40' : 'border-border',
      )}
    >
      <div className="space-y-2">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-9 w-full" />
      <div className="space-y-2.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </Card>
  )
}

// ─── Plan metadata helpers ────────────────────────────────────────────────

function planDescription(name: string): string {
  switch (name) {
    case 'FREE':
      return 'For trying out Engagio with small events.'
    case 'STARTER':
      return 'For growing teams running regular events.'
    case 'PROFESSIONAL':
      return 'For organizations that need everything.'
    case 'ENTERPRISE':
      return 'For large-scale deployments with custom needs.'
    default:
      return ''
  }
}

function PlanIcon({ name }: { name: string }) {
  let Icon: LucideIcon = Zap
  switch (name) {
    case 'FREE':
      Icon = Zap
      break
    case 'STARTER':
      Icon = Sparkles
      break
    case 'PROFESSIONAL':
      Icon = Users
      break
    case 'ENTERPRISE':
      Icon = Building2
      break
  }
  return <Icon className="size-3.5 text-emerald-600" />
}

// Re-export the icon for callers that want to render a help link next to pricing.
export const PricingHelpIcon = HelpCircle
