import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const isAdmin = session.user.role === "ADMIN";
    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "true";
    const eventId = url.searchParams.get("eventId") || undefined;

    const showAll = isAdmin && all;

    if (showAll) {
      const attempts = await db.quizAttempt.findMany({
        where: eventId ? { eventId } : undefined,
        orderBy: { startedAt: "desc" },
        take: 200,
        include: {
          user: {
            select: { name: true, email: true, image: true },
          },
          event: {
            select: { id: true, title: true },
          },
          quizLink: {
            select: { slug: true, publishResults: true },
          },
        },
      });

      const data = attempts.map((a) => {
        // For admin view: "published" = publishResults false (instant) OR publishedAt set.
        const published =
          !a.quizLink.publishResults || a.publishedAt !== null;
        return {
          id: a.id,
          status: a.status,
          score: a.score,
          totalMarks: a.totalMarks,
          percentage: a.percentage,
          passed: a.passed,
          timeTaken: a.timeTaken,
          tabSwitches: a.tabSwitches,
          fullscreenExits: a.fullscreenExits,
          copyAttempts: a.copyAttempts,
          rightClicks: a.rightClicks,
          devtoolsOpen: a.devtoolsOpen,
          screenshotAttempts: a.screenshotAttempts,
          keyboardViolations: a.keyboardViolations,
          faceNotDetected: a.faceNotDetected,
          multiFaceAlerts: a.multiFaceAlerts,
          lookAwayAlerts: a.lookAwayAlerts,
          startedAt: a.startedAt,
          completedAt: a.completedAt,
          publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
          published,
          user: a.user,
          event: a.event,
          quizLink: a.quizLink,
        };
      });

      return NextResponse.json({ attempts: data, total: data.length });
    }

    // Student (or admin without all=) — own attempts only
    const attempts = await db.quizAttempt.findMany({
      where: { userId: session.user.id, ...(eventId ? { eventId } : {}) },
      orderBy: { startedAt: "desc" },
      take: 200,
      include: {
        event: {
          select: { id: true, title: true },
        },
        quizLink: {
          select: { slug: true, publishResults: true },
        },
      },
    });

    const data = attempts.map((a) => {
      const published = !a.quizLink.publishResults || a.publishedAt !== null;
      return {
        id: a.id,
        status: a.status,
        score: a.score,
        totalMarks: a.totalMarks,
        percentage: a.percentage,
        passed: a.passed,
        timeTaken: a.timeTaken,
        tabSwitches: a.tabSwitches,
        fullscreenExits: a.fullscreenExits,
        copyAttempts: a.copyAttempts,
        rightClicks: a.rightClicks,
        devtoolsOpen: a.devtoolsOpen,
        screenshotAttempts: a.screenshotAttempts,
        keyboardViolations: a.keyboardViolations,
        faceNotDetected: a.faceNotDetected,
        multiFaceAlerts: a.multiFaceAlerts,
        lookAwayAlerts: a.lookAwayAlerts,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
        published,
        event: a.event,
        quizLink: a.quizLink,
      };
    });

    return NextResponse.json({ attempts: data, total: data.length });
  } catch (error) {
    console.error("[GET /api/attempts/list] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch attempts" },
      { status: 500 }
    );
  }
}
