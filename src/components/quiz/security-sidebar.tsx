"use client"

import { type ReactNode } from "react"
import {
  ChevronRight,
  Eye,
  Maximize,
  Copy,
  MousePointerClick,
  Terminal,
  Camera,
  Keyboard,
  ScanFace,
  Users,
  EyeOff,
  ShieldCheck,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { SecurityConfig } from "@/components/student/api"

/** All counters the sidebar can display. */
export interface SecurityMetrics {
  tabSwitches: number
  fullscreenExits: number
  copyAttempts: number
  rightClicks: number
  devtoolsOpen: number
  screenshotAttempts: number
  keyboardViolations: number
  faceNotDetected: number
  multiFaceAlerts: number
  lookAwayAlerts: number
}

interface SecuritySidebarProps {
  metrics: SecurityMetrics
  config: SecurityConfig
  /** Desktop: controls card body collapse. Mobile: controls Sheet open. */
  isOpen: boolean
  onToggle: () => void
  /** When provided, renders a live video thumbnail at the top of the sidebar. */
  proctor?: {
    isReady: boolean
    error: string | null
  } | null
  /** Ref to attach to the proctor video preview element (when aiProctor on). */
  videoRef?: React.RefObject<HTMLVideoElement | null>
}

/** A single metric row: icon, label, value, threshold-based color. */
function MetricRow({
  icon,
  label,
  value,
  threshold = 3,
  active,
}: {
  icon: ReactNode
  label: string
  value: number
  threshold?: number
  active: boolean
}) {
  if (!active) return null
  const bgTone =
    value === 0
      ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      : value <= threshold
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
        : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {icon}
        </span>
        <span className="truncate text-xs text-slate-700 dark:text-slate-300">
          {label}
        </span>
      </div>
      <Badge
        variant="secondary"
        className={cn("tabular-nums text-xs font-semibold", bgTone)}
      >
        {value}
      </Badge>
    </div>
  )
}

/** Body of the sidebar — shared between desktop Card and mobile Sheet. */
function SidebarBody({
  metrics,
  config,
  proctor,
  videoRef,
}: {
  metrics: SecurityMetrics
  config: SecurityConfig
  proctor?: {
    isReady: boolean
    error: string | null
  } | null
  videoRef?: React.RefObject<HTMLVideoElement | null>
}) {
  const faceStatus: "ok" | "warn" | "off" = proctor
    ? proctor.error
      ? "off"
      : proctor.isReady && metrics.faceNotDetected === 0
        ? "ok"
        : "warn"
    : "off"

  return (
    <div className="space-y-3">
      {/* AI proctor live preview thumbnail */}
      {config.aiProctor && proctor && (
        <>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700">
            <div className="relative aspect-video w-full bg-black">
              <video
                ref={videoRef}
                className="size-full object-cover"
                muted
                playsInline
                autoPlay
                // Safari requires these attributes for reliable autoplay.
                // The hook also calls video.play() explicitly after srcObject is set.
                preload="auto"
                controls={false}
                // Force-play when metadata loads — some browsers pause the video
                // when srcObject is first attached. This catches that case.
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget
                  v.play().catch(() => {})
                }}
                onCanPlay={(e) => {
                  const v = e.currentTarget
                  if (v.paused) v.play().catch(() => {})
                }}
              />
              <div className="absolute left-1.5 top-1.5">
                <Badge
                  variant="secondary"
                  className={cn(
                    "gap-1 px-1.5 py-0.5 text-[10px] font-semibold",
                    faceStatus === "ok"
                      ? "bg-emerald-500/90 text-white"
                      : faceStatus === "warn"
                        ? "bg-amber-500/90 text-white"
                        : "bg-red-500/90 text-white",
                  )}
                >
                  <ScanFace className="size-3" />
                  {proctor.error
                    ? "OFFLINE"
                    : proctor.isReady
                      ? "LIVE"
                      : "…"}
                </Badge>
              </div>
            </div>
          </div>
          {proctor.error && (
            <p className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Camera error: {proctor.error}
            </p>
          )}
        </>
      )}

      <Separator />

      <div className="space-y-0.5">
        <MetricRow
          icon={<Eye className="size-3.5" />}
          label="Tab switches"
          value={metrics.tabSwitches}
          active={config.tabSwitchDetection}
        />
        <MetricRow
          icon={<Maximize className="size-3.5" />}
          label="Fullscreen exits"
          value={metrics.fullscreenExits}
          threshold={2}
          active={true}
        />
        <MetricRow
          icon={<Copy className="size-3.5" />}
          label="Copy attempts"
          value={metrics.copyAttempts}
          threshold={0}
          active={config.copyPasteBlocking}
        />
        <MetricRow
          icon={<MousePointerClick className="size-3.5" />}
          label="Right-clicks"
          value={metrics.rightClicks}
          active={config.rightClickDisable}
        />
        <MetricRow
          icon={<Terminal className="size-3.5" />}
          label="DevTools opened"
          value={metrics.devtoolsOpen}
          threshold={0}
          active={config.devtoolsDetection}
        />
        <MetricRow
          icon={<Camera className="size-3.5" />}
          label="Screenshots"
          value={metrics.screenshotAttempts}
          threshold={0}
          active={config.antiScreenshot}
        />
        <MetricRow
          icon={<Keyboard className="size-3.5" />}
          label="Keyboard violations"
          value={metrics.keyboardViolations}
          active={config.keyboardShortcutBlocking}
        />
      </div>

      {config.aiProctor && (
        <>
          <Separator />
          <div className="space-y-0.5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              <ScanFace className="size-3.5" /> AI Proctor
            </div>
            {config.aiProctorFaceDetection && (
              <div className="flex items-center justify-between gap-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <ScanFace className="size-3.5" />
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    Face detected
                  </span>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "gap-1 text-xs font-semibold",
                    faceStatus === "ok"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : faceStatus === "warn"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
                  )}
                >
                  {faceStatus === "ok" ? (
                    <>
                      <ShieldCheck className="size-3" /> Yes
                    </>
                  ) : faceStatus === "warn" ? (
                    <>
                      <EyeOff className="size-3" /> Check
                    </>
                  ) : (
                    <>
                      <EyeOff className="size-3" /> N/A
                    </>
                  )}
                </Badge>
              </div>
            )}
            <MetricRow
              icon={<Users className="size-3.5" />}
              label="Multi-face alerts"
              value={metrics.multiFaceAlerts}
              threshold={0}
              active={config.aiProctorMultiFace}
            />
            <MetricRow
              icon={<EyeOff className="size-3.5" />}
              label="Look-aways"
              value={metrics.lookAwayAlerts}
              active={config.aiProctorLookAway}
            />
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Collapsible security metrics sidebar. On desktop (xl+), it renders as a
 * Card on the right side of the quiz layout; on mobile, the parent renders a
 * floating button that toggles `isOpen` which controls a bottom Sheet here.
 *
 * The parent owns `isOpen` / `onToggle` so the mobile Sheet + desktop
 * collapse state can share a single toggle.
 */
export function SecuritySidebar({
  metrics,
  config,
  isOpen,
  onToggle,
  proctor,
  videoRef,
}: SecuritySidebarProps) {
  const totalViolations =
    metrics.tabSwitches +
    metrics.fullscreenExits +
    metrics.copyAttempts +
    metrics.rightClicks +
    metrics.devtoolsOpen +
    metrics.screenshotAttempts +
    metrics.keyboardViolations +
    metrics.faceNotDetected +
    metrics.multiFaceAlerts +
    metrics.lookAwayAlerts

  return (
    <>
      {/* Desktop sidebar (xl+) */}
      <aside className="hidden w-72 shrink-0 xl:block">
        <Card className="sticky top-24">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-emerald-600" /> Security
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={onToggle}
                aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                <ChevronRight
                  className={cn(
                    "size-4 transition-transform",
                    isOpen ? "" : "rotate-180",
                  )}
                />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="tabular-nums">{totalViolations}</span>
              <span>total flags</span>
            </div>
          </CardHeader>
          {isOpen && (
            <CardContent className="pt-0">
              <SidebarBody
                metrics={metrics}
                config={config}
                proctor={proctor}
                videoRef={videoRef}
              />
            </CardContent>
          )}
        </Card>
      </aside>

      {/* Mobile bottom Sheet */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && onToggle()}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" /> Security
              Monitor
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 pt-2">
            <SidebarBody
              metrics={metrics}
              config={config}
              proctor={proctor}
              videoRef={videoRef}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
