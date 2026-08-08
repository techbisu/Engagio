import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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
 * Returns `{ published: number }` (count of attempts newly published).
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
    if (quizLinkId) {
      // Verify the quiz link exists.
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
        select: { id: true, status: true, publishedAt: true },
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
    }

    return NextResponse.json({ published: publishedCount });
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
 * Returns `{ unpublished: number }` (count of attempts newly unpublished).
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
