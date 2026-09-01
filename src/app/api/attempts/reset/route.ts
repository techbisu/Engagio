import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, ownsResource } from "@/lib/tenant";
import { sendAttemptResetEmail } from "@/lib/email";

/**
 * POST /api/attempts/reset
 *
 * Admin-only endpoint that resets (deletes) a participant's quiz attempts
 * for a specific quiz link or event, so they can retake the quiz.
 *
 * Sends an email notification to the participant: "Your quiz attempts have
 * been reset by the organizer. You can now retake the quiz at {link}"
 *
 * Body: { userId, quizLinkId?, eventId? }
 *   - If quizLinkId is provided, only resets attempts for that quiz link.
 *   - If eventId is provided (no quizLinkId), resets all attempts for that event.
 *
 * Response: { reset: number, emailSent: boolean, message: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Admin-only — requires result.view permission
    const auth = await requirePermission(req, "result.view");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        // Legacy admin — allow
      } else {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
    }

    const body = await req.json();
    const { userId, quizLinkId, eventId } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!quizLinkId && !eventId) {
      return NextResponse.json(
        { error: "Either quizLinkId or eventId is required" },
        { status: 400 }
      );
    }

    // Build the where clause for the attempts to delete
    const where: any = { userId };

    // Fetch the event + quiz link info for the email + ownership check
    let eventTitle = "the quiz";
    let quizSlug: string | null = null;
    let eventOrgId: string | null = null;

    if (quizLinkId) {
      // Fetch the quiz link + event for ownership check + email content
      const quizLink = await db.quizLink.findUnique({
        where: { id: quizLinkId },
        select: {
          id: true,
          slug: true,
          eventId: true,
          event: {
            select: {
              id: true,
              title: true,
              organizationId: true,
            },
          },
        },
      });

      if (!quizLink) {
        return NextResponse.json(
          { error: "Quiz link not found" },
          { status: 404 }
        );
      }

      // Org ownership check
      if (quizLink.event.organizationId && auth.ctx) {
        if (!ownsResource({ organizationId: quizLink.event.organizationId }, auth.ctx)) {
          return NextResponse.json(
            { error: "Forbidden — this quiz link belongs to a different organization" },
            { status: 403 }
          );
        }
      }

      where.quizLinkId = quizLinkId;
      eventTitle = quizLink.event.title;
      quizSlug = quizLink.slug;
      eventOrgId = quizLink.event.organizationId;
    } else if (eventId) {
      // Fetch the event for ownership check + email content
      const event = await db.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          organizationId: true,
        },
      });

      if (!event) {
        return NextResponse.json(
          { error: "Event not found" },
          { status: 404 }
        );
      }

      // Org ownership check
      if (event.organizationId && auth.ctx) {
        if (!ownsResource({ organizationId: event.organizationId }, auth.ctx)) {
          return NextResponse.json(
            { error: "Forbidden — this event belongs to a different organization" },
            { status: 403 }
          );
        }
      }

      where.eventId = eventId;
      eventTitle = event.title;
      eventOrgId = event.organizationId;
    }

    // Count the attempts before deleting (for the response)
    const attemptCount = await db.quizAttempt.count({ where });

    if (attemptCount === 0) {
      return NextResponse.json({
        reset: 0,
        emailSent: false,
        message: "No attempts to reset for this participant.",
      });
    }

    // Also delete any certificates generated from these attempts
    // (so the participant doesn't keep a cert from a reset attempt)
    if (eventId) {
      await db.certificate.deleteMany({
        where: { userId, eventId },
      });
    }

    // Delete the attempts
    await db.quizAttempt.deleteMany({ where });

    // Fetch the participant's email for the notification
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    // Send email notification
    let emailSent = false;
    if (user?.email) {
      // Build the quiz URL using the request's host (org domain) instead of
      // NEXTAUTH_URL which may point to the Vercel/engagio.app domain.
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
      const proto = req.headers.get("x-forwarded-proto") || "https";
      const baseUrl = host ? `${proto}://${host}` : (process.env.NEXTAUTH_URL || "https://engagio.app");
      const quizUrl = quizSlug
        ? `${baseUrl}/quiz/${quizSlug}`
        : `${baseUrl}/dashboard`;

      try {
        const result = await sendAttemptResetEmail({
          to: user.email,
          participantName: user.name || user.email.split("@")[0],
          eventTitle,
          quizUrl,
          resetBy: session.user.name || "Organizer",
        });
        emailSent = result.sent;
        if (!result.sent) {
          console.log("[attempts/reset] email not sent:", result.reason);
        }
      } catch (e) {
        console.error("[attempts/reset] email error:", e);
      }
    }

    return NextResponse.json({
      reset: attemptCount,
      emailSent,
      message: `Reset ${attemptCount} attempt${attemptCount === 1 ? "" : "s"}${emailSent ? " + email sent" : ""}.`,
    });
  } catch (e) {
    console.error("[POST /api/attempts/reset] error:", e);
    return NextResponse.json(
      { error: "Failed to reset attempts" },
      { status: 500 }
    );
  }
}
