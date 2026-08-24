import { NextRequest, NextResponse } from "next/server";
import {
  verifyRazorpaySignature,
  isWebhookProcessed,
  recordWebhookProcessed,
  transitionSubscription,
} from "@/lib/billing-webhooks";

const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

/** Razorpay subscription status → Engagio Subscription.status. */
const RAZORPAY_SUB_STATUS: Record<string, string> = {
  created: "TRIALING",
  authenticated: "TRIALING",
  active: "ACTIVE",
  paused: "PAST_DUE",
  halted: "PAST_DUE",
  completed: "CANCELED",
  cancelled: "CANCELED",
};

/** Razorpay invoice status → Engagio Subscription.status. */
const RAZORPAY_INVOICE_STATUS: Record<string, string> = {
  paid: "ACTIVE",
  partially_paid: "PAST_DUE",
  failed: "PAST_DUE",
  expired: "CANCELED",
};

/**
 * POST /api/webhooks/razorpay
 *
 * Handles Razorpay billing events (subscription.*, invoice.*).
 * - Verifies the `x-razorpay-signature` header (HMAC-SHA256 over the raw
 *   body), rejecting anything that doesn't verify (fail closed).
 * - Dedupes by provider event id via WebhookEvent: check BEFORE processing,
 *   record only AFTER a terminal outcome (500s are retried by Razorpay).
 * - Transitions the org's Subscription (ACTIVE/PAST_DUE/TRIALING/CANCELED).
 *
 * Requires RAZORPAY_WEBHOOK_SECRET to be configured; returns 501 when absent
 * so misconfigured deploys surface loudly instead of silently accepting
 * events.
 */
export async function POST(req: NextRequest) {
  if (!SECRET) {
    return NextResponse.json(
      { error: "RAZORPAY_WEBHOOK_SECRET not configured" },
      { status: 501 }
    );
  }

  const raw = await req.text();
  if (!verifyRazorpaySignature(raw, req.headers.get("x-razorpay-signature"), SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId: string | undefined = payload?.event_id;
  const type: string | undefined = payload?.event;
  if (!eventId || !type) {
    return NextResponse.json({ error: "Missing event id/type" }, { status: 400 });
  }

  // Idempotency: acknowledge (without re-processing) events already handled.
  if (await isWebhookProcessed("razorpay", eventId)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    let providerSubscriptionId: string | null = null;
    let status: string | null = null;
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;

    if (type.startsWith("subscription.")) {
      const entity = payload?.payload?.subscription?.entity ?? {};
      providerSubscriptionId =
        typeof entity?.id === "string" ? entity.id : null;
      status = RAZORPAY_SUB_STATUS[entity?.status] ?? null;
      if (typeof entity?.start_at === "number") periodStart = new Date(entity.start_at * 1000);
      if (typeof entity?.end_at === "number") periodEnd = new Date(entity.end_at * 1000);
    } else if (type.startsWith("invoice.")) {
      const entity = payload?.payload?.invoice?.entity ?? {};
      providerSubscriptionId =
        typeof entity?.subscription_id === "string" ? entity.subscription_id : null;
      status = RAZORPAY_INVOICE_STATUS[entity?.status] ?? null;
      if (typeof entity?.billing_start === "number") periodStart = new Date(entity.billing_start * 1000);
      if (typeof entity?.billing_end === "number") periodEnd = new Date(entity.billing_end * 1000);
    }

    if (!providerSubscriptionId || !status) {
      // Unhandled event type/shape — acknowledge (and record) so Razorpay
      // stops retrying.
      await recordWebhookProcessed("razorpay", eventId, type);
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
    await recordWebhookProcessed("razorpay", eventId, type);

    if (!transitioned) {
      return NextResponse.json({ received: true, ignored: true });
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[webhook/razorpay] processing failed:", e);
    // 500 → Razorpay retries; the dedupe row is only written on success.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

// Only POST is supported — return 405 for anything else.
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
