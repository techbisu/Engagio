import { checkBodySize, BODY_LIMITS } from "@/lib/body-limit";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, ownsResource } from "@/lib/tenant";
import { generateQuizSlug } from "@/lib/utils";
import type { QuizLinkDto } from "@/types";

/** Shared mapper — includes every field exposed on QuizLinkDto. */
export function toQuizLinkDto(link: any): QuizLinkDto {
  return {
    id: link.id,
    eventId: link.eventId,
    slug: link.slug,
    isActive: link.isActive,
    shuffleQuestions: link.shuffleQuestions,
    shuffleOptions: link.shuffleOptions,
    timeLimit: link.timeLimit,
    maxAttempts: link.maxAttempts,
    questionCount: link.questionCount,
    showResults: link.showResults,
    publishResults: link.publishResults,
    emailOnPublish: link.emailOnPublish ?? true,
    leaderboardEnabled: link.leaderboardEnabled ?? true,
    passThreshold: link.passThreshold,
    // Security toggles
    requireFullscreen: link.requireFullscreen,
    autoSubmitOnExit: link.autoSubmitOnExit,
    tabSwitchDetection: link.tabSwitchDetection,
    copyPasteBlocking: link.copyPasteBlocking,
    rightClickDisable: link.rightClickDisable,
    keyboardShortcutBlocking: link.keyboardShortcutBlocking,
    devtoolsDetection: link.devtoolsDetection,
    antiScreenshot: link.antiScreenshot,
    watermarkOverlay: link.watermarkOverlay,
    // AI Proctor
    aiProctor: link.aiProctor,
    aiProctorFaceDetection: link.aiProctorFaceDetection,
    aiProctorMultiFace: link.aiProctorMultiFace,
    aiProctorLookAway: link.aiProctorLookAway,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    event: link.event
      ? {
          id: link.event.id,
          title: link.event.title,
          slug: link.event.slug ?? null,
          description: link.event.description,
          image: link.event.image ?? null,
          // Include org slug so the admin panel can build org-scoped URLs
          // (e.g. /org/{orgSlug}/{eventSlug}/quiz/{slug}) without an extra
          // round-trip.
          orgSlug: link.event.organization?.slug ?? null,
        }
      : undefined,
  };
}

/** List of every boolean security toggle accepted by POST/PATCH. */
const BOOLEAN_TOGGLES = [
  "requireFullscreen",
  "autoSubmitOnExit",
  "tabSwitchDetection",
  "copyPasteBlocking",
  "rightClickDisable",
  "keyboardShortcutBlocking",
  "devtoolsDetection",
  "antiScreenshot",
  "watermarkOverlay",
  "aiProctor",
  "aiProctorFaceDetection",
  "aiProctorMultiFace",
  "aiProctorLookAway",
  "shuffleQuestions",
  "shuffleOptions",
  "showResults",
  "publishResults",
  "emailOnPublish",
  "leaderboardEnabled",
  "isActive",
] as const;

/** GET /api/quiz-links — list quiz links for the current org (org-scoped admin). */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "assessment.manage");
    if (!auth.ok) {
      if (auth.legacyAdmin) return NextResponse.json([]);
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const links = await db.quizLink.findMany({
      where: { event: { organizationId: auth.ctx.orgId } },
      include: { event: { select: { id: true, title: true, slug: true, description: true, image: true, organization: { select: { slug: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(links.map(toQuizLinkDto));
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/** POST /api/quiz-links — create a quiz link (org-scoped admin). */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "assessment.manage");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const body = await req.json();
    const { eventId, expiresAt, timeLimit, maxAttempts, passThreshold, questionCount } =
      body || {};

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event || !ownsResource(event, auth.ctx)) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Validate questionCount: non-negative integer.
    if (
      questionCount !== undefined &&
      questionCount !== null &&
      (typeof questionCount !== "number" ||
        !Number.isInteger(questionCount) ||
        questionCount < 0)
    ) {
      return NextResponse.json(
        { error: "questionCount must be a non-negative integer (0 = use all questions)" },
        { status: 400 }
      );
    }

    // Generate a unique slug, retrying on collision up to 5 times.
    let slug = "";
    let attempt = 0;
    while (attempt < 5) {
      const candidate = generateQuizSlug(6);
      const clash = await db.quizLink.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!clash) {
        slug = candidate;
        break;
      }
      attempt++;
    }
    if (!slug) {
      return NextResponse.json(
        { error: "Failed to generate a unique slug. Please try again." },
        { status: 500 }
      );
    }

    // Optional expiresAt validation.
    let expiresAtDate: Date | null = null;
    if (expiresAt !== undefined && expiresAt !== null && expiresAt !== "") {
      expiresAtDate = new Date(expiresAt);
      if (isNaN(expiresAtDate.getTime())) {
        return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
      }
    }

    // Build data with sensible defaults for every toggle.
    const data: Record<string, unknown> = {
      eventId,
      slug,
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      shuffleQuestions:
        typeof body.shuffleQuestions === "boolean" ? body.shuffleQuestions : true,
      shuffleOptions:
        typeof body.shuffleOptions === "boolean" ? body.shuffleOptions : false,
      timeLimit:
        typeof timeLimit === "number" && timeLimit >= 0 ? Math.floor(timeLimit) : 30,
      maxAttempts:
        typeof maxAttempts === "number" && maxAttempts >= 0 ? Math.floor(maxAttempts) : 1,
      questionCount:
        typeof questionCount === "number" && Number.isInteger(questionCount) && questionCount >= 0
          ? questionCount
          : 0,
      showResults: typeof body.showResults === "boolean" ? body.showResults : true,
      publishResults:
        typeof body.publishResults === "boolean" ? body.publishResults : false,
      emailOnPublish:
        typeof body.emailOnPublish === "boolean" ? body.emailOnPublish : true,
      leaderboardEnabled:
        typeof body.leaderboardEnabled === "boolean" ? body.leaderboardEnabled : true,
      passThreshold:
        typeof passThreshold === "number" && passThreshold >= 0 && passThreshold <= 100
          ? Math.floor(passThreshold)
          : 40,
      expiresAt: expiresAtDate,
    };

    // Apply boolean toggles with their schema defaults.
    const TOGGLE_DEFAULTS: Record<string, boolean> = {
      requireFullscreen: true,
      autoSubmitOnExit: true,
      tabSwitchDetection: true,
      copyPasteBlocking: true,
      rightClickDisable: true,
      keyboardShortcutBlocking: true,
      devtoolsDetection: true,
      antiScreenshot: true,
      watermarkOverlay: true,
      aiProctor: false,
      aiProctorFaceDetection: true,
      aiProctorMultiFace: true,
      aiProctorLookAway: true,
    };
    for (const key of BOOLEAN_TOGGLES) {
      if (key in body && typeof body[key] === "boolean") {
        data[key] = body[key];
      } else if (key in TOGGLE_DEFAULTS) {
        data[key] = TOGGLE_DEFAULTS[key];
      }
    }

    const created = await db.quizLink.create({
      data: data as any,
      include: { event: { select: { id: true, title: true, slug: true, description: true, image: true, organization: { select: { slug: true } } } } },
    });
    return NextResponse.json(toQuizLinkDto(created), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
