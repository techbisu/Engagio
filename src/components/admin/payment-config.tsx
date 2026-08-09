"use client"

import * as React from "react"
import {
  Banknote,
  CreditCard,
  ReceiptIndianRupee,
  Sparkles,
  Wallet,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { CloudinaryImageUpload } from "@/components/shared/cloudinary-image-upload"

import type { EventDto, PaymentMethod } from "@/types"

/**
 * Props for PaymentConfig.
 *
 * - `event`: the current event being edited (or a partial new-event form).
 *   The component reads payment-related fields off this object.
 * - `onChange`: called with the full payment config payload on every change.
 *   The parent merges this into the form state and includes it in the
 *   PATCH /api/events/[id] request body.
 */
export interface PaymentConfigValue {
  paymentMethod: PaymentMethod
  paymentAmount: number // paise (INR)
  paymentCurrency: string
  paymentInstructions: string
  upiId: string
  upiLink: string
  qrCodeUrl: string // Cloudinary URL (or base64 data URL fallback)
  qrCodePublicId: string | null // Cloudinary publicId for delete-on-replace
  requireTransactionRef: boolean
  requireScreenshot: boolean
}

export interface PaymentConfigProps {
  event: Pick<
    EventDto,
    | "paymentMethod"
    | "paymentAmount"
    | "paymentCurrency"
    | "paymentInstructions"
    | "upiId"
    | "upiLink"
    | "qrCodeUrl"
    | "qrCodePublicId"
    | "requireTransactionRef"
    | "requireScreenshot"
  >
  onChange: (value: PaymentConfigValue) => void
  /** Show only the radio selector (used for create dialog to keep it compact). */
  compact?: boolean
}

function rupeesToPaise(rupees: string): number {
  const n = Number(rupees)
  if (!isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function paiseToRupees(paise: number): string {
  const r = (paise ?? 0) / 100
  // Render integers without a decimal tail; otherwise show 2dp.
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

const METHOD_META: Record<
  PaymentMethod,
  { label: string; icon: typeof Wallet; hint: string }
> = {
  FREE: {
    label: "Free",
    icon: Sparkles,
    hint: "No registration fee — anyone with the quiz link can join.",
  },
  RAZORPAY: {
    label: "Razorpay",
    icon: CreditCard,
    hint: "Gateway integration coming soon. For now, use Manual Payment to collect fees.",
  },
  STRIPE: {
    label: "Stripe",
    icon: CreditCard,
    hint: "Gateway integration coming soon. For now, use Manual Payment to collect fees.",
  },
  MANUAL: {
    label: "Custom (Manual UPI)",
    icon: ReceiptIndianRupee,
    hint: "Collect payment via UPI and verify each submission manually.",
  },
}

const METHOD_ORDER: PaymentMethod[] = ["FREE", "MANUAL", "RAZORPAY", "STRIPE"]

export function PaymentConfig({
  event,
  onChange,
  compact = false,
}: PaymentConfigProps) {
  const method = (event.paymentMethod ?? "FREE") as PaymentMethod

  const [amountRupees, setAmountRupees] = React.useState(
    paiseToRupees(event.paymentAmount ?? 0),
  )

  // Keep the displayed rupee input in sync when the event prop changes
  // (e.g. when the admin opens the edit dialog for a different event).
  React.useEffect(() => {
    setAmountRupees(paiseToRupees(event.paymentAmount ?? 0))
  }, [event.paymentAmount])

  // Emit the full payment config whenever any sub-field changes.
  const emit = React.useCallback(
    (patch: Partial<PaymentConfigValue>) => {
      const next: PaymentConfigValue = {
        paymentMethod: (patch.paymentMethod ?? event.paymentMethod ?? "FREE") as PaymentMethod,
        paymentAmount: patch.paymentAmount ?? event.paymentAmount ?? 0,
        paymentCurrency: patch.paymentCurrency ?? event.paymentCurrency ?? "INR",
        paymentInstructions:
          patch.paymentInstructions ??
          (event.paymentInstructions ?? ""),
        upiId: patch.upiId ?? (event.upiId ?? ""),
        upiLink: patch.upiLink ?? (event.upiLink ?? ""),
        qrCodeUrl: patch.qrCodeUrl ?? (event.qrCodeUrl ?? ""),
        qrCodePublicId:
          patch.qrCodePublicId !== undefined
            ? patch.qrCodePublicId
            : (event.qrCodePublicId ?? null),
        requireTransactionRef:
          patch.requireTransactionRef ?? (event.requireTransactionRef ?? true),
        requireScreenshot:
          patch.requireScreenshot ?? (event.requireScreenshot ?? true),
      }
      onChange(next)
    },
    [event, onChange],
  )

  // ---- Render ------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Payment Method selector */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Payment Method</Label>
        <div
          role="radiogroup"
          aria-label="Payment method"
          className={cn(
            "grid gap-2",
            compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4",
          )}
        >
          {METHOD_ORDER.map((m) => {
            const meta = METHOD_META[m]
            const Icon = meta.icon
            const active = method === m
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => emit({ paymentMethod: m })}
                className={cn(
                  "group flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                  active
                    ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-500/10"
                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <Icon
                    className={cn(
                      "size-4",
                      active
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300",
                    )}
                  />
                  <span
                    className={cn(
                      "size-3 rounded-full border-2",
                      active
                        ? "border-emerald-600 bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-400"
                        : "border-slate-300 dark:border-slate-600",
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-sm font-medium leading-tight",
                    active
                      ? "text-emerald-900 dark:text-emerald-200"
                      : "text-slate-700 dark:text-slate-200",
                  )}
                >
                  {meta.label}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {METHOD_META[method].hint}
        </p>
      </div>

      {/* Gateway placeholder note */}
      {(method === "RAZORPAY" || method === "STRIPE") && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">
            {METHOD_META[method].label} integration is coming soon.
          </p>
          <p className="mt-0.5 text-xs">
            To collect fees right now, switch to <strong>Custom (Manual UPI)</strong>
            . Participants will see your UPI ID / QR and upload a payment
            screenshot, which you verify from the Payments panel.
          </p>
        </div>
      )}

      {/* Manual payment config */}
      {method === "MANUAL" && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
          {/* Amount + Currency */}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount" className="text-sm font-medium">
                Payment Amount (₹)
              </Label>
              <div className="relative">
                <Banknote className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="pay-amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="1"
                  value={amountRupees}
                  onChange={(e) => {
                    setAmountRupees(e.target.value)
                    emit({ paymentAmount: rupeesToPaise(e.target.value) })
                  }}
                  placeholder="499"
                  className="pl-9"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Stored as paise (₹{amountRupees || "0"} ={" "}
                {rupeesToPaise(amountRupees)} paise).
              </p>
            </div>
            <div className="space-y-1.5 sm:w-24">
              <Label htmlFor="pay-currency" className="text-sm font-medium">
                Currency
              </Label>
              <Input
                id="pay-currency"
                value="INR"
                disabled
                className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-instructions" className="text-sm font-medium">
              Payment Instructions
            </Label>
            <Textarea
              id="pay-instructions"
              rows={3}
              value={event.paymentInstructions ?? ""}
              onChange={(e) => emit({ paymentInstructions: e.target.value })}
              placeholder="Pay ₹499 using the UPI ID below and upload the screenshot. Your registration will be verified within a few minutes."
            />
            <p className="text-[11px] text-muted-foreground">
              Shown to the participant before they proceed to pay.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* UPI ID */}
            <div className="space-y-1.5">
              <Label htmlFor="upi-id" className="text-sm font-medium">
                UPI ID
              </Label>
              <Input
                id="upi-id"
                value={event.upiId ?? ""}
                onChange={(e) => emit({ upiId: e.target.value })}
                placeholder="event@upi"
                autoComplete="off"
              />
            </div>

            {/* UPI Link */}
            <div className="space-y-1.5">
              <Label htmlFor="upi-link" className="text-sm font-medium">
                UPI Payment Link
              </Label>
              <Input
                id="upi-link"
                value={event.upiLink ?? ""}
                onChange={(e) => emit({ upiLink: e.target.value })}
                placeholder="upi://pay?pa=event@upi&pn=Engagio"
                autoComplete="off"
              />
            </div>
          </div>

          {/* QR Code upload (CloudinaryImageUpload handles compression,
              progress, replace + remove, and validation) */}
          <CloudinaryImageUpload
            value={event.qrCodeUrl ?? ""}
            publicId={event.qrCodePublicId ?? null}
            onChange={(url, publicId) =>
              emit({ qrCodeUrl: url, qrCodePublicId: publicId })
            }
            folder="events/qr"
            label="QR Code Image"
            description="PNG / JPG / WebP — auto-compressed before upload. Square image works best."
            aspectRatio="1/1"
            maxSize={2 * 1024 * 1024}
          />

          {/* Toggles */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="space-y-0.5">
                <Label htmlFor="req-tx" className="cursor-pointer text-sm font-medium">
                  Require Transaction ID
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Participant must enter the UTR / Txn Ref.
                </p>
              </div>
              <Switch
                id="req-tx"
                checked={event.requireTransactionRef ?? true}
                onCheckedChange={(v) => emit({ requireTransactionRef: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="space-y-0.5">
                <Label htmlFor="req-ss" className="cursor-pointer text-sm font-medium">
                  Require Screenshot
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Participant must upload a payment screenshot.
                </p>
              </div>
              <Switch
                id="req-ss"
                checked={event.requireScreenshot ?? true}
                onCheckedChange={(v) => emit({ requireScreenshot: v })}
              />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md bg-slate-100 p-2.5 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            <Wallet className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <strong>Reminder:</strong> The screenshot is proof submitted for
              manual verification — it does not auto-mark the participant as paid.
              You approve each payment from the <em>Payments</em> panel.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
