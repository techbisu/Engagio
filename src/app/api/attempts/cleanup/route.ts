import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/tenant";

/**
 * POST /api/attempts/cleanup
 *
 * Admin-only endpoint that marks ALL stale IN_PROGRESS attempts as TIMEOUT.
 * Called manually by admins or via a cron job.
 *
 * An attempt is considered stale if:
 *   - It has a time limit AND the time limit + 10 min grace has passed
 *   - It has NO time limit AND it's older than 24 hours
 *
 * This handles the common case where participants start a quiz but never
 * submit (close tab, lose connection, battery dies, etc.) — the attempt
 * stays IN_PROGRESS forever without this cleanup.
 *
 * When called with ?org=slug, only cleans up attempts for that org.
 *
 * Response: { cleaned: number, details: { byTimeLimit: number, byAge: number } }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Admin-only — requires analytics.view permission (any org admin)
    const auth = await requirePermission(req, "analytics.view");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        // Legacy admin — allow but no org filter
      } else {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Build the org filter (if the admin is scoped to an org)
    const orgFilter = auth.ok && auth.ctx?.orgId
      ? { event: { organizationId: auth.ctx.orgId } }
      : {};

    // ── Step 1: Clean up attempts with a time limit ─────────────────────
    // For each quiz link with a time limit, find IN_PROGRESS attempts older
    // than timeLimit + 10 min grace and mark them as TIMEOUT.
    const quizLinksWithTimeLimit = await db.quizLink.findMany({
      where: { timeLimit: { gt: 0 } },
      select: { id: true, timeLimit: true },
    });

    let cleanedByTimeLimit = 0;
    for (const ql of quizLinksWithTimeLimit) {
      const staleThreshold = new Date(now.getTime() - (ql.timeLimit + 10) * 60 * 1000);
      const result = await db.quizAttempt.updateMany({
        where: {
          quizLinkId: ql.id,
          status: "IN_PROGRESS",
          startedAt: { lt: staleThreshold },
          ...orgFilter,
        },
        data: {
          status: "TIMEOUT",
          completedAt: now,
        },
      });
      cleanedByTimeLimit += result.count;
    }

    // ── Step 2: Clean up attempts with NO time limit (older than 24h) ────
    const resultNoLimit = await db.quizAttempt.updateMany({
      where: {
        status: "IN_PROGRESS",
        startedAt: { lt: twentyFourHoursAgo },
        quizLink: { timeLimit: 0 },
        ...orgFilter,
      },
      data: {
        status: "TIMEOUT",
        completedAt: now,
      },
    });
    const cleanedByAge = resultNoLimit.count;

    const totalCleaned = cleanedByTimeLimit + cleanedByAge;

    return NextResponse.json({
      cleaned: totalCleaned,
      details: {
        byTimeLimit: cleanedByTimeLimit,
        byAge: cleanedByAge,
      },
    });
  } catch (e) {
    console.error("[POST /api/attempts/cleanup] error:", e);
    return NextResponse.json(
      { error: "Failed to clean up stale attempts" },
      { status: 500 }
    );
  }
}
