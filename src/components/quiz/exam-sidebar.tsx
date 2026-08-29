"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ListChecks, ShieldCheck, ChevronRight, Eye, EyeOff, Maximize, Copy, MousePointerClick, Terminal, Camera, Keyboard, ScanFace, Users } from "lucide-react"
import { QuestionNavigator } from "./question-navigator"
import type { SecurityConfig } from "@/components/student/api"
import type { SecurityMetrics } from "./security-sidebar"

interface ExamSidebarProps {
  total: number; current: number; answered: boolean[]; flagged?: boolean[]
  onJump: (idx: number) => void; metrics: SecurityMetrics; config: SecurityConfig
  securityOpen: boolean; onToggleSecurity: () => void
  proctor?: { isReady: boolean; error: string | null; facePresent?: boolean } | null
  videoRef?: React.RefObject<HTMLVideoElement | null>
}

function MR({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: number; warn?: boolean }) {
  const t = value === 0 ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : warn && value <= 3 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
  return (<div className="flex items-center justify-between gap-2 py-1.5"><div className="flex min-w-0 items-center gap-2"><span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{icon}</span><span className="truncate text-xs text-slate-700 dark:text-slate-300">{label}</span></div><Badge variant="secondary" className={cn("tabular-nums text-xs font-semibold", t)}>{value}</Badge></div>)
}

export function ExamSidebar({ total, current, answered, flagged, onJump, metrics, config, securityOpen, onToggleSecurity, proctor, videoRef }: ExamSidebarProps) {
  const ac = answered.filter(Boolean).length
  const tf = (metrics.tabSwitches||0)+(metrics.fullscreenExits||0)+(metrics.copyAttempts||0)+(metrics.rightClicks||0)+(metrics.devtoolsOpen||0)+(metrics.screenshotAttempts||0)+(metrics.keyboardViolations||0)+(metrics.faceNotDetected||0)+(metrics.multiFaceAlerts||0)+(metrics.lookAwayAlerts||0)
  return (<aside className="hidden w-72 shrink-0 flex-col gap-4 xl:flex xl:sticky xl:top-[73px] xl:max-h-[calc(100vh-73px)] xl:overflow-y-auto xl:pr-1">
    <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ListChecks className="size-4 text-emerald-600" /> Navigator</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Answered</span><Badge variant="secondary">{ac}/{total}</Badge></div><Separator /><QuestionNavigator total={total} current={current} answered={answered} flagged={flagged} onJump={onJump} /></CardContent></Card>
    <Card><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-emerald-600" /> Security</CardTitle><Button variant="ghost" size="icon" className="size-7" onClick={onToggleSecurity}><ChevronRight className={cn("size-4 transition-transform", securityOpen ? "" : "rotate-180")} /></Button></div><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="tabular-nums">{tf}</span><span>total flags</span></div></CardHeader>
    {securityOpen && (<CardContent className="pt-0">
      {proctor && proctor.isReady && (<div className="mb-3"><div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700"><div className="relative w-full bg-black" style={{ minHeight: 120, maxHeight: 160 }}><video ref={videoRef} className="block h-full w-full rounded-md" style={{ minHeight: 120, maxHeight: 160, objectFit: "cover" }} muted playsInline autoPlay preload="auto" controls={false} onLoadedMetadata={(e) => { e.currentTarget.play().catch(() => {}); }} onCanPlay={(e) => { if (e.currentTarget.paused) e.currentTarget.play().catch(() => {}); }} /><div className="absolute left-1.5 top-1.5"><Badge variant="secondary" className={cn("gap-1 px-1.5 py-0.5 text-[10px] font-semibold", proctor.error ? "bg-red-500/90 text-white" : "bg-emerald-500/90 text-white")}><ScanFace className="size-3" />{proctor.error ? "OFFLINE" : "LIVE"}</Badge></div></div></div></div>)}
      {proctor && !proctor.isReady && !proctor.error && (<div className="mb-3 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800" style={{ minHeight: 120, maxHeight: 160 }}><div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>)}
      {proctor && proctor.error && (<div className="mb-3 flex items-center justify-center rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20" style={{ minHeight: 120, maxHeight: 160 }}><span className="text-xs text-red-600 dark:text-red-400">Camera: {proctor.error}</span></div>)}
      <div className="space-y-0.5">
        {config.tabSwitchDetection && <MR icon={<Eye className="size-3.5" />} label="Tab switches" value={metrics.tabSwitches||0} warn />}
        <MR icon={<Maximize className="size-3.5" />} label="Fullscreen exits" value={metrics.fullscreenExits||0} warn />
        {config.copyPasteBlocking && <MR icon={<Copy className="size-3.5" />} label="Copy attempts" value={metrics.copyAttempts||0} />}
        {config.rightClickDisable && <MR icon={<MousePointerClick className="size-3.5" />} label="Right-clicks" value={metrics.rightClicks||0} />}
        {config.devtoolsDetection && <MR icon={<Terminal className="size-3.5" />} label="DevTools" value={metrics.devtoolsOpen||0} />}
        {config.antiScreenshot && <MR icon={<Camera className="size-3.5" />} label="Screenshots" value={metrics.screenshotAttempts||0} />}
        {config.keyboardShortcutBlocking && <MR icon={<Keyboard className="size-3.5" />} label="Keyboard" value={metrics.keyboardViolations||0} />}
      </div>
      {proctor && (<><Separator className="my-3" /><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">AI Proctor</p><div className="space-y-0.5">
        <div className="flex items-center justify-between gap-2 py-1.5"><div className="flex min-w-0 items-center gap-2"><span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"><ScanFace className="size-3.5" /></span><span className="truncate text-xs text-slate-700 dark:text-slate-300">Face detected</span></div><Badge variant="secondary" className={cn("gap-1 text-xs font-semibold", proctor.facePresent ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300")}>{proctor.facePresent ? <><ShieldCheck className="size-3" /> Yes</> : <><EyeOff className="size-3" /> No</>}</Badge></div>
        {config.aiProctorMultiFace && <MR icon={<Users className="size-3.5" />} label="Multi-face" value={metrics.multiFaceAlerts||0} />}
        {config.aiProctorLookAway && <MR icon={<EyeOff className="size-3.5" />} label="Look-aways" value={metrics.lookAwayAlerts||0} />}
      </div></>)}
    </CardContent>)}
    </Card>
  </aside>)
}