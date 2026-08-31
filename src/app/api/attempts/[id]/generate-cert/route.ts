import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateCertificate } from "@/lib/cert-service";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/attempts/[id]/generate-cert
 *
 * Called by the participant from the quiz results page ("Share your
 * participation certificate" button) or from the My Recent Attempts list
 * (share button). Generates a certificate on demand if the participant is
 * eligible and no cert exists yet. Idempotent — if a cert already exists,
 * returns it.
 *
 * Returns: { certificate: { certificateNumber, verificationToken, template,
 *                           recipientName, issuedAt } | null,
 *            reason: string }
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: attemptId } = await ctx.params;

    const attempt = await db.quizAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        eventId: true,
        userId: true,
        status: true,
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    // Only the attempt owner can generate a cert for it.
    if (attempt.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Must be a completed attempt (not IN_PROGRESS).
    if (attempt.status === "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Cannot generate certificate for an in-progress attempt" },
        { status: 400 }
      );
    }

    // Generate (or fetch existing) certificate. The eligibility check inside
    // generateCertificate handles certEnabled + certIssueCondition.
    const certResult = await generateCertificate({
      eventId: attempt.eventId,
      userId: session.user.id,
      attemptId: attempt.id,
    });

    if (!certResult.certificate) {
      return NextResponse.json(
        { certificate: null, reason: certResult.reason },
        { status: 200 } // 200 with null cert so the frontend can show the reason
      );
    }

    return NextResponse.json({
      certificate: {
        id: certResult.certificate.id,
        certificateNumber: certResult.certificate.certificateNumber,
        verificationToken: certResult.certificate.verificationToken,
        template: certResult.certificate.template,
        recipientName: certResult.certificate.recipientName,
        issuedAt:
          typeof certResult.certificate.issuedAt === "string"
            ? certResult.certificate.issuedAt
            : new Date(certResult.certificate.issuedAt).toISOString(),
      },
      reason: certResult.reason,
    });
  } catch (error) {
    console.error("[POST /api/attempts/[id]/generate-cert] error:", error);
    return NextResponse.json(
      { error: "Failed to generate certificate" },
      { status: 500 }
    );
  }
}
