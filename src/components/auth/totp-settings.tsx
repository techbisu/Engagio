'use client'

import * as React from "react"
import { toast } from "sonner"
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface TotpSettingsProps {
  enabled: boolean
  onStatusChange?: () => void
}

export function TotpSettings({ enabled: init, onStatusChange }: TotpSettingsProps) {
  const [enabled, setEnabled] = React.useState(init)
  const [loading, setLoading] = React.useState(false)
  const [step, setStep] = React.useState<"idle" | "setup">("idle")
  const [qrCode, setQrCode] = React.useState("")
  const [secret, setSecret] = React.useState("")
  const [code, setCode] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const [confirmCode, setConfirmCode] = React.useState("")

  React.useEffect(() => { setEnabled(init) }, [init])

  const handleSetup = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/auth/totp/setup")
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "Failed"); return }
      if (d.enabled) { setEnabled(true); toast.info("TOTP already enabled."); return }
      setQrCode(d.qrCodeDataUrl); setSecret(d.secret); setStep("setup")
    } catch { toast.error("Failed to set up TOTP") } finally { setLoading(false) }
  }

  const handleVerify = async () => {
    if (!code || code.length !== 6) { toast.error("Enter a 6-digit code"); return }
    setLoading(true)
    try {
      const r = await fetch("/api/auth/totp/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, token: code }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "Invalid code"); return }
      setEnabled(true); setStep("idle"); setCode(""); setQrCode(""); setSecret("")
      toast.success("Two-factor authentication enabled!")
      onStatusChange?.()
    } catch { toast.error("Failed to verify") } finally { setLoading(false) }
  }

  const handleDisable = async () => {
    if (!confirmCode || confirmCode.length !== 6) { toast.error("Enter your TOTP code"); return }
    setLoading(true)
    try {
      const r = await fetch("/api/auth/totp/disable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: confirmCode }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || "Failed"); return }
      setEnabled(false); setConfirmCode("")
      toast.success("Two-factor authentication disabled.")
      onStatusChange?.()
    } catch { toast.error("Failed to disable") } finally { setLoading(false) }
  }

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
            <CardDescription>Add an extra layer of security with an authenticator app.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                <ShieldCheck className="mr-1 size-3" /> Enabled
              </Badge>
              <span className="text-sm text-muted-foreground">Your account is protected with TOTP 2FA.</span>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">To disable 2FA, enter your current authenticator code.</p>
              <div className="flex gap-2">
                <Input type="text" placeholder="6-digit code" value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6} className="w-32 font-mono" />
                <Button variant="destructive" onClick={handleDisable} disabled={confirmCode.length !== 6 || loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />} Disable 2FA
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline"><ShieldOff className="mr-1 size-3" /> Not enabled</Badge>
              <span className="text-sm text-muted-foreground">Two-factor authentication is not set up yet.</span>
            </div>
            {step === "idle" ? (
              <Button onClick={handleSetup} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Enable 2FA
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-dashed border-border p-4">
                  <p className="mb-3 text-sm font-medium">1. Scan this QR code with your authenticator app</p>
                  <div className="flex justify-center">
                    {qrCode && <img src={qrCode} alt="TOTP QR Code" className="rounded-lg" />}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Or enter this code manually:</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-2 py-1 text-xs font-mono break-all">{secret}</code>
                    <Button variant="ghost" size="sm" onClick={copySecret}>
                      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totp-code">2. Enter the 6-digit code from your app</Label>
                  <div className="flex gap-2">
                    <Input id="totp-code" type="text" placeholder="000000" value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      maxLength={6} className="w-32 font-mono" />
                    <Button onClick={handleVerify} disabled={code.length !== 6 || loading}>
                      {loading ? <Loader2 className="size-4 animate-spin" /> : "Verify & Enable"}
                    </Button>
                    <Button variant="ghost" onClick={() => { setStep("idle"); setCode(""); setQrCode(""); setSecret("") }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
