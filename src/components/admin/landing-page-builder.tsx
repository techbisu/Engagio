"use client"

import * as React from "react"
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  Layout as LayoutIcon,
  Plus,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Users,
  CalendarClock,
  MapPin,
  Award,
  HelpCircle,
  ImagePlus,
  Megaphone,
  BarChart3,
  FileText,
  PanelsTopLeft,
  CalendarDays,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Save,
  ClipboardList,
  PlayCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { CloudinaryImageUpload } from "@/components/shared/cloudinary-image-upload"
import { api } from "./api"
import type {
  LandingSectionDto,
  LandingSectionType,
  HeroSectionData,
  AboutSectionData,
  SpeakersSectionData,
  SpeakerItem,
  ScheduleSectionData,
  ScheduleItem,
  SponsorsSectionData,
  SponsorItem,
  VenueSectionData,
  AgendaSectionData,
  AgendaItem,
  FaqSectionData,
  FaqItem,
  GallerySectionData,
  GalleryItem,
  CtaSectionData,
  StatsSectionData,
  StatItem,
  ActivitiesSectionData,
  RegistrationSectionData,
  CustomSectionData,
} from "@/types"

// ─── Section type catalog ─────────────────────────────────────────────────────

interface SectionTypeMeta {
  type: LandingSectionType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const SECTION_TYPES: SectionTypeMeta[] = [
  { type: "HERO", label: "Hero", description: "Full-width banner with title, subtitle, and background image.", icon: PanelsTopLeft },
  { type: "ABOUT", label: "About", description: "Centered title + rich text body.", icon: FileText },
  { type: "SPEAKERS", label: "Speakers", description: "Grid of speaker cards (avatar, name, bio).", icon: Users },
  { type: "SCHEDULE", label: "Schedule", description: "Day-by-day list of sessions with time + track.", icon: CalendarDays },
  { type: "SPONSORS", label: "Sponsors", description: "Logo grid, grouped by tier (gold/silver/bronze).", icon: Award },
  { type: "VENUE", label: "Venue", description: "Two-column image + address + map link.", icon: MapPin },
  { type: "AGENDA", label: "Agenda", description: "Timeline with time markers + locations.", icon: CalendarClock },
  { type: "FAQ", label: "FAQ", description: "Accordion of questions and answers.", icon: HelpCircle },
  { type: "GALLERY", label: "Gallery", description: "Responsive image grid with captions.", icon: ImagePlus },
  { type: "CTA", label: "Call To Action", description: "Centered card with gradient background + button.", icon: Megaphone },
  { type: "STATS", label: "Stats", description: "4-column stat row (label + value + icon).", icon: BarChart3 },
  { type: "ACTIVITIES", label: "Activities", description: "Auto-loads event activities (exams, polls, quizzes) as clickable carousel cards.", icon: PlayCircle },
  { type: "REGISTRATION", label: "Registration", description: "2-grid design with event registration form + benefits. Participants register with Google.", icon: ClipboardList },
  { type: "CUSTOM", label: "Custom", description: "Free-form markdown body.", icon: LayoutIcon },
]

const SECTION_TYPE_LOOKUP: Record<LandingSectionType, SectionTypeMeta> =
  Object.fromEntries(SECTION_TYPES.map((m) => [m.type, m])) as Record<
    LandingSectionType,
    SectionTypeMeta
  >

function defaultTitle(type: LandingSectionType): string {
  switch (type) {
    case "HERO": return "Hero"
    case "ABOUT": return "About this event"
    case "SPEAKERS": return "Speakers"
    case "SCHEDULE": return "Schedule"
    case "SPONSORS": return "Our sponsors"
    case "VENUE": return "Venue"
    case "AGENDA": return "Agenda"
    case "FAQ": return "Frequently asked questions"
    case "GALLERY": return "Gallery"
    case "CTA": return "Register now"
    case "STATS": return "By the numbers"
    case "ACTIVITIES": return "Activities"
    case "REGISTRATION": return "Register for this event"
    case "CUSTOM": return "Custom section"
  }
}

function defaultDataFor(type: LandingSectionType): Record<string, unknown> {
  switch (type) {
    case "HERO":
      return { backgroundImageUrl: "", buttonText: "", buttonUrl: "" } as HeroSectionData
    case "ABOUT":
      return { body: "" } as AboutSectionData
    case "SPEAKERS":
      return { speakers: [] as SpeakerItem[] }
    case "SCHEDULE":
      return { items: [] as ScheduleItem[] }
    case "SPONSORS":
      return { sponsors: [] as SponsorItem[] }
    case "VENUE":
      return { name: "", address: "", mapUrl: "", imageUrl: "", capacity: undefined } as VenueSectionData
    case "AGENDA":
      return { items: [] as AgendaItem[] }
    case "FAQ":
      return { items: [] as FaqItem[] }
    case "GALLERY":
      return { items: [] as GalleryItem[] }
    case "CTA":
      return { buttonText: "Register now", buttonUrl: "" } as CtaSectionData
    case "STATS":
      return { items: [] as StatItem[] }
    case "ACTIVITIES":
      return { heading: "Activities", subheading: "Click any activity to participate", showStatus: "all" } as ActivitiesSectionData
    case "REGISTRATION":
      return { heading: "Register for this event", description: "Join us for this exciting event. Register now to secure your spot.", benefits: ["Access to all sessions", "Digital certificate of participation", "Networking opportunities"], buttonText: "Register Now", inlineForm: true } as RegistrationSectionData
    case "CUSTOM":
      return { body: "" } as CustomSectionData
  }
}

function makeId(): string {
  // Stable client-only id for new array rows (not used server-side — server
  // returns its own cuid). Using crypto.randomUUID if available.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ─── Main component ──────────────────────────────────────────────────────────

interface LandingPageBuilderProps {
  eventId: string
  eventTitle: string
  onBack?: () => void
}

export function LandingPageBuilder({
  eventId,
  eventTitle,
  onBack,
}: LandingPageBuilderProps) {
  const qc = useQueryClient()
  const queryKey = React.useMemo(() => ["landing-sections", eventId], [eventId])

  const { data, isLoading, isError, error } = useQuery<LandingSectionDto[]>({
    queryKey,
    queryFn: () =>
      api<LandingSectionDto[]>(`/api/events/${eventId}/landing-page`),
  })

  const [sections, setSections] = React.useState<LandingSectionDto[]>([])
  const [deleteTarget, setDeleteTarget] = React.useState<LandingSectionDto | null>(null)

  // Sync server → local state when the query resolves.
  React.useEffect(() => {
    if (data) setSections(data)
  }, [data])

  // ── Mutations ──────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: { type: LandingSectionType; title?: string; data?: Record<string, unknown> }) =>
      api<LandingSectionDto>(
        `/api/events/${eventId}/landing-page/sections`,
        { method: "POST", body: JSON.stringify(payload) }
      ),
    onSuccess: (created) => {
      setSections((prev) => [...prev, created])
      toast.success(`Added ${SECTION_TYPE_LOOKUP[created.type].label} section`)
    },
    onError: (e: Error) => toast.error("Failed to add section: " + e.message),
  })

  const patchMutation = useMutation({
    mutationFn: (payload: {
      sectionId: string
      title?: string
      subtitle?: string
      data?: Record<string, unknown>
      isVisible?: boolean
    }) =>
      api<LandingSectionDto>(
        `/api/events/${eventId}/landing-page/sections/${payload.sectionId}`,
        { method: "PATCH", body: JSON.stringify(payload) }
      ),
    // No onSuccess updating state — the optimistic local state is the source
    // of truth. We DO want to invalidate the public landing query so the live
    // page reflects changes when users refresh.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-event"] })
    },
    onError: (e: Error) =>
      toast.error("Failed to save section: " + e.message),
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: (payload: Array<{ id: string; order: number; isVisible?: boolean }>) =>
      api<LandingSectionDto[]>(
        `/api/events/${eventId}/landing-page`,
        { method: "PUT", body: JSON.stringify({ sections: payload }) }
      ),
    onSuccess: (updated) => {
      setSections(updated)
      qc.invalidateQueries({ queryKey: ["public-event"] })
    },
    onError: (e: Error) => toast.error("Failed to reorder: " + e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (sectionId: string) =>
      api(`/api/events/${eventId}/landing-page/sections/${sectionId}`, {
        method: "DELETE",
      }),
    onSuccess: (_void, sectionId) => {
      setSections((prev) => prev.filter((s) => s.id !== sectionId))
      setDeleteTarget(null)
      toast.success("Section deleted")
      qc.invalidateQueries({ queryKey: ["public-event"] })
    },
    onError: (e: Error) => toast.error("Failed to delete: " + e.message),
  })

  // ── DnD ─────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(sections, oldIndex, newIndex)
    // Re-number order 0..n-1 and persist in bulk.
    const renumbered = next.map((s, idx) => ({ ...s, order: idx }))
    setSections(renumbered)
    bulkUpdateMutation.mutate(
      renumbered.map((s) => ({ id: s.id, order: s.order, isVisible: s.isVisible }))
    )
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    const idx = sections.findIndex((s) => s.id === sectionId)
    if (idx < 0) return
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= sections.length) return
    const next = arrayMove(sections, idx, newIdx)
    const renumbered = next.map((s, i) => ({ ...s, order: i }))
    setSections(renumbered)
    bulkUpdateMutation.mutate(
      renumbered.map((s) => ({ id: s.id, order: s.order, isVisible: s.isVisible }))
    )
  }

  // ── Add section ─────────────────────────────────────────────────────────
  function handleAddSection(type: LandingSectionType) {
    createMutation.mutate({
      type,
      title: defaultTitle(type),
      data: defaultDataFor(type),
    })
  }

  // ── Update helpers (debounced via the card itself) ───────────────────────
  // Each SortableSectionCard manages its own debounced PATCH.

  const totalCount = sections.length
  const visibleCount = sections.filter((s) => s.isVisible).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Back to events
          </button>
          <h2 className="text-xl font-semibold tracking-tight">
            Landing Page Builder
          </h2>
          <p className="text-sm text-muted-foreground">
            Compose <span className="font-medium text-foreground">{eventTitle}</span>
            &apos;s public landing page from prebuilt sections. Drag to reorder.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
          >
            {visibleCount}/{totalCount} visible
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="size-4" /> Add section
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Choose a section type
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SECTION_TYPES.map((m) => {
                const Icon = m.icon
                return (
                  <DropdownMenuItem
                    key={m.type}
                    onClick={() => handleAddSection(m.type)}
                    disabled={createMutation.isPending}
                    className="gap-3 py-2"
                  >
                    <span className="flex size-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Icon className="size-4" />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{m.label}</span>
                      <span className="text-xs text-muted-foreground leading-tight">
                        {m.description}
                      </span>
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* State — error */}
      {isError && (
        <Card className="border-rose-200 dark:border-rose-500/30">
          <CardContent className="pt-6 text-sm text-rose-600 dark:text-rose-400">
            Failed to load sections: {(error as Error)?.message || "Unknown error"}
          </CardContent>
        </Card>
      )}

      {/* State — loading */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <PanelsTopLeft className="size-7" />
            </div>
            <p className="mt-4 text-lg font-semibold">No sections yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-md">
              Add a Hero, About, Speakers, Schedule, or any of the other
              prebuilt sections to compose this event&apos;s public landing page.
            </p>
            <Button
              className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleAddSection("HERO")}
            >
              <Plus className="size-4" /> Add a Hero section
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {sections.map((section, idx) => (
                  <SortableSectionCard
                    key={section.id}
                    section={section}
                    index={idx}
                    total={sections.length}
                    onPatch={(patch) =>
                      patchMutation.mutate({ sectionId: section.id, ...patch })
                    }
                    onMove={(dir) => moveSection(section.id, dir)}
                    onDelete={() => setDeleteTarget(section)}
                    isSaving={patchMutation.isPending && patchMutation.variables?.sectionId === section.id}
                  />
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this section?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.title ? `“${deleteTarget.title}”` : "This section"}
              {" "}will be removed from the public landing page. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
              }}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Sortable section card ───────────────────────────────────────────────────

interface SortableSectionCardProps {
  section: LandingSectionDto
  index: number
  total: number
  onPatch: (patch: {
    title?: string
    subtitle?: string
    data?: Record<string, unknown>
    isVisible?: boolean
  }) => void
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
  isSaving: boolean
}

function SortableSectionCard({
  section,
  index,
  total,
  onPatch,
  onMove,
  onDelete,
  isSaving,
}: SortableSectionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  const meta = SECTION_TYPE_LOOKUP[section.type]
  const Icon = meta.icon

  const [collapsed, setCollapsed] = React.useState(false)

  // ── Debounced field updates ───────────────────────────────────────────
  // We keep a local draft and flush to the server on a debounce. The parent
  // passes us the latest server-persisted section; when it changes due to
  // external factors (drag reorder), we re-sync.
  const [titleDraft, setTitleDraft] = React.useState(section.title ?? "")
  const [subtitleDraft, setSubtitleDraft] = React.useState(section.subtitle ?? "")
  const [dataDraft, setDataDraft] = React.useState<Record<string, unknown>>(section.data ?? {})

  React.useEffect(() => {
    setTitleDraft(section.title ?? "")
    setSubtitleDraft(section.subtitle ?? "")
    setDataDraft(section.data ?? {})
    // We only re-sync on identity changes (drag-reorder doesn't change id).
  }, [section.id, section.title, section.subtitle, section.data])

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = React.useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    onPatch({
      title: titleDraft,
      subtitle: subtitleDraft,
      data: dataDraft,
    })
  }, [titleDraft, subtitleDraft, dataDraft, onPatch])

  React.useEffect(() => {
    // Skip the very first render — don't fire a save just because we mounted.
    debounceRef.current = setTimeout(() => {
      // Only fire if something actually changed vs. the server snapshot.
      const titleChanged = titleDraft !== (section.title ?? "")
      const subtitleChanged = subtitleDraft !== (section.subtitle ?? "")
      const dataChanged = JSON.stringify(dataDraft) !== JSON.stringify(section.data ?? {})
      if (titleChanged || subtitleChanged || dataChanged) {
        onPatch({
          title: titleDraft,
          subtitle: subtitleDraft,
          data: dataDraft,
        })
      }
    }, 800)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // Intentionally only depend on the drafts — we don't want to re-fire
    // every time the parent re-renders or section.title/etc. change due to
    // server sync. The snapshot compare above guards against redundant saves.
  }, [titleDraft, subtitleDraft, dataDraft])

  // Cleanup on unmount: flush pending changes.
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow",
        isDragging && "shadow-lg ring-2 ring-emerald-500/40",
        !section.isVisible && "opacity-70"
      )}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b p-3">
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <span className="flex size-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Icon className="size-4" />
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex min-w-0 flex-1 flex-col items-start text-left"
        >
          <span className="truncate text-sm font-semibold">
            {titleDraft || meta.label}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {meta.label} · #{index + 1}
          </span>
        </button>
        {isSaving && (
          <Loader2 className="size-3.5 animate-spin text-emerald-600" />
        )}
        <Badge
          variant="outline"
          className={cn(
            "hidden sm:inline-flex",
            section.isVisible
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
              : "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
          )}
        >
          {section.isVisible ? "Visible" : "Hidden"}
        </Badge>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Move down"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={section.isVisible ? "Hide section" : "Show section"}
            onClick={() =>
              onPatch({ isVisible: !section.isVisible })
            }
          >
            {section.isVisible ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
            aria-label="Delete section"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Editor body */}
      {!collapsed && (
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`sec-title-${section.id}`}>Title</Label>
              <Input
                id={`sec-title-${section.id}`}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder="Section title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`sec-sub-${section.id}`}>Subtitle</Label>
              <Input
                id={`sec-sub-${section.id}`}
                value={subtitleDraft}
                onChange={(e) => setSubtitleDraft(e.target.value)}
                placeholder="Optional subtitle / eyebrow"
              />
            </div>
          </div>

          <SectionTypeEditor
            type={section.type}
            data={dataDraft}
            onChange={(next) => setDataDraft(next)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Section type editors ────────────────────────────────────────────────────

interface SectionTypeEditorProps {
  type: LandingSectionType
  data: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}

function SectionTypeEditor({ type, data, onChange }: SectionTypeEditorProps) {
  switch (type) {
    case "HERO":
      return <HeroEditor data={data as HeroSectionData} onChange={onChange} />
    case "ABOUT":
      return <AboutEditor data={data as AboutSectionData} onChange={onChange} />
    case "SPEAKERS":
      return <SpeakersEditor data={data as SpeakersSectionData} onChange={onChange} />
    case "SCHEDULE":
      return <ScheduleEditor data={data as ScheduleSectionData} onChange={onChange} />
    case "SPONSORS":
      return <SponsorsEditor data={data as SponsorsSectionData} onChange={onChange} />
    case "VENUE":
      return <VenueEditor data={data as VenueSectionData} onChange={onChange} />
    case "AGENDA":
      return <AgendaEditor data={data as AgendaSectionData} onChange={onChange} />
    case "FAQ":
      return <FaqEditor data={data as FaqSectionData} onChange={onChange} />
    case "GALLERY":
      return <GalleryEditor data={data as GallerySectionData} onChange={onChange} />
    case "CTA":
      return <CtaEditor data={data as CtaSectionData} onChange={onChange} />
    case "STATS":
      return <StatsEditor data={data as StatsSectionData} onChange={onChange} />
    case "ACTIVITIES":
      return <ActivitiesEditor data={data as ActivitiesSectionData} onChange={onChange} />
    case "REGISTRATION":
      return <RegistrationEditor data={data as RegistrationSectionData} onChange={onChange} />
    case "CUSTOM":
      return <CustomEditor data={data as CustomSectionData} onChange={onChange} />
  }
}

// ── HERO ──────────────────────────────────────────────────────────────────
function HeroEditor({ data, onChange }: { data: HeroSectionData; onChange: (next: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Background image</Label>
        <CloudinaryImageUpload
          value={data.backgroundImageUrl ?? ""}
          onChange={(url) =>
            onChange({ ...data, backgroundImageUrl: url })
          }
          folder="events/landing/hero"
          aspectRatio="16/9"
          description="Optional. Shown full-width behind the hero title."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="hero-btn-text">Button text</Label>
          <Input
            id="hero-btn-text"
            value={data.buttonText ?? ""}
            onChange={(e) => onChange({ ...data, buttonText: e.target.value })}
            placeholder="Register now"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero-btn-url">Button link</Label>
          <Input
            id="hero-btn-url"
            value={data.buttonUrl ?? ""}
            onChange={(e) => onChange({ ...data, buttonUrl: e.target.value })}
            placeholder="https://…  (leave blank to use built-in Start button)"
          />
        </div>
      </div>
    </div>
  )
}

// ── ABOUT ─────────────────────────────────────────────────────────────────
function AboutEditor({ data, onChange }: { data: AboutSectionData; onChange: (next: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="about-body">Body</Label>
      <Textarea
        id="about-body"
        rows={6}
        value={data.body ?? ""}
        onChange={(e) => onChange({ ...data, body: e.target.value })}
        placeholder="Write a short description about the event. Markdown is supported on the public page."
      />
      <p className="text-xs text-muted-foreground">
        Tip: Markdown is rendered on the public landing page (headings, lists, links).
      </p>
    </div>
  )
}

// ── SPEAKERS ──────────────────────────────────────────────────────────────
function SpeakersEditor({ data, onChange }: { data: SpeakersSectionData; onChange: (next: Record<string, unknown>) => void }) {
  const speakers = data.speakers ?? []
  function update(idx: number, patch: Partial<SpeakerItem>) {
    const next = speakers.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    onChange({ ...data, speakers: next })
  }
  function remove(idx: number) {
    onChange({ ...data, speakers: speakers.filter((_, i) => i !== idx) })
  }
  function add() {
    onChange({
      ...data,
      speakers: [...speakers, { id: makeId(), name: "", title: "", company: "", bio: "", avatarUrl: "" }],
    })
  }
  return (
    <div className="space-y-3">
      {speakers.length === 0 && (
        <EmptyRows label="No speakers yet" />
      )}
      {speakers.map((s, idx) => (
        <Card key={s.id} className="bg-slate-50/60 dark:bg-slate-900/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Speaker #{idx + 1}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-rose-600 hover:bg-rose-50"
                onClick={() => remove(idx)}
                aria-label="Remove speaker"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={s.name}
                  onChange={(e) => update(idx, { name: e.target.value })}
                  placeholder="Dr. Ada Lovelace"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={s.title ?? ""}
                  onChange={(e) => update(idx, { title: e.target.value })}
                  placeholder="Chief Data Scientist"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input
                  value={s.company ?? ""}
                  onChange={(e) => update(idx, { company: e.target.value })}
                  placeholder="Acme Inc."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Avatar URL</Label>
                <Input
                  value={s.avatarUrl ?? ""}
                  onChange={(e) => update(idx, { avatarUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Bio</Label>
              <Textarea
                rows={3}
                value={s.bio ?? ""}
                onChange={(e) => update(idx, { bio: e.target.value })}
                placeholder="A short biography shown on the speaker card."
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={add} className="w-full">
        <Plus className="size-4" /> Add speaker
      </Button>
    </div>
  )
}

// ── SCHEDULE ───────────────────────────────────────────────────────────────
function ScheduleEditor({ data, onChange }: { data: ScheduleSectionData; onChange: (next: Record<string, unknown>) => void }) {
  const items = data.items ?? []
  function update(idx: number, patch: Partial<ScheduleItem>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    onChange({ ...data, items: next })
  }
  function remove(idx: number) {
    onChange({ ...data, items: items.filter((_, i) => i !== idx) })
  }
  function add() {
    onChange({
      ...data,
      items: [...items, { id: makeId(), date: "", time: "", title: "", description: "", speakerName: "", track: "" }],
    })
  }
  return (
    <div className="space-y-3">
      {items.length === 0 && <EmptyRows label="No schedule items yet" />}
      {items.map((it, idx) => (
        <Card key={it.id} className="bg-slate-50/60 dark:bg-slate-900/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Item #{idx + 1}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-rose-600 hover:bg-rose-50"
                onClick={() => remove(idx)}
                aria-label="Remove item"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={it.date ?? ""}
                  onChange={(e) => update(idx, { date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input
                  value={it.time ?? ""}
                  onChange={(e) => update(idx, { time: e.target.value })}
                  placeholder="10:00 – 11:00 AM"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Track</Label>
                <Input
                  value={it.track ?? ""}
                  onChange={(e) => update(idx, { track: e.target.value })}
                  placeholder="Main hall / Workshop A"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={it.title}
                  onChange={(e) => update(idx, { title: e.target.value })}
                  placeholder="Keynote: The future of X"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Speaker</Label>
                <Input
                  value={it.speakerName ?? ""}
                  onChange={(e) => update(idx, { speakerName: e.target.value })}
                  placeholder="Dr. Ada Lovelace"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={it.description ?? ""}
                onChange={(e) => update(idx, { description: e.target.value })}
                placeholder="A short description of this session."
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={add} className="w-full">
        <Plus className="size-4" /> Add schedule item
      </Button>
    </div>
  )
}

// ── SPONSORS ──────────────────────────────────────────────────────────────
function SponsorsEditor({ data, onChange }: { data: SponsorsSectionData; onChange: (next: Record<string, unknown>) => void }) {
  const sponsors = data.sponsors ?? []
  function update(idx: number, patch: Partial<SponsorItem>) {
    const next = sponsors.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    onChange({ ...data, sponsors: next })
  }
  function remove(idx: number) {
    onChange({ ...data, sponsors: sponsors.filter((_, i) => i !== idx) })
  }
  function add() {
    onChange({
      ...data,
      sponsors: [...sponsors, { id: makeId(), name: "", logoUrl: "", tier: "silver", websiteUrl: "" }],
    })
  }
  return (
    <div className="space-y-3">
      {sponsors.length === 0 && <EmptyRows label="No sponsors yet" />}
      {sponsors.map((s, idx) => (
        <Card key={s.id} className="bg-slate-50/60 dark:bg-slate-900/40">
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sponsor #{idx + 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-rose-600 hover:bg-rose-50"
                onClick={() => remove(idx)}
                aria-label="Remove sponsor"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={s.name}
                  onChange={(e) => update(idx, { name: e.target.value })}
                  placeholder="Acme Inc."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tier</Label>
                <Select
                  value={s.tier ?? "silver"}
                  onValueChange={(v) => update(idx, { tier: v as SponsorItem["tier"] })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="bronze">Bronze</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Logo URL</Label>
                <Input
                  value={s.logoUrl ?? ""}
                  onChange={(e) => update(idx, { logoUrl: e.target.value })}
                  placeholder="https://…/logo.png"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Website URL</Label>
                <Input
                  value={s.websiteUrl ?? ""}
                  onChange={(e) => update(idx, { websiteUrl: e.target.value })}
                  placeholder="https://acme.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={add} className="w-full">
        <Plus className="size-4" /> Add sponsor
      </Button>
    </div>
  )
}

// ── VENUE ─────────────────────────────────────────────────────────────────
function VenueEditor({ data, onChange }: { data: VenueSectionData; onChange: (next: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Venue name</Label>
          <Input
            value={data.name ?? ""}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="Grand Convention Center"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Capacity</Label>
          <Input
            type="number"
            value={data.capacity ?? ""}
            onChange={(e) =>
              onChange({ ...data, capacity: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="500"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Address</Label>
        <Textarea
          rows={2}
          value={data.address ?? ""}
          onChange={(e) => onChange({ ...data, address: e.target.value })}
          placeholder="123 Main Street, City, Country"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Map URL</Label>
          <Input
            value={data.mapUrl ?? ""}
            onChange={(e) => onChange({ ...data, mapUrl: e.target.value })}
            placeholder="https://maps.google.com/?q=…"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Venue image</Label>
        <CloudinaryImageUpload
          value={data.imageUrl ?? ""}
          onChange={(url) => onChange({ ...data, imageUrl: url })}
          folder="events/landing/venue"
          aspectRatio="4/3"
          description="Optional photo of the venue exterior / hall."
        />
      </div>
    </div>
  )
}

// ── AGENDA ────────────────────────────────────────────────────────────────
function AgendaEditor({ data, onChange }: { data: AgendaSectionData; onChange: (next: Record<string, unknown>) => void }) {
  const items = data.items ?? []
  function update(idx: number, patch: Partial<AgendaItem>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    onChange({ ...data, items: next })
  }
  function remove(idx: number) {
    onChange({ ...data, items: items.filter((_, i) => i !== idx) })
  }
  function add() {
    onChange({
      ...data,
      items: [...items, { id: makeId(), time: "", title: "", description: "", location: "" }],
    })
  }
  return (
    <div className="space-y-3">
      {items.length === 0 && <EmptyRows label="No agenda items yet" />}
      {items.map((it, idx) => (
        <Card key={it.id} className="bg-slate-50/60 dark:bg-slate-900/40">
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Slot #{idx + 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-rose-600 hover:bg-rose-50"
                onClick={() => remove(idx)}
                aria-label="Remove slot"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input
                  value={it.time}
                  onChange={(e) => update(idx, { time: e.target.value })}
                  placeholder="09:00 AM"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Title</Label>
                <Input
                  value={it.title}
                  onChange={(e) => update(idx, { title: e.target.value })}
                  placeholder="Welcome & keynote"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input
                value={it.location ?? ""}
                onChange={(e) => update(idx, { location: e.target.value })}
                placeholder="Main hall"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={it.description ?? ""}
                onChange={(e) => update(idx, { description: e.target.value })}
                placeholder="A short description of this slot."
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={add} className="w-full">
        <Plus className="size-4" /> Add agenda slot
      </Button>
    </div>
  )
}

// ── FAQ ──────────────────────────────────────────────────────────────────
function FaqEditor({ data, onChange }: { data: FaqSectionData; onChange: (next: Record<string, unknown>) => void }) {
  const items = data.items ?? []
  function update(idx: number, patch: Partial<FaqItem>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    onChange({ ...data, items: next })
  }
  function remove(idx: number) {
    onChange({ ...data, items: items.filter((_, i) => i !== idx) })
  }
  function add() {
    onChange({
      ...data,
      items: [...items, { id: makeId(), question: "", answer: "" }],
    })
  }
  return (
    <div className="space-y-3">
      {items.length === 0 && <EmptyRows label="No questions yet" />}
      {items.map((it, idx) => (
        <Card key={it.id} className="bg-slate-50/60 dark:bg-slate-900/40">
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Q #{idx + 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-rose-600 hover:bg-rose-50"
                onClick={() => remove(idx)}
                aria-label="Remove question"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Question</Label>
              <Input
                value={it.question}
                onChange={(e) => update(idx, { question: e.target.value })}
                placeholder="What should I bring?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Answer</Label>
              <Textarea
                rows={3}
                value={it.answer}
                onChange={(e) => update(idx, { answer: e.target.value })}
                placeholder="A clear, helpful answer."
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={add} className="w-full">
        <Plus className="size-4" /> Add question
      </Button>
    </div>
  )
}

// ── GALLERY ───────────────────────────────────────────────────────────────
function GalleryEditor({ data, onChange }: { data: GallerySectionData; onChange: (next: Record<string, unknown>) => void }) {
  const items = data.items ?? []
  function update(idx: number, patch: Partial<GalleryItem>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    onChange({ ...data, items: next })
  }
  function remove(idx: number) {
    onChange({ ...data, items: items.filter((_, i) => i !== idx) })
  }
  function add() {
    onChange({
      ...data,
      items: [...items, { id: makeId(), imageUrl: "", caption: "" }],
    })
  }
  return (
    <div className="space-y-3">
      {items.length === 0 && <EmptyRows label="No gallery images yet" />}
      {items.map((it, idx) => (
        <Card key={it.id} className="bg-slate-50/60 dark:bg-slate-900/40">
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Image #{idx + 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-rose-600 hover:bg-rose-50"
                onClick={() => remove(idx)}
                aria-label="Remove image"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <CloudinaryImageUpload
              value={it.imageUrl}
              onChange={(url) => update(idx, { imageUrl: url })}
              folder="events/landing/gallery"
              aspectRatio="4/3"
              label="Image"
            />
            <div className="space-y-1.5">
              <Label>Caption</Label>
              <Input
                value={it.caption ?? ""}
                onChange={(e) => update(idx, { caption: e.target.value })}
                placeholder="Optional caption shown under the image"
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={add} className="w-full">
        <Plus className="size-4" /> Add image
      </Button>
    </div>
  )
}

// ── CTA ──────────────────────────────────────────────────────────────────
function CtaEditor({ data, onChange }: { data: CtaSectionData; onChange: (next: Record<string, unknown>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Button text</Label>
        <Input
          value={data.buttonText ?? ""}
          onChange={(e) => onChange({ ...data, buttonText: e.target.value })}
          placeholder="Register now"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Button link</Label>
        <Input
          value={data.buttonUrl ?? ""}
          onChange={(e) => onChange({ ...data, buttonUrl: e.target.value })}
          placeholder="https://…  (leave blank to use built-in Start button)"
        />
      </div>
    </div>
  )
}

// ── STATS ───────────────────────────────────────────────────────────────
function StatsEditor({ data, onChange }: { data: StatsSectionData; onChange: (next: Record<string, unknown>) => void }) {
  const items = data.items ?? []
  function update(idx: number, patch: Partial<StatItem>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    onChange({ ...data, items: next })
  }
  function remove(idx: number) {
    onChange({ ...data, items: items.filter((_, i) => i !== idx) })
  }
  function add() {
    onChange({
      ...data,
      items: [...items, { id: makeId(), label: "", value: "", icon: "" }],
    })
  }
  return (
    <div className="space-y-3">
      {items.length === 0 && <EmptyRows label="No stats yet" />}
      {items.map((it, idx) => (
        <Card key={it.id} className="bg-slate-50/60 dark:bg-slate-900/40">
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Stat #{idx + 1}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-rose-600 hover:bg-rose-50"
                onClick={() => remove(idx)}
                aria-label="Remove stat"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Label</Label>
                <Input
                  value={it.label}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  placeholder="Attendees"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Value</Label>
                <Input
                  value={it.value}
                  onChange={(e) => update(idx, { value: e.target.value })}
                  placeholder="500+"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Icon (optional)</Label>
                <Select
                  value={it.icon ?? ""}
                  onValueChange={(v) => update(idx, { icon: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick an icon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    <SelectItem value="users">Users</SelectItem>
                    <SelectItem value="calendar">Calendar</SelectItem>
                    <SelectItem value="award">Award</SelectItem>
                    <SelectItem value="clock">Clock</SelectItem>
                    <SelectItem value="map-pin">Map pin</SelectItem>
                    <SelectItem value="trending-up">Trending up</SelectItem>
                    <SelectItem value="globe">Globe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={add} className="w-full">
        <Plus className="size-4" /> Add stat
      </Button>
    </div>
  )
}

// ── CUSTOM ───────────────────────────────────────────────────────────────
function CustomEditor({ data, onChange }: { data: CustomSectionData; onChange: (next: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="custom-body">Markdown body</Label>
      <Textarea
        id="custom-body"
        rows={8}
        value={data.body ?? ""}
        onChange={(e) => onChange({ ...data, body: e.target.value })}
        placeholder="# Heading&#10;&#10;Markdown is rendered on the public page. Supports **bold**, _italic_, lists, links, and code."
      />
    </div>
  )
}

// ─── Empty rows placeholder ─────────────────────────────────────────────────

function EmptyRows({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center text-muted-foreground">
      <ImageIcon className="size-5 opacity-50" />
      <p className="text-xs">{label}</p>
    </div>
  )
}

// Re-export for callers that want to show a small footer hint.
export function LandingPageBuilderFooterHint() {
  return (
    <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
      <Save className="size-3" />
      Changes are saved automatically.
    </p>
  )
}

// ── ACTIVITIES ────────────────────────────────────────────────────────────
function ActivitiesEditor({ data, onChange }: { data: ActivitiesSectionData; onChange: (next: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
        <PlayCircle className="mb-1 size-4" />
        This section automatically loads the event's activities (exams, polls, quizzes) as clickable carousel cards. Only LIVE and SCHEDULED activities are shown to participants.
      </div>
      <div className="space-y-1.5">
        <Label>Heading</Label>
        <Input
          value={data.heading ?? ""}
          onChange={(e) => onChange({ ...data, heading: e.target.value })}
          placeholder="Activities"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Subheading</Label>
        <Input
          value={data.subheading ?? ""}
          onChange={(e) => onChange({ ...data, subheading: e.target.value })}
          placeholder="Click any activity to participate"
        />
      </div>
    </div>
  )
}

// ── REGISTRATION ──────────────────────────────────────────────────────────
function RegistrationEditor({ data, onChange }: { data: RegistrationSectionData; onChange: (next: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
        <ClipboardList className="mb-1 size-4" />
        Shows the event registration form in a 2-grid layout (benefits on left, form on right). Participants register with Google auth, then get access to the dashboard.
      </div>
      <div className="space-y-1.5">
        <Label>Heading</Label>
        <Input
          value={data.heading ?? ""}
          onChange={(e) => onChange({ ...data, heading: e.target.value })}
          placeholder="Register for this event"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={data.description ?? ""}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="Join us for this exciting event..."
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Benefits (one per line)</Label>
        <Textarea
          value={(data.benefits ?? []).join("\n")}
          onChange={(e) => onChange({ ...data, benefits: e.target.value.split("\n").filter(Boolean) })}
          placeholder={"Access to all sessions\nDigital certificate\nNetworking opportunities"}
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Button text</Label>
        <Input
          value={data.buttonText ?? ""}
          onChange={(e) => onChange({ ...data, buttonText: e.target.value })}
          placeholder="Register Now"
        />
      </div>
    </div>
  )
}
