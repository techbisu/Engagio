import { NextRequest, NextResponse } from "next/server";
import {
  verifyStripeSignature,
  isWebhookProcessed,
  recordWebhookProcessed,
  transitionSubscription,
} from "@/lib/billing-webhooks";

const SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/** Stripe subscription status → Engagio Subscription.status. */
const STRIPE_STATUS: Record<string, string> = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  unpaid: "PAST_DUE",
  incomplete: "PAST_DUE",
  incomplete_expired: "CANCELED",
  canceled: "CANCELED",
  paused: "PAST_DUE",
};

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe billing events (customer.subscription.*, invoice.*).
 * - Verifies the `stripe-signature` header (HMAC over `t.<rawBody>`),
 *   rejecting anything that doesn't verify (fail closed).
 * - Dedupes by provider event id via WebhookEvent: the check happens BEFORE
 *   processing and the record only AFTER a terminal outcome, so a failed
 *   process (500) is retried by Stripe instead of being swallowed.
 * - Transitions the org's Subscription (ACTIVE/PAST_DUE/TRIALING/CANCELED).
 *
 * Requires STRIPE_WEBHOOK_SECRET to be configured; returns 501 when absent
 * so misconfigured deploys surface loudly instead of silently accepting
 * events.
 */
export async function POST(req: NextRequest) {
  if (!SECRET) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 501 }
    );
  }

  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId: string | undefined = payload?.id;
  const type: string | undefined = payload?.type;
  if (!eventId || !type) {
    return NextResponse.json({ error: "Missing event id/type" }, { status: 400 });
  }

  // Idempotency: acknowledge (without re-processing) events already handled.
  if (await isWebhookProcessed("stripe", eventId)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const obj = payload?.data?.object ?? {};
    // Subscription events carry the subscription id on the object itself;
    // invoice events reference it via `obj.subscription`.
    const providerSubscriptionId: string | null =
      typeof obj?.id === "string" && type.startsWith("customer.subscription.")
        ? obj.id
        : typeof obj?.subscription === "string"
          ? obj.subscription
          : null;

    if (!providerSubscriptionId) {
      // Unhandled event shape — acknowledge (and record) so Stripe stops
      // retrying.
      await recordWebhookProcessed("stripe", eventId, type);
      return NextResponse.json({ received: true });
    }

    let status: string | null = null;
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;

    if (type.startsWith("customer.subscription.")) {
      status = STRIPE_STATUS[obj?.status] ?? null;
      if (typeof obj?.current_period_start === "number") {
        periodStart = new Date(obj.current_period_start * 1000);
      }
      if (typeof obj?.current_period_end === "number") {
        periodEnd = new Date(obj.current_period_end * 1000);
      }
    } else if (type === "invoice.payment_succeeded") {
      status = "ACTIVE";
      if (typeof obj?.period_start === "number") periodStart = new Date(obj.period_start * 1000);
      if (typeof obj?.period_end === "number") periodEnd = new Date(obj.period_end * 1000);
    } else if (type === "invoice.payment_failed") {
      status = "PAST_DUE";
    } else {
      // Known-but-unhandled type (e.g. customer.subscription.trial_will_end).
      await recordWebhookProcessed("stripe", eventId, type);
      return NextResponse.json({ received: true });
    }

    if (!status) {
      await recordWebhookProcessed("stripe", eventId, type);
      return NextResponse.json({ received: true });
    }

    const transitioned = await transitionSubscription(
      providerSubscriptionId,
      status,
      periodStart,
      periodEnd
    );
    // Record regardless of whether a local row matched — the event was
    // handled either way.
    await recordWebhookProcessed("stripe", eventId, type);

    if (!transitioned) {
      // No matching subscription row (e.g. a subscription created outside
      // Engagio). Acknowledge so the provider stops retrying.
      return NextResponse.json({ received: true, ignored: true });
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[webhook/stripe] processing failed:", e);
    // 500 → Stripe retries; the dedupe row is only written on success.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

// Only POST is supported — return 405 for anything else.
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
