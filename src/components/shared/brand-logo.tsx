'use client'

import { GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  className?: string
  /** Hide the wordmark, show only the icon square. */
  iconOnly?: boolean
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: { box: 'size-8', icon: 'size-4', text: 'text-base' },
  md: { box: 'size-9', icon: 'size-5', text: 'text-lg' },
  lg: { box: 'size-11', icon: 'size-6', text: 'text-xl' },
}

export function BrandLogo({ className, iconOnly = false, size = 'md' }: BrandLogoProps) {
  const s = sizeMap[size]
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative grid place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-600/20 ring-1 ring-inset ring-white/20',
          s.box
        )}
        aria-hidden="true"
      >
        <GraduationCap className={s.icon} strokeWidth={2.4} />
      </span>
      {!iconOnly && (
        <span className={cn('font-semibold tracking-tight text-foreground', s.text)}>
          QuizMaster{' '}
          <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
            Pro
          </span>
        </span>
      )}
    </span>
  )
}
