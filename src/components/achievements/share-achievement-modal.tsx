"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import {
  Check,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Facebook,
  Link2,
  Loader2,
  Linkedin,
  Lock,
  RefreshCw,
  Share2,
  ShieldAlert,
  Sparkles,
  Twitter,
  MessageCircle,
  X,
} from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

import { ShareAchievementCard } from "./share-achievement-card"
import {
  api,
  TEMPLATE_OPTIONS,
  buildShareUrl,
  downloadFilename,
  type ShareableAchievementDto,
  type GenerateImageResponse,
  type ShareResponse,
  type RegenerateLinkResponse,
  type UpdateAchievementInput,
} from "./api"
import type {
  AchievementTemplateId,
  AchievementVisibility,
  SharePlatform,
} from "@/types"

export interface ShareAchievementModalProps {
  achievement: ShareableAchievementDto | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Build the "VERIFY AT" code from the achievement's public token + org name.
 * This matches the serial number shown on the generated card image, so the
 * downloaded filename uses the same code (e.g. "engagio-DEM-2026-7K9M2N.png").
 */
function buildVerifyCode(draft: ShareableAchievementDto): string {
  const orgCode = (draft.achievementData?.orgName || "ENG")
    .replace(/[^A-Z]/gi, "")
    .toUpperCase()
    .slice(0, 3) || "ENG"
  const year = new Date().getFullYear()
  const hash = (draft.title + draft.participantName)
    .split("")
    .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffffff, 7)
    .toString(36)
    .toUpperCase()
    .padStart(6, "0")
    .slice(0, 6)
  return `${orgCode}-${year}-${hash}`
}

export function ShareAchievementModal({
  achievement,
  open,
  onOpenChange,
}: ShareAchievementModalProps) {
  const queryClient = useQueryClient()

  // Local working copy of the achievement — we mutate this as the user
  // changes template/visibility/regenerates the link, so the UI updates
  // immediately without refetching the whole record.
  const [draft, setDraft] = React.useState<ShareableAchievementDto | null>(
    achievement,
  )
  const [templateOpen, setTemplateOpen] = React.useState(false)
  const [privacyOpen, setPrivacyOpen] = React.useState(false)
  // Track which achievement versions we've already auto-generated an image for,
  // so we don't re-generate on every modal open/close (only on first view).
  const lastSeenImageRef = React.useRef<Set<string>>(new Set())

  // Sync draft when the parent passes a new achievement.
  React.useEffect(() => {
    setDraft(achievement)
    if (achievement) {
      // Reset collapsibles on first open.
      setTemplateOpen(false)
      setPrivacyOpen(false)
    }
  }, [achievement])

  // Image generation — regenerate with force=true to ensure the latest
  // renderer (font fix, design update, etc.) is always used. Old cached
  // images on Cloudinary may have been generated with a previous version
  // of the card renderer that had missing-font "tofu" boxes.
  const generateImageMutation = useMutation({
    mutationFn: async (id: string) =>
      api<GenerateImageResponse>(`/api/achievements/${id}/generate-image?force=true`, {
        method: "POST",
        body: JSON.stringify({ force: true }),
      }),
    onSuccess: (data) => {
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              imageUrl: data.imageUrl,
              imagePublicId: data.imagePublicId ?? null,
            }
          : prev,
      )
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't generate the share card image.",
      )
    },
  })

  // Auto-trigger image generation when opening.
  // We always regenerate (force=true) to ensure the card uses the latest
  // renderer — old images may have been generated with a broken font.
  React.useEffect(() => {
    if (!open || !draft) return
    // Only auto-generate if no image yet OR if the user hasn't seen this
    // draft before (avoid re-generating on every modal open/close).
    if (!draft.imageUrl || !lastSeenImageRef.current.has(draft.id + draft.dataVersion)) {
      generateImageMutation.mutate(draft.id)
      lastSeenImageRef.current.add(draft.id + draft.dataVersion)
    }
  }, [open, draft])

  // PATCH template + regenerate the image.
  const updateMutation = useMutation({
    mutationFn: async (params: {
      id: string
      body: UpdateAchievementInput
    }) => {
      const res = await api<ShareableAchievementDto>(
        `/api/achievements/${params.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(params.body),
        },
      )
      return res
    },
    onSuccess: (updated) => {
      setDraft(updated)
      // After a template change, regenerate the image.
      if (updated.imageUrl) {
        // The PATCH may or may not have invalidated the image.
        // Best-effort regenerate to keep PNG in sync.
        void generateImageMutation.mutateAsync(updated.id)
      } else {
        void generateImageMutation.mutateAsync(updated.id)
      }
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update the achievement.",
      )
    },
  })

  const regenerateLinkMutation = useMutation({
    mutationFn: async (id: string) =>
      api<RegenerateLinkResponse>(`/api/achievements/${id}/regenerate-link`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      setDraft((prev) =>
        prev ? { ...prev, publicToken: data.publicToken } : prev,
      )
      toast.success("New share link generated.")
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Couldn't regenerate the link.",
      )
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (id: string) =>
      api<{ success: boolean }>(`/api/achievements/${id}/revoke`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Share link revoked.")
      queryClient.invalidateQueries({ queryKey: ["achievements"] })
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Couldn't revoke the link.",
      )
    },
  })

  const handleShare = React.useCallback(
    async (platform: SharePlatform) => {
      if (!draft) return
      try {
        const data = await api<ShareResponse>(
          `/api/achievements/${draft.id}/share`,
          {
            method: "POST",
            body: JSON.stringify({ platform }),
          },
        )
        const shareUrl = data.shareUrl || buildShareUrl(draft.publicToken)

        switch (platform) {
          case "WHATSAPP": {
            // Try native share with image first (works on mobile WhatsApp)
            if (typeof navigator !== "undefined" && navigator.share && draft.imageUrl) {
              try {
                const imgUrl = draft.imageUrl + (draft.imageUrl.includes("?") ? "&" : "?") + "v=" + draft.dataVersion
                const res = await fetch(imgUrl)
                const blob = await res.blob()
                const file = new File([blob], `engagio-achievement.png`, { type: "image/png" })
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                  await navigator.share({
                    title: draft.title,
                    text: data.text || `Check out my achievement: ${draft.percentage ?? ""}% on ${draft.title}`,
                    files: [file],
                  })
                  break
                }
              } catch {
                // Fall through to URL-based sharing
              }
            }
            // Fallback: open WhatsApp with URL
            window.open(data.urls.whatsapp, "_blank", "noopener,noreferrer")
            break
          }
          case "LINKEDIN":
            window.open(data.urls.linkedin, "_blank", "noopener,noreferrer")
            break
          case "FACEBOOK":
            window.open(data.urls.facebook, "_blank", "noopener,noreferrer")
            break
          case "X":
            window.open(data.urls.x, "_blank", "noopener,noreferrer")
            break
          case "COPY_LINK": {
            try {
              await navigator.clipboard.writeText(shareUrl)
              toast.success("✓ Link copied")
            } catch {
              // Fallback: use a temporary input.
              const el = document.createElement("textarea")
              el.value = shareUrl
              document.body.appendChild(el)
              el.select()
              try {
                document.execCommand("copy")
                toast.success("✓ Link copied")
              } catch {
                toast.error("Couldn't copy automatically — copy this: " + shareUrl)
              }
              document.body.removeChild(el)
            }
            break
          }
          case "NATIVE": {
            if (typeof navigator !== "undefined" && navigator.share) {
              try {
                // Try to share with the card image (Web Share API Level 2)
                const shareData: ShareData = {
                  title: data.text?.split("\n")[0] || draft.title,
                  text: data.text || `${draft.participantName} achieved ${draft.percentage ?? ""}% on ${draft.title}`,
                  url: shareUrl,
                }

                // If we have an image URL, try to fetch it as a blob and share as a file
                if (draft.imageUrl) {
                  try {
                    const imgUrl = draft.imageUrl + (draft.imageUrl.includes("?") ? "&" : "?") + "v=" + draft.dataVersion
                    const res = await fetch(imgUrl)
                    const blob = await res.blob()
                    const file = new File([blob], `engagio-achievement.png`, { type: "image/png" })
                    // Check if navigator.canShare supports files
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                      shareData.files = [file]
                    }
                  } catch {
                    // Image fetch failed — share without the image
                  }
                }

                await navigator.share(shareData)
              } catch {
                // User cancelled — no-op.
              }
            }
            break
          }
          case "DOWNLOAD":
            // Handled separately by the download handler.
            break
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't share.")
      }
    },
    [draft],
  )

  const handleDownload = React.useCallback(async () => {
    if (!draft?.imageUrl) {
      toast.error("Image is still generating — give it a moment.")
      return
    }
    try {
      // Fetch as blob to ensure download works cross-origin.
      // Append cache-busting param to avoid getting the old cached version.
      const imgUrl = draft.imageUrl + (draft.imageUrl.includes("?") ? "&" : "?") + "v=" + draft.dataVersion
      const res = await fetch(imgUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = downloadFilename(draft.title, buildVerifyCode(draft))
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      // Track the share event.
      try {
        await api(`/api/achievements/${draft.id}/share`, {
          method: "POST",
          body: JSON.stringify({ platform: "DOWNLOAD" as SharePlatform }),
        })
      } catch {
        // ignore — best-effort tracking
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't download the image.",
      )
    }
  }, [draft])

  const nativeShareSupported =
    typeof navigator !== "undefined" && typeof navigator.share === "function"

  if (!draft) return null

  const shareUrl = buildShareUrl(draft.publicToken)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-md gap-0 overflow-y-auto p-0 sm:max-w-md sm:rounded-2xl"
        showCloseButton
        data-slot="share-achievement-modal"
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DialogDescription className="sr-only">
          Share your {draft.title} achievement card via WhatsApp, LinkedIn,
          Facebook, X, or copy the link.
        </DialogDescription>

        {/* Body */}
        <div className="max-h-[88vh] overflow-y-auto sm:max-h-[80vh]">
          {/* Header band with close button */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-white/90 px-4 py-3 backdrop-blur dark:bg-slate-950/90">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Sparkles className="size-3.5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-sm font-semibold">
                  Share achievement
                </DialogTitle>
                <p className="truncate text-[11px] text-muted-foreground">
                  {format(new Date(draft.createdAt), "MMM d, yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <VisibilityBadge visibility={draft.visibility} />
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Card preview */}
          <div className="px-4 pb-2 pt-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={draft.imageUrl ? "image" : "loading"}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="relative mx-auto w-full max-w-[320px]"
              >
                {draft.imageUrl ? (
                  <img
                    src={draft.imageUrl + (draft.imageUrl.includes("?") ? "&" : "?") + "v=" + draft.dataVersion}
                    alt={`${draft.title} achievement card`}
                    className="w-full rounded-xl shadow-lg ring-1 ring-black/5"
                  />
                ) : (
                  <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-xl bg-slate-100 dark:bg-slate-900">
                    {generateImageMutation.isPending ? (
                      <>
                        <Loader2 className="size-8 animate-spin text-emerald-600" />
                        <p className="text-xs text-muted-foreground">
                          Generating your card…
                        </p>
                      </>
                    ) : generateImageMutation.isError ? (
                      <>
                        <p className="text-xs text-rose-600">
                          Couldn&apos;t generate image.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            generateImageMutation.mutate(draft.id)
                          }
                        >
                          <RefreshCw className="size-3.5" /> Retry
                        </Button>
                      </>
                    ) : (
                      <ShareAchievementCard achievement={draft} />
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Hidden fallback: rendered for screenshot consistency only */}
            {!draft.imageUrl && (
              <div className="sr-only">
                <ShareAchievementCard achievement={draft} />
              </div>
            )}

            {/* Download + Regenerate */}
            <div className="mt-3 flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                onClick={handleDownload}
                disabled={!draft.imageUrl}
              >
                <Download className="size-4" />
                Download PNG
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => generateImageMutation.mutate(draft.id)}
                disabled={generateImageMutation.isPending}
                aria-label="Regenerate image"
                title="Regenerate image"
              >
                <RefreshCw className={cn("size-4", generateImageMutation.isPending && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Template selector (collapsible) */}
          <Collapsible open={templateOpen} onOpenChange={setTemplateOpen}>
            <div className="px-4 pt-2">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5" />
                    Card style
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform",
                      templateOpen && "rotate-180",
                    )}
                  />
                </button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="grid grid-cols-5 gap-1.5 px-4 py-2">
                {TEMPLATE_OPTIONS.map((opt) => {
                  const active = draft.templateId === opt.id
                  return (
                    <Tooltip key={opt.id} delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              id: draft.id,
                              body: { templateId: opt.id as AchievementTemplateId },
                            })
                          }
                          disabled={updateMutation.isPending}
                          className={cn(
                            "group relative flex aspect-[3/4] flex-col items-center justify-center rounded-md border text-[9px] font-medium transition",
                            "hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30",
                            active
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400",
                          )}
                          aria-label={`${opt.label} template — ${opt.description}`}
                          aria-pressed={active}
                        >
                          <TemplateThumb id={opt.id} active={active} />
                          <span className="mt-1 leading-none">{opt.label}</span>
                          {active && (
                            <span className="absolute right-0.5 top-0.5 grid size-3 place-items-center rounded-full bg-emerald-500 text-white">
                              <Check className="size-2" />
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="font-medium">{opt.label}</p>
                        <p className="text-muted-foreground">{opt.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
              {updateMutation.isPending && (
                <div className="px-4 pb-1 text-center text-[10px] text-muted-foreground">
                  <Loader2 className="mr-1 inline size-3 animate-spin" />
                  Switching template…
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-2" />

          {/* Share section */}
          <div className="space-y-3 px-4 py-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Share to
              </h4>
              {draft.shareCount ? (
                <Badge variant="outline" className="text-[10px]">
                  {draft.shareCount} share{draft.shareCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
            <TooltipProvider delayDuration={300}>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
                <ShareButton
                  icon={<MessageCircle className="size-4" />}
                  label="WhatsApp"
                  tone="emerald"
                  onClick={() => handleShare("WHATSAPP")}
                />
                <ShareButton
                  icon={<Linkedin className="size-4" />}
                  label="LinkedIn"
                  tone="sky"
                  onClick={() => handleShare("LINKEDIN")}
                />
                <ShareButton
                  icon={<Facebook className="size-4" />}
                  label="Facebook"
                  tone="blue"
                  onClick={() => handleShare("FACEBOOK")}
                />
                <ShareButton
                  icon={<Twitter className="size-4" />}
                  label="X"
                  tone="slate"
                  onClick={() => handleShare("X")}
                />
                <ShareButton
                  icon={<Link2 className="size-4" />}
                  label="Copy Link"
                  tone="emerald"
                  onClick={() => handleShare("COPY_LINK")}
                />
                {nativeShareSupported ? (
                  <ShareButton
                    icon={<Share2 className="size-4" />}
                    label="Share"
                    tone="emerald"
                    onClick={() => handleShare("NATIVE")}
                  />
                ) : (
                  <div className="hidden sm:invisible" />
                )}
              </div>
            </TooltipProvider>

            {/* Share URL preview (Copy Link affordance) */}
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5">
              <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 truncate bg-transparent text-[11px] text-muted-foreground outline-none"
                aria-label="Public share link"
              />
              <button
                type="button"
                onClick={() => handleShare("COPY_LINK")}
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              >
                Copy
              </button>
            </div>
          </div>

          <Separator className="my-2" />

          {/* Privacy (collapsible) */}
          <Collapsible open={privacyOpen} onOpenChange={setPrivacyOpen}>
            <div className="px-4 pt-1">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
                >
                  <span className="flex items-center gap-1.5">
                    <Lock className="size-3.5" />
                    Privacy & link
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform",
                      privacyOpen && "rotate-180",
                    )}
                  />
                </button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="space-y-3 px-4 py-3">
                {/* Visibility segmented control */}
                <VisibilitySelector
                  value={draft.visibility}
                  disabled={updateMutation.isPending}
                  onChange={(v) =>
                    updateMutation.mutate({
                      id: draft.id,
                      body: { visibility: v },
                    })
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      regenerateLinkMutation.mutate(draft.id)
                    }
                    disabled={regenerateLinkMutation.isPending}
                  >
                    {regenerateLinkMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Regenerate Link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    onClick={() => revokeMutation.mutate(draft.id)}
                    disabled={revokeMutation.isPending}
                  >
                    {revokeMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ShieldAlert className="size-3.5" />
                    )}
                    Revoke Share
                  </Button>
                </div>
                <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <EyeOff className="mt-0.5 size-3 shrink-0" />
                  Revoking disables the public link immediately. The achievement
                  record remains in your dashboard but cannot be viewed by anyone
                  else.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Footer spacer */}
          <div className="h-3" />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---- Subcomponents ----

function ShareButton({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  tone: "emerald" | "sky" | "blue" | "slate"
  onClick: () => void
}) {
  const toneClasses = {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60",
    sky: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950/60",
    blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60",
    slate:
      "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-[11px] font-medium transition active:scale-95",
        toneClasses,
      )}
    >
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  )
}

function VisibilityBadge({
  visibility,
}: {
  visibility: AchievementVisibility
}) {
  const map: Record<AchievementVisibility, { label: string; className: string }> = {
    PUBLIC: {
      label: "Public",
      className:
        "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    LINK_ONLY: {
      label: "Link only",
      className:
        "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    },
    PRIVATE: {
      label: "Private",
      className:
        "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    },
  }
  const m = map[visibility]
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", m.className)}>
      {visibility === "PUBLIC" && <Eye className="mr-1 size-2.5" />}
      {visibility === "LINK_ONLY" && <Link2 className="mr-1 size-2.5" />}
      {visibility === "PRIVATE" && <Lock className="mr-1 size-2.5" />}
      {m.label}
    </Badge>
  )
}

function VisibilitySelector({
  value,
  onChange,
  disabled,
}: {
  value: AchievementVisibility
  onChange: (v: AchievementVisibility) => void
  disabled?: boolean
}) {
  const options: {
    id: AchievementVisibility
    label: string
    desc: string
    Icon: typeof Eye
  }[] = [
    { id: "PUBLIC", label: "Public", desc: "Search engines + anyone", Icon: Eye },
    { id: "LINK_ONLY", label: "Link only", desc: "Anyone with the link", Icon: Link2 },
    { id: "PRIVATE", label: "Private", desc: "Only you", Icon: Lock },
  ]
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Who can view</p>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((opt) => {
          const active = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left transition disabled:opacity-50",
                active
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-emerald-950/20",
              )}
              aria-pressed={active}
            >
              <span className="flex items-center gap-1 text-[11px] font-semibold">
                <opt.Icon className="size-3" />
                {opt.label}
              </span>
              <span className="text-[9px] leading-tight text-muted-foreground">
                {opt.desc}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TemplateThumb({
  id,
  active,
}: {
  id: AchievementTemplateId
  active: boolean
}) {
  const palettes: Record<AchievementTemplateId, string> = {
    minimal: "from-white to-slate-100",
    modern: "from-emerald-100 to-teal-100",
    professional: "from-slate-200 to-slate-400",
    celebration: "from-amber-100 via-emerald-100 to-rose-100",
    conference: "from-slate-700 to-slate-900",
  }
  return (
    <div
      className={cn(
        "h-7 w-7 rounded bg-gradient-to-br ring-1 ring-black/10",
        palettes[id],
        active && "ring-2 ring-emerald-500/40",
      )}
    />
  )
}

// (No additional helper component — DialogTitle is rendered visibly inside the
// header band above, satisfying Radix's a11y requirement.)
