'use client'

import * as React from 'react'
import { LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SignOutButtonProps = Omit<React.ComponentProps<typeof Button>, 'onClick'> & {
  onSignedOut: () => void
  children?: React.ReactNode
}

export function SignOutButton({
  onSignedOut,
  children = 'Sign Out',
  variant = 'ghost',
  className,
  ...props
}: SignOutButtonProps) {
  const [loading, setLoading] = React.useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await signOut({ redirect: false })
    } finally {
      setLoading(false)
      onSignedOut()
    }
  }

  return (
    <Button
      variant={variant}
      onClick={handleSignOut}
      disabled={loading}
      className={cn(className)}
      {...props}
    >
      <LogOut className="size-4" aria-hidden="true" />
      {children}
    </Button>
  )
}
