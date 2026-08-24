import { NextRequest, NextResponse } from "next/server";
import { getServerSession, isDbPlatformAdmin } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidatePlanCache } from "@/lib/entitlements";

const GRACE_DAYS = Number(process.env.BILLING_GRACE_DAYS ?? 7);
const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

/**
 * POST /api/platform/subscriptions/sweep
 *
 * Scheduled job (see vercel.json crons) that enforces subscription status
 * even when webhooks never arrive:
 *   - ACTIVE/TRIALING with currentPeriodEnd past the grace window → PAST_DUE
 *   - PAST_DUE past one full additional grace window → CANCELED
 *
 * This is the backstop for the "cancelled-but-not-webhooked org stays
 * ACTIVE forever" gap: status no longer only changes via webhook.
 *
 * Access: Vercel cron invocations (x-vercel-cron: 1), a `CRON_SECRET` bearer
 * token, or a DB-backed platform admin.
 */
export async function POST(req: NextRequest) {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const hasCronSecret =
    !!cronSecret && authHeader === `Bearer ${cronSecret}`;
  const session = await getServerSession(authOptions);
  const isAdmin = await isDbPlatformAdmin(session);

  if (!isVercelCron && !hasCronSecret && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const counts = { toPastDue: 0, toCanceled: 0, noPeriod: 0 };

  const subscriptions = await db.subscription.findMany({
    where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
    select: { id: true, status: true, currentPeriodEnd: true, organizationId: true },
  });

  for (const sub of subscriptions) {
    if (!sub.currentPeriodEnd) {
      counts.noPeriod++;
      continue;
    }
    const overdueMs = now - sub.currentPeriodEnd.getTime();

    if (sub.status === "ACTIVE" || sub.status === "TRIALING") {
      if (overdueMs > GRACE_MS) {
        await db.subscription.update({
          where: { id: sub.id },
          data: { status: "PAST_DUE" },
        });
        counts.toPastDue++;
      }
    } else if (sub.status === "PAST_DUE" && overdueMs > 2 * GRACE_MS) {
      await db.subscription.update({
        where: { id: sub.id },
        data: { status: "CANCELED" },
      });
      counts.toCanceled++;
      // Plan entitlement should fall back to FREE once canceled.
      invalidatePlanCache(sub.organizationId);
    }
  }

  return NextResponse.json({
    ok: true,
    graceDays: GRACE_DAYS,
    ...counts,
  });
}

// Only POST is supported.
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
