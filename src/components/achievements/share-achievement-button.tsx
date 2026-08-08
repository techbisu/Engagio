"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { ShareAchievementModal } from "./share-achievement-modal"
import {
  api,
  type CreateAchievementInput,
  type ShareableAchievementDto,
} from "./api"

export interface ShareAchievementButtonProps {
  /** The achievement descriptor to share. Pass `disabledReason` to grey-out the button. */
  achievementInput: CreateAchievementInput
  /** Optional callback after a share session closes / card was created. */
  onShared?: (achievement: ShareableAchievementDto) => void
  /** When provided, the button is rendered disabled with this tooltip text. */
  disabledReason?: string | null
  /** Optional button label override. */
  label?: string
  /** Visual size of the trigger button. */
  size?: ButtonProps["size"]
  /** Visual variant of the trigger button. */
  variant?: ButtonProps["variant"]
  className?: string
}

/**
 * Polished emerald "✨ Share Achievement" trigger that:
 *  1. Lazily creates a ShareableAchievement via POST /api/achievements.
 *  2. Opens the ShareAchievementModal with the created achievement.
 *
 * If `disabledReason` is set, the button is hidden (or disabled with a tooltip).
 */
export function ShareAchievementButton({
  achievementInput,
  onShared,
  disabledReason,
  label = "Share Achievement",
  size = "default",
  variant = "default",
  className,
}: ShareAchievementButtonProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [achievement, setAchievement] =
    React.useState<ShareableAchievementDto | null>(null)

  const createMutation = useMutation({
    mutationFn: async (input: CreateAchievementInput) =>
      api<ShareableAchievementDto>("/api/achievements", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (created) => {
      setAchievement(created)
      setOpen(true)
      // Invalidate any list of the user's achievements so other UI stays fresh.
      queryClient.invalidateQueries({ queryKey: ["achievements"] })
      onShared?.(created)
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't create the share card. Please try again.",
      )
    },
  })

  const handleClick = React.useCallback(() => {
    if (createMutation.isPending) return
    createMutation.mutate(achievementInput)
  }, [achievementInput, createMutation])

  // If the host explicitly wants to hide the button (e.g., result not published),
  // render nothing — the host can pass `null` to disable.
  if (disabledReason === "__HIDE__" || achievementInput == null) return null

  const trigger = (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn(
        "bg-emerald-600 text-white hover:bg-emerald-700",
        "shadow-sm",
        className,
      )}
      onClick={handleClick}
      disabled={createMutation.isPending || !!disabledReason}
      aria-label={label}
    >
      {createMutation.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      <span className="hidden sm:inline">✨</span>
      {label}
    </Button>
  )

  if (disabledReason) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>
            <p>{disabledReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <>
      {trigger}
      <ShareAchievementModal
        achievement={achievement}
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) {
            // Allow the parent to react to a completed share session.
            if (achievement) onShared?.(achievement)
          }
        }}
      />
    </>
  )
}
