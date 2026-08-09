"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * Global theme switcher — Light / Dark / System.
 * Uses next-themes (persisted in localStorage, respects system preference).
 *
 * Renders a compact icon button that opens a dropdown with 3 options.
 * Prevents hydration mismatch by mounting only after client-side render.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = React.useState(false)
  const { theme, setTheme } = useTheme()

  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={cn("size-9", className)} disabled>
        <Sun className="size-4" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("size-9", className)} aria-label="Toggle theme">
          {theme === "dark" ? (
            <Moon className="size-4" />
          ) : theme === "system" ? (
            <Monitor className="size-4" />
          ) : (
            <Sun className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 size-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 size-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 size-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
