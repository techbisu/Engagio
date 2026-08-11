"use client"

import * as React from "react"
import { motion } from "framer-motion"
import ReactMarkdown from "react-markdown"
import {
  CalendarDays,
  Clock,
  MapPin,
  Award,
  Users,
  Globe,
  TrendingUp,
  HelpCircle,
  ExternalLink,
  Megaphone,
  Image as ImageIcon,
  BarChart3,
  CalendarClock,
  PanelsTopLeft,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type {
  LandingSectionDto,
  HeroSectionData,
  AboutSectionData,
  SpeakersSectionData,
  ScheduleSectionData,
  SponsorsSectionData,
  SponsorItem,
  VenueSectionData,
  AgendaSectionData,
  FaqSectionData,
  GallerySectionData,
  CtaSectionData,
  StatsSectionData,
  StatItem,
  CustomSectionData,
} from "@/types"

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.45, ease: "easeOut" as const },
}

// ─── Public entry: render all sections ───────────────────────────────────────

export function LandingSectionsRenderer({
  sections,
}: {
  sections: LandingSectionDto[]
}) {
  if (!sections.length) return null
  return (
    <div className="space-y-0">
      {sections.map((section) => (
        <SectionHost key={section.id} section={section} />
      ))}
    </div>
  )
}

function SectionHost({ section }: { section: LandingSectionDto }) {
  // Each per-type view is defensive (handles missing data gracefully), so a
  // single bad section won't crash the whole landing page. We render the
  // appropriate view via a switch — no try/catch around JSX per eslint's
  // react-hooks/error-boundaries rule.
  switch (section.type) {
    case "HERO":
      return <HeroSectionView section={section} />
    case "ABOUT":
      return <AboutSectionView section={section} />
    case "SPEAKERS":
      return <SpeakersSectionView section={section} />
    case "SCHEDULE":
      return <ScheduleSectionView section={section} />
    case "SPONSORS":
      return <SponsorsSectionView section={section} />
    case "VENUE":
      return <VenueSectionView section={section} />
    case "AGENDA":
      return <AgendaSectionView section={section} />
    case "FAQ":
      return <FaqSectionView section={section} />
    case "GALLERY":
      return <GallerySectionView section={section} />
    case "CTA":
      return <CtaSectionView section={section} />
    case "STATS":
      return <StatsSectionView section={section} />
    case "CUSTOM":
      return <CustomSectionView section={section} />
    default:
      return null
  }
}

// ── Shared header for sections that have a title + subtitle ─────────────────
function SectionHeading({
  title,
  subtitle,
  align = "center",
}: {
  title: string | null
  subtitle: string | null
  align?: "center" | "left"
}) {
  if (!title && !subtitle) return null
  return (
    <div
      className={cn(
        "mb-6",
        align === "center" ? "text-center" : "text-left"
      )}
    >
      {title && (
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>
      )}
      {subtitle && (
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      )}
    </div>
  )
}

const sectionWrap = "mx-auto max-w-4xl w-full px-4 py-10 sm:px-6"

// ── HERO ──────────────────────────────────────────────────────────────────
function HeroSectionView({ section }: { section: LandingSectionDto }) {
  const data = (section.data ?? {}) as HeroSectionData
  const bg = data.backgroundImageUrl
  return (
    <section className="relative isolate overflow-hidden">
      {bg ? (
        <>
          <img
            src={bg}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 -z-10 size-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-900/70 via-slate-900/60 to-slate-900/70" />
        </>
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700" />
      )}
      <div
        className={cn(
          sectionWrap,
          "flex min-h-[280px] flex-col justify-center",
          bg ? "text-white" : "text-white"
        )}
      >
        <motion.div {...fadeUp} className="max-w-2xl">
          {section.subtitle && (
            <p className="mb-2 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wider backdrop-blur-sm">
              {section.subtitle}
            </p>
          )}
          <h1 className="text-3xl font-bold tracking-tight drop-shadow sm:text-5xl">
            {section.title}
          </h1>
          {data.buttonText && (
            <a
              href={data.buttonUrl || "#start"}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-emerald-50"
            >
              {data.buttonText}
              <ExternalLink className="size-4" />
            </a>
          )}
        </motion.div>
      </div>
    </section>
  )
}

// ── ABOUT ─────────────────────────────────────────────────────────────────
function AboutSectionView({ section }: { section: LandingSectionDto }) {
  const data = (section.data ?? {}) as AboutSectionData
  const body = data.body ?? ""
  return (
    <section className={sectionWrap}>
      <motion.div {...fadeUp}>
        <SectionHeading title={section.title} subtitle={section.subtitle} />
        {body && (
          <div className="prose prose-slate mx-auto max-w-2xl dark:prose-invert prose-headings:scroll-mt-20 prose-a:text-emerald-600 prose-strong:text-slate-900 dark:prose-strong:text-slate-100">
            <ReactMarkdown>{body}</ReactMarkdown>
          </div>
        )}
      </motion.div>
    </section>
  )
}

// ── SPEAKERS ──────────────────────────────────────────────────────────────
function SpeakersSectionView({ section }: { section: LandingSectionDto }) {
  const data = (section.data ?? {}) as SpeakersSectionData
  const speakers = data.speakers ?? []
  if (!speakers.length) return null
  return (
    <section className={cn(sectionWrap, "bg-slate-50 dark:bg-slate-900/40")}>
      <motion.div {...fadeUp}>
        <SectionHeading title={section.title} subtitle={section.subtitle} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {speakers.map((s, idx) => (
            <motion.div
              key={s.id ?? idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: idx * 0.06 }}
            >
              <Card className="h-full overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex aspect-[5/4] w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-300 dark:from-emerald-500/10 dark:to-teal-500/10 dark:text-emerald-700/40">
                  {s.avatarUrl ? (
                    <img
                      src={s.avatarUrl}
                      alt={s.name || "Speaker"}
                      className="size-full object-cover"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display = "none"
                      }}
                    />
                  ) : (
                    <Users className="size-12" />
                  )}
                </div>
                <CardContent className="space-y-1 p-4">
                  <h3 className="text-base font-semibold">{s.name || "Speaker"}</h3>
                  {(s.title || s.company) && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      {[s.title, s.company].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {s.bio && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-4">
                      {s.bio}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}

// ── SCHEDULE ───────────────────────────────────────────────────────────────
function ScheduleSectionView({ section }: { section: LandingSectionDto }) {
  const data = (section.data ?? {}) as ScheduleSectionData
  const items = data.items ?? []
  if (!items.length) return null
  return (
    <section className={sectionWrap}>
      <motion.div {...fadeUp}>
        <SectionHeading title={section.title} subtitle={section.subtitle} />
        <div className="relative">
          {/* Timeline rail */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-emerald-200 dark:bg-emerald-500/30" />
          <ol className="space-y-5">
            {items.map((it, idx) => (
              <li key={it.id ?? idx} className="relative pl-8">
                <span className="absolute left-0 top-1.5 size-3.5 rounded-full border-2 border-emerald-500 bg-white dark:bg-slate-900" />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  {(it.date || it.time) && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      {[it.date ? formatDateOnly(it.date) : null, it.time]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {it.track && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                      {it.track}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-base font-semibold leading-snug">
                  {it.title || "Untitled session"}
                </h3>
                {it.speakerName && (
                  <p className="text-sm text-muted-foreground">
                    Speaker: {it.speakerName}
                  </p>
                )}
                {it.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {it.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </motion.div>
    </section>
  )
}

function formatDateOnly(value?: string): string | null {
  if (!value) return null
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return value
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  } catch {
    return value
  }
}

// ── SPONSORS ──────────────────────────────────────────────────────────────
const TIER_META: Record<NonNullable<SponsorItem["tier"]>, { label: string; className: string }> = {
  gold: {
    label: "Gold sponsors",
    className: "ring-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  },
  silver: {
    label: "Silver sponsors",
    className: "ring-slate-300 bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-500/30",
  },
  bronze: {
    label: "Bronze sponsors",
    className: "ring-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/30",
  },
}

function SponsorsSectionView({ section }: { section: LandingSectionDto }) {
  const data = (section.data ?? {}) as SponsorsSectionData
  const sponsors = data.sponsors ?? []
  if (!sponsors.length) return null

  // Group by tier (gold → silver → bronze), then ungrouped.
  const tierOrder: NonNullable<SponsorItem["tier"]>[] = ["gold", "silver", "bronze"]
  const grouped = tierOrder.map((tier) => ({
    tier,
    items: sponsors.filter((s) => (s.tier ?? "silver") === tier),
  })).filter((g) => g.items.length > 0)
  const used = new Set(
    grouped.flatMap((g) => g.items.map((i) => i.id))
  )
  const ungrouped = sponsors.filter((s) => !used.has(s.id))

  return (
    <section className={cn(sectionWrap, "bg-slate-50 dark:bg-slate-900/40")}>
      <motion.div {...fadeUp}>
        <SectionHeading title={section.title} subtitle={section.subtitle} />
        {grouped.map((g) => (
          <div key={g.tier} className="mb-8 last:mb-0">
            <p
              className={cn(
                "mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ring-1",
                TIER_META[g.tier].className
              )}
            >
              <Award className="size-3.5" />
              {TIER_META[g.tier].label}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {g.items.map((s, idx) => (
                <SponsorCard key={s.id ?? idx} sponsor={s} />
              ))}
            </div>
          </div>
        ))}
        {ungrouped.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sponsors
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {ungrouped.map((s, idx) => (
                <SponsorCard key={s.id ?? idx} sponsor={s} />
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </section>
  )
}

function SponsorCard({ sponsor }: { sponsor: SponsorItem }) {
  const content = (
    <div className="flex h-28 flex-col items-center justify-center gap-2 rounded-lg border bg-white p-4 text-center transition hover:shadow-sm dark:bg-slate-900">
      {sponsor.logoUrl ? (
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          className="max-h-12 max-w-[80%] object-contain"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = "none"
          }}
        />
      ) : (
        <div className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
          <Award className="size-5" />
        </div>
      )}
      <p className="text-sm font-medium leading-tight">{sponsor.name}</p>
    </div>
  )
  if (sponsor.websiteUrl) {
    return (
      <a
        href={sponsor.websiteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {content}
      </a>
    )
  }
  return content
}

// ── VENUE ─────────────────────────────────────────────────────────────────
function VenueSectionView({ section }: { section: LandingSectionDto }) {
  const data = (section.data ?? {}) as VenueSectionData
  const hasContent =
    data.name || data.address || data.mapUrl || data.imageUrl || data.capacity
  if (!hasContent) return null
  return (
    <section className={sectionWrap}>
      <motion.div {...fadeUp}>
        <SectionHeading title={section.title} subtitle={section.subtitle} />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-xl bg-muted">
            {data.imageUrl ? (
              <img
                src={data.imageUrl}
                alt={data.name || "Venue"}
                className="size-full aspect-[4/3] object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = "none"
                }}
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-emerald-300 dark:text-emerald-700/40">
                <MapPin className="size-12" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {data.name && (
              <h3 className="text-xl font-semibold">{data.name}</h3>
            )}
            {data.address && (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span className="whitespace-pre-line">{data.address}</span>
              </p>
            )}
            {typeof data.capacity === "number" && data.capacity > 0 && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4 text-emerald-600" />
                Capacity: {data.capacity.toLocaleString()}
              </p>
            )}
            {data.mapUrl && (
              <a
                href={data.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-2 self-start rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <MapPin className="size-4" /> Open in Maps
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  )
}

// ── AGENDA ────────────────────────────────────────────────────────────────
function AgendaSectionView({ section }: { section: LandingSectionDto }) {
  const data = (section.data ?? {}) as AgendaSectionData
  const items = data.items ?? []
  if (!items.length) return null
  return (
    <section className={cn(sectionWrap, "bg-slate-50 dark:bg-slate-900/40")}>
      <motion.div {...fadeUp}>
        <SectionHeading title={section.title} subtitle={section.subtitle} />
        <Card className="overflow-hidden">
          <CardContent className="divide-y p-0 dark:divide-slate-800">
            {items.map((it, idx) => (
              <div
                key={it.id ?? idx}
                className="grid grid-cols-[80px_1fr] gap-4 px-4 py-3 sm:grid-cols-[120px_1fr_140px] sm:px-6"
              >
                <div className="flex items-start gap-1.5 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  <Clock className="mt-0.5 size-3.5 shrink-0" />
                  <span>{it.time || "—"}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold leading-snug">
                    {it.title || "Untitled"}
                  </p>
                  {it.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {it.description}
                    </p>
                  )}
                </div>
                {it.location && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:justify-end">
                    <MapPin className="size-3.5" />
                    {it.location}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </section>
  )
}

// ── FAQ ──────────────────────────────────────────────────────────────────
function FaqSectionView({ section }: { section: LandingSectionDto }) {
  const data = (section.data ?? {}) as FaqSectionData
  const items = data.items ?? []
  if (!items.length) return null
  return (
    <section className={sectionWrap}>
      <motion.div {...fadeUp}>
        <SectionHeading title={section.title} subtitle={section.subtitle} />
        <Card className="p-0">
          <CardContent className="p-4 sm:p-6">
            <Accordion type="single" collapsible className="w-full">
              {items.map((it, idx) => (
                <AccordionItem key={it.id ?? idx} value={`item-${idx}`}>
                  <AccordionTrigger className="text-left text-base font-medium">
                    {it.question || "Question"}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {it.answer || ""}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </motion.div>
    </section>
  )
}

// ── GALLERY ───────────────────────────────────────────────────────────────
function GallerySectionView({ section }: { section: LandingSectionDto }) {
  const data = (section.data ?? {}) as GallerySectionData
  const items = data.items ?? []
  if (!items.length) return null
  return (
    <section className={cn(sectionWrap, "bg-slate-50 dark:bg-slate-900/40")}>
      <motion.div {...fadeUp}>
        <SectionHeading title={section.title} subtitle={section.subtitle} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it, idx) => (
            <motion.figure
              key={it.id ?? idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: idx * 0.05 }}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                {it.imageUrl ? (
                  <img
                    src={it.imageUrl}
                    alt={it.caption || ""}
                    className="size-full object-cover transition-transform hover:scale-105"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = "none"
                    }}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="size-8" />
                  </div>
                )}
              </div>
              {it.caption && (
                <figcaption className="p-2 text-xs text-muted-foreground">
                  {it.caption}
                </figcaption>
              )}
            </motion.figure>
          ))}
        </div>
      </motion.div>
    </section>
  )
}

// ── CTA ──────────────────────────────────────────────────────────────────
function CtaSectionView({ section }: { section: LandingSectionDto }) {
  const data = (section.data ?? {}) as CtaSectionData
  return (
    <section className={sectionWrap}>
      <motion.div
        {...fadeUp}
        className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 px-6 py-12 text-center text-white shadow-lg sm:py-16"
      >
        {/* Decorative blobs */}
        <div className="absolute -top-12 -right-12 -z-10 size-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 -z-10 size-48 rounded-full bg-teal-300/20 blur-3xl" />
        {section.subtitle && (
          <p className="mb-2 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wider backdrop-blur-sm">
            {section.subtitle}
          </p>
        )}
        {section.title && (
          <h2 className="text-2xl font-bold tracking-tight drop-shadow sm:text-3xl">
            {section.title}
          </h2>
        )}
        {data.buttonText && (
          <a
            href={data.buttonUrl || "#start"}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-emerald-700 shadow-lg transition hover:bg-emerald-50"
          >
            <Megaphone className="size-4" />
            {data.buttonText}
          </a>
        )}
      </motion.div>
    </section>
  )
}

// ── STATS ────────────────────────────────────────────────────────────────
const STAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  users: Users,
  calendar: CalendarDays,
  award: Award,
  clock: Clock,
  "map-pin": MapPin,
  "trending-up": TrendingUp,
  globe: Globe,
}

function StatsSectionView({ section }: { section: LandingSectionDto }) {
  const data = (section.data ?? {}) as StatsSectionData
  const items = data.items ?? []
  if (!items.length) return null
  return (
    <section className={cn(sectionWrap, "bg-slate-50 dark:bg-slate-900/40")}>
      <motion.div {...fadeUp}>
        <SectionHeading title={section.title} subtitle={section.subtitle} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((it, idx) => {
            const Icon = (it.icon && STAT_ICONS[it.icon]) || BarChart3
            return (
              <motion.div
                key={it.id ?? idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: idx * 0.06 }}
                className="rounded-xl border bg-card p-5 text-center"
              >
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <Icon className="size-5" />
                </div>
                <p className="text-2xl font-bold tabular-nums sm:text-3xl">
                  {it.value}
                </p>
                <p className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                  {it.label}
                </p>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </section>
  )
}

// ── CUSTOM ───────────────────────────────────────────────────────────────
function CustomSectionView({ section }: { section: LandingSectionDto }) {
  const data = (section.data ?? {}) as CustomSectionData
  const body = data.body ?? ""
  if (!body) return null
  return (
    <section className={sectionWrap}>
      <motion.div {...fadeUp}>
        <SectionHeading title={section.title} subtitle={section.subtitle} />
        <div className="prose prose-slate mx-auto max-w-2xl dark:prose-invert prose-a:text-emerald-600 prose-headings:scroll-mt-20">
          <ReactMarkdown>{body}</ReactMarkdown>
        </div>
      </motion.div>
    </section>
  )
}

// ─── Small icon helper exported for the empty state on the public page ─────
export const SECTION_TYPE_ICONS = {
  HERO: PanelsTopLeft,
  ABOUT: FileText,
  SPEAKERS: Users,
  SCHEDULE: CalendarDays,
  SPONSORS: Award,
  VENUE: MapPin,
  AGENDA: CalendarClock,
  FAQ: HelpCircle,
  GALLERY: ImageIcon,
  CTA: Megaphone,
  STATS: BarChart3,
  CUSTOM: BarChart3,
} as const
