/**
 * Shared helpers for the Stripe/Razorpay webhook handlers.
 *
 * Both verifications are raw, dependency-free implementations:
 *  - Stripe:  `v1 = HMAC_SHA256(secret, t + "." + rawBody)` compared against
 *    the `v1` value in the `stripe-signature` header, with a 5-minute
 *    timestamp replay window.
 *  - Razorpay: `x-razorpay-signature = HMAC_SHA256(rawBody, secret)`.
 *
 * Both fail closed: any verification error rejects the request (400), and
 * billing state is never changed unless the signature checks out. The
 * provider event id is deduped via the WebhookEvent table so retried
 * deliveries are acknowledged without being re-processed.
 */

import { createHmac, timingSafeEqual } from "crypto"
import { db } from "./db"

/**
 * Verify a Stripe webhook signature.
 * Header format: `t=<timestamp>,v1=<hex>[,v0=...]`
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false
  const parts: Record<string, string> = {}
  for (const pair of signatureHeader.split(",")) {
    const idx = pair.indexOf("=")
    if (idx > 0) parts[pair.slice(0, idx)] = pair.slice(idx + 1)
  }
  const ts = parts.t
  const sig = parts.v1
  if (!ts || !sig) return false

  // Replay protection: reject signatures older than 5 minutes.
  const tsMs = Number(ts) * 1000
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
    return false
  }

  const expected = createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex")
  return safeEqualHex(expected, sig)
}

/**
 * Verify a Razorpay webhook signature.
 * `x-razorpay-signature` = HMAC_SHA256(rawBody, webhookSecret) hex.
 */
export function verifyRazorpaySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  return safeEqualHex(expected, signatureHeader)
}

function safeEqualHex(expectedHex: string, providedHex: string): boolean {
  try {
    const a = Buffer.from(expectedHex, "hex")
    const b = Buffer.from(providedHex, "hex")
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * True when this provider event id was already handled.
 * Read-only check used BEFORE processing: a 500 during processing must not
 * record the dedupe row, otherwise the provider's retry would be swallowed.
 */
export async function isWebhookProcessed(
  provider: "stripe" | "razorpay",
  eventId: string
): Promise<boolean> {
  const existing = await db.webhookEvent.findUnique({
    where: { provider_eventId: { provider, eventId } },
    select: { id: true },
  })
  return !!existing
}

/**
 * Record that a provider event was fully handled. Called only after a
 * successful terminal outcome. A unique-violation race (two concurrent
 * deliveries) is harmless — both applied the same idempotent transition.
 */
export async function recordWebhookProcessed(
  provider: "stripe" | "razorpay",
  eventId: string,
  type?: string | null
): Promise<void> {
  try {
    await db.webhookEvent.create({
      data: { provider, eventId, type: type || null },
    })
  } catch (e) {
    console.error(`[webhook] failed to record ${provider} event ${eventId}:`, e)
  }
}

/**
 * Transition a Subscription row to the given status, optionally updating
 * the billing period. Returns false when no row matches the provider id.
 */
export async function transitionSubscription(
  providerSubscriptionId: string,
  status: string,
  periodStart?: Date | null,
  periodEnd?: Date | null
): Promise<boolean> {
  const subscription = await db.subscription.findUnique({
    where: { providerSubscriptionId },
    select: { id: true, currentPeriodStart: true, currentPeriodEnd: true },
  })
  if (!subscription) return false
  await db.subscription.update({
    where: { id: subscription.id },
    data: {
      status,
      currentPeriodStart: periodStart ?? subscription.currentPeriodStart,
      currentPeriodEnd: periodEnd ?? subscription.currentPeriodEnd,
    },
  })
  return true
}
