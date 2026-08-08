import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  autoGenerateCertificates,
  sendPublishNotifications,
} from "@/lib/cert-service";

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

/**
 * POST /api/attempts/publish
 *
 * Admin-only endpoint for publishing (or re-publishing) completed attempts.
 *
 * Body:
 *   - { quizLinkId: string } — publish ALL unpublished completed attempts for this link.
 *   - { attemptId: string }  — publish a single attempt.
 *
 * Returns `{ published: number, emailsSent: number, certsGenerated: number }`.
 *
 * After publishing:
 *   1. If the quiz link's `emailOnPublish` is true, send a "result published"
 *      email to each participant whose result was just published.
 *   2. If the event's `certAutoGenerate` is true, auto-generate certificates
 *      for all eligible participants (idempotent — skips those with existing certs).
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const { quizLinkId, attemptId } = body || {};

    if (!quizLinkId && !attemptId) {
      return NextResponse.json(
        { error: "Provide either quizLinkId or attemptId" },
        { status: 400 }
      );
    }
    if (quizLinkId && attemptId) {
      return NextResponse.json(
        { error: "Provide only one of quizLinkId or attemptId" },
        { status: 400 }
      );
    }

    let publishedCount = 0;
    let publishedAttemptIds: string[] = [];
    let targetQuizLinkId = quizLinkId;
    let targetEventId: string | undefined;

    if (quizLinkId) {
      // Verify the quiz link exists + capture eventId for cert auto-gen.
      const link = await db.quizLink.findUnique({
        where: { id: quizLinkId },
        select: { id: true, eventId: true },
      });
      if (!link) {
        return NextResponse.json(
          { error: "Quiz link not found" },
          { status: 404 }
        );
      }
      targetEventId = link.eventId;

      // Find the attempts that WILL be published (for email targeting)
      const toPublish = await db.quizAttempt.findMany({
        where: {
          quizLinkId,
          status: "COMPLETED",
          publishedAt: null,
        },
        select: { id: true },
      });
      publishedAttemptIds = toPublish.map((a) => a.id);

      const result = await db.quizAttempt.updateMany({
        where: {
          quizLinkId,
          status: "COMPLETED",
          publishedAt: null,
        },
        data: { publishedAt: new Date() },
      });
      publishedCount = result.count;
    } else {
      const attempt = await db.quizAttempt.findUnique({
        where: { id: attemptId },
        select: { id: true, status: true, publishedAt: true, quizLinkId: true, eventId: true },
      });
      if (!attempt) {
        return NextResponse.json(
          { error: "Attempt not found" },
          { status: 404 }
        );
      }
      if (attempt.status !== "COMPLETED") {
        return NextResponse.json(
          { error: "Cannot publish an attempt that is not COMPLETED" },
          { status: 400 }
        );
      }
      if (attempt.publishedAt) {
        return NextResponse.json({ published: 0 });
      }
      await db.quizAttempt.update({
        where: { id: attemptId },
        data: { publishedAt: new Date() },
      });
      publishedCount = 1;
      publishedAttemptIds = [attemptId];
      targetQuizLinkId = attempt.quizLinkId;
      targetEventId = attempt.eventId;
    }

    // --- Side effects (non-blocking, errors logged but don't fail the publish) ---

    let emailsSent = 0;
    let certsGenerated = 0;

    if (publishedAttemptIds.length > 0 && targetQuizLinkId) {
      try {
        const emailResult = await sendPublishNotifications({
          quizLinkId: targetQuizLinkId,
          attemptIds: publishedAttemptIds,
        });
        emailsSent = emailResult.sent;
      } catch (e) {
        console.error("[publish] email notification error:", e);
      }
    }

    if (publishedAttemptIds.length > 0 && targetEventId) {
      try {
        const certResult = await autoGenerateCertificates(targetEventId);
        certsGenerated = certResult.generated;
      } catch (e) {
        console.error("[publish] auto-cert-generation error:", e);
      }
    }

    return NextResponse.json({
      published: publishedCount,
      emailsSent,
      certsGenerated,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/attempts/publish
 *
 * Admin-only endpoint for unpublishing attempts (clears `publishedAt`).
 *
 * Body:
 *   - { quizLinkId: string } — unpublish ALL published attempts for this link.
 *   - { attemptId: string }  — unpublish a single attempt.
 *
 * Returns `{ unpublished: number }`.
 *
 * NOTE: Unpublishing does NOT revoke already-generated certificates or
 * "unsend" emails. It only hides the results from the student's view again.
 */
export async function DELETE(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const { quizLinkId, attemptId } = body || {};

    if (!quizLinkId && !attemptId) {
      return NextResponse.json(
        { error: "Provide either quizLinkId or attemptId" },
        { status: 400 }
      );
    }
    if (quizLinkId && attemptId) {
      return NextResponse.json(
        { error: "Provide only one of quizLinkId or attemptId" },
        { status: 400 }
      );
    }

    let unpublishedCount = 0;
    if (quizLinkId) {
      const link = await db.quizLink.findUnique({
        where: { id: quizLinkId },
        select: { id: true },
      });
      if (!link) {
        return NextResponse.json(
          { error: "Quiz link not found" },
          { status: 404 }
        );
      }
      const result = await db.quizAttempt.updateMany({
        where: { quizLinkId, publishedAt: { not: null } },
        data: { publishedAt: null },
      });
      unpublishedCount = result.count;
    } else {
      const attempt = await db.quizAttempt.findUnique({
        where: { id: attemptId },
        select: { id: true, publishedAt: true },
      });
      if (!attempt) {
        return NextResponse.json(
          { error: "Attempt not found" },
          { status: 404 }
        );
      }
      if (!attempt.publishedAt) {
        return NextResponse.json({ unpublished: 0 });
      }
      await db.quizAttempt.update({
        where: { id: attemptId },
        data: { publishedAt: null },
      });
      unpublishedCount = 1;
    }

    return NextResponse.json({ unpublished: unpublishedCount });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
