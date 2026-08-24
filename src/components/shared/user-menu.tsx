'use client'

import * as React from 'react'
import { LayoutDashboard, LogOut, ShieldCheck, Trophy } from 'lucide-react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { initials } from '@/lib/utils'
import type { SafeUser } from '@/types'

interface UserMenuProps {
  user: SafeUser
  onNavigate: (view: 'admin' | 'student' | 'results') => void
  onSignOut: () => void
  align?: 'start' | 'center' | 'end'
}

export function UserMenu({
  user,
  onNavigate,
  onSignOut,
  align = 'end',
}: UserMenuProps) {
  // Org access is membership-based (canManageOrg), not the legacy global role.
  const isAdmin = user.canManageOrg === true

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 gap-2 rounded-full pl-1.5 pr-3 hover:bg-accent"
          aria-label="Open user menu"
        >
          <Avatar className="size-8 ring-2 ring-emerald-500/30 ring-offset-2 ring-offset-background">
            {user.image ? (
              <AvatarImage src={user.image} alt={user.name || user.email} />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
              {initials(user.name) || user.email[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline-block">
            {user.name || user.email.split('@')[0]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium leading-none">
            {user.name || 'Account'}
          </span>
          <span className="text-xs text-muted-foreground leading-none">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onNavigate(isAdmin ? 'admin' : 'student')}
        >
          {isAdmin ? (
            <ShieldCheck className="text-emerald-600" aria-hidden="true" />
          ) : (
            <LayoutDashboard className="text-emerald-600" aria-hidden="true" />
          )}
          <span>{isAdmin ? 'Admin Panel' : 'My Dashboard'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onNavigate('results')}>
          <Trophy className="text-emerald-600" aria-hidden="true" />
          <span>My Results</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onSignOut}>
          <LogOut aria-hidden="true" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
