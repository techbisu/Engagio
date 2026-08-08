'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const sizeMap = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-8',
}

export function LoadingSpinner({ className, size = 'md', label }: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}
    >
      <Loader2 className={cn('animate-spin', sizeMap[size])} aria-hidden="true" />
      {label && <span className="text-sm">{label}</span>}
      <span className="sr-only">Loading…</span>
    </span>
  )
}
