'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ShieldCheck,
  Smartphone,
  KeyRound,
  CheckCircle2,
  Loader2,
  Lock,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface TotpSetupData {
  enabled: boolean
  secret?: string
  otpauthUri?: string
  qrCodeDataUrl?: string
}

export function SuperAdminSecurity({ onBack }: { onBack: () => void }) {
  const [setupData, setSetupData] = React.useState<TotpSetupData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [verifyCode, setVerifyCode] = React.useState('')
  const [verifying, setVerifying] = React.useState(false)
  const [disabling, setDisabling] = React.useState(false)
  const [disableCode, setDisableCode] = React.useState('')

  // Load current TOTP status
  const loadStatus = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/totp/setup')
      const data = await res.json()
      setSetupData(data)
    } catch {
      toast.error('Failed to load TOTP status')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifyCode || verifyCode.length !== 6 || !setupData?.secret) return
    setVerifying(true)
    try {
      const res = await fetch('/api/auth/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: setupData.secret, token: verifyCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Invalid code')
        return
      }
      toast.success('Two-factor authentication enabled!')
      setVerifyCode('')
      await loadStatus()
    } catch {
      toast.error('Failed to verify code')
    } finally {
      setVerifying(false)
    }
  }

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!disableCode || disableCode.length !== 6) return
    setDisabling(true)
    try {
      const res = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: disableCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to disable TOTP')
        return
      }
      toast.success('Two-factor authentication disabled.')
      setDisableCode('')
      await loadStatus()
    } catch {
      toast.error('Failed to disable TOTP')
    } finally {
      setDisabling(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-amber-200/20 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <CardTitle className="text-2xl text-white">
                  Security Settings
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Configure two-factor authentication (2FA) for your super admin account.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-amber-500" />
              </div>
            ) : setupData?.enabled ? (
              // ─── TOTP is already enabled — show disable option ─────────
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <CheckCircle2 className="size-6 text-emerald-400" />
                  <div>
                    <p className="font-semibold text-emerald-300">
                      Two-factor authentication is enabled
                    </p>
                    <p className="text-sm text-slate-400">
                      Your account is protected with TOTP 2FA. You&apos;ll need
                      your authenticator app to sign in.
                    </p>
                  </div>
                </div>
                <form onSubmit={handleDisable} className="space-y-3">
                  <Label htmlFor="disable-code" className="text-slate-300">
                    Enter a TOTP code to disable 2FA
                  </Label>
                  <Input
                    id="disable-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="border-slate-700 bg-slate-800 text-center text-2xl font-bold tracking-[0.5em] text-white"
                  />
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={disabling || disableCode.length !== 6}
                    className="w-full"
                  >
                    {disabling ? (
                      <><Loader2 className="size-4 animate-spin" /> Disabling…</>
                    ) : (
                      <>Disable 2FA</>
                    )}
                  </Button>
                </form>
              </div>
            ) : setupData?.qrCodeDataUrl ? (
              // ─── TOTP setup — show QR code ────────────────────────────
              <div className="space-y-5">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <Smartphone className="mt-0.5 size-5 shrink-0 text-amber-400" />
                    <div>
                      <p className="font-medium text-amber-200">
                        Set up your authenticator app
                      </p>
                      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
                        <li>Open Google Authenticator, Authy, 1Password, or any TOTP app.</li>
                        <li>Tap &quot;Add account&quot; → &quot;Scan QR code&quot;.</li>
                        <li>Scan the QR code below.</li>
                        <li>Enter the 6-digit code the app generates to confirm.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="rounded-xl bg-white p-4">
                  <img
                    src={setupData.qrCodeDataUrl}
                    alt="TOTP QR code"
                    className="size-56"
                  />
                  </div>
                </div>

                {/* Manual entry fallback */}
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <p className="text-xs font-medium text-slate-400">
                    Can&apos;t scan? Enter this code manually:
                  </p>
                  <code className="mt-1 block break-all rounded bg-slate-950 px-2 py-1.5 font-mono text-sm text-amber-300">
                    {setupData.secret}
                  </code>
                </div>

                {/* Verify code */}
                <form onSubmit={handleVerify} className="space-y-3">
                  <Label htmlFor="verify-code" className="text-slate-300">
                    Enter the 6-digit code from your app
                  </Label>
                  <Input
                    id="verify-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoFocus
                    className="border-slate-700 bg-slate-800 text-center text-2xl font-bold tracking-[0.5em] text-white"
                  />
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-amber-600 to-orange-500 text-white"
                    disabled={verifying || verifyCode.length !== 6}
                  >
                    {verifying ? (
                      <><Loader2 className="size-4 animate-spin" /> Verifying…</>
                    ) : (
                      <><KeyRound className="size-4" /> Enable 2FA</>
                    )}
                  </Button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <AlertCircle className="size-6 text-slate-400" />
                <p className="text-sm text-slate-300">
                  Unable to load TOTP setup. Make sure you&apos;re logged in as a super admin.
                </p>
              </div>
            )}

            <button
              onClick={onBack}
              className="flex w-full items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
            >
              <Lock className="size-3.5" /> Back to Super Admin Panel
            </button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
