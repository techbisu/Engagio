import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, ownsResource } from "@/lib/tenant";
import { db } from "@/lib/db";
import { parseJsonArray } from "@/lib/utils";
import type { MatchPair } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const attempt = await db.quizAttempt.findUnique({
      where: { id },
      include: {
        quizLink: {
          select: {
            id: true,
            slug: true,
            timeLimit: true,
            maxAttempts: true,
            passThreshold: true,
            showResults: true,
            requireFullscreen: true,
            publishResults: true,
            eventId: true,
          },
        },
        event: {
          select: { id: true, title: true, description: true, organizationId: true },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    // Org-scoped admin view: a manager can review attempts belonging to their
    // org. Owners always keep their own-attempt access.
    const auth = await requirePermission(req, "result.view");
    const isAdminView = auth.ok && ownsResource(attempt.event, auth.ctx);
    if (attempt.userId !== session.user.id && !isAdminView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const questionOrder = parseJsonArray<string>(attempt.questionOrder);
    const flaggedQuestions = parseJsonArray<string>(attempt.flaggedQuestions);

    // Fetch all questions referenced in this attempt
    const questions = await db.question.findMany({
      where: { id: { in: questionOrder.length ? questionOrder : undefined } },
    });
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions = questionOrder
      .map((qid) => questionMap.get(qid))
      .filter(Boolean) as typeof questions;

    // --- IN_PROGRESS: return questions without correctAnswer (resume view) ---
    if (attempt.status === "IN_PROGRESS") {
      const publicQuestions = orderedQuestions.map((q, idx) => {
        let matchPairs: MatchPair[] | null = null;
        if (q.matchPairs) {
          try {
            const parsed = JSON.parse(q.matchPairs);
            matchPairs = Array.isArray(parsed) ? parsed : null;
          } catch {
            matchPairs = null;
          }
        }
        return {
          id: q.id,
          question: q.question,
          type: q.type ?? "MCQ",
          options: parseJsonArray<string>(q.options),
          matchPairs,
          codeLanguage: q.codeLanguage ?? null,
          marks: q.marks,
          negativeMarks: q.negativeMarks ?? 0,
          category: q.category ?? null,
          order: idx,
        };
      });

      const totalMarks = orderedQuestions.reduce((sum, q) => sum + q.marks, 0);

      return NextResponse.json({
        attemptId: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        questionOrder,
        questions: publicQuestions,
        flaggedQuestions,
        totalQuestions: orderedQuestions.length,
        totalMarks,
        timeLimit: attempt.quizLink.timeLimit,
        maxAttempts: attempt.quizLink.maxAttempts,
        passThreshold: attempt.quizLink.passThreshold,
        requireFullscreen: attempt.quizLink.requireFullscreen,
        event: attempt.event,
      });
    }

    // --- COMPLETED / TIMEOUT / CHEAT_DETECTED: review payload ---
    const answers: Record<string, number | string | Record<string, string>> =
      attempt.answers
        ? (() => {
            try {
              const parsed = JSON.parse(attempt.answers);
              return typeof parsed === "object" && parsed !== null ? parsed : {};
            } catch {
              return {};
            }
          })()
        : {};

    const reviewQuestions = orderedQuestions.map((q, idx) => {
      const options = parseJsonArray<string>(q.options);
      let matchPairs: MatchPair[] | null = null;
      if (q.matchPairs) {
        try {
          const parsed = JSON.parse(q.matchPairs);
          matchPairs = Array.isArray(parsed) ? parsed : null;
        } catch {
          matchPairs = null;
        }
      }
      const chosen = answers[q.id];
      const type = q.type ?? "MCQ";
      let isCorrect = false;

      switch (type) {
        case "MCQ":
        case "TRUE_FALSE":
          if (typeof chosen === "number") isCorrect = chosen === q.correctAnswer;
          break;
        case "FILL_BLANK":
          if (typeof chosen === "string" && q.correctText) {
            isCorrect =
              chosen.trim().toLowerCase() === q.correctText.trim().toLowerCase();
          }
          break;
        case "MATCHING": {
          if (typeof chosen === "object" && chosen !== null && matchPairs) {
            const chosenMap = chosen as Record<string, string>;
            isCorrect = matchPairs.every((p) => chosenMap[p.left] === p.right);
          }
          break;
        }
        case "CODING": {
          if (typeof chosen === "string" && q.correctText) {
            const normalize = (s: string) =>
              s.replace(/\s+/g, " ").trim().toLowerCase();
            isCorrect = normalize(chosen) === normalize(q.correctText);
          }
          break;
        }
      }

      let marksAwarded = 0;
      if (isCorrect) {
        marksAwarded = q.marks;
      } else if ((q.negativeMarks ?? 0) > 0) {
        // Wrong-answer deduction applies to MCQ/TRUE_FALSE/CODING/MATCHING/FILL_BLANK
        // when negativeMarks > 0.
        marksAwarded = -(q.negativeMarks ?? 0);
      }

      return {
        id: q.id,
        order: idx,
        type,
        question: q.question,
        options,
        matchPairs,
        correctAnswer: type === "MCQ" || type === "TRUE_FALSE" ? q.correctAnswer : null,
        correctText: q.correctText ?? null,
        codeLanguage: q.codeLanguage ?? null,
        // What the participant chose (shape depends on type).
        chosenIndex:
          type === "MCQ" || type === "TRUE_FALSE"
            ? typeof chosen === "number"
              ? chosen
              : null
            : null,
        chosenText:
          type === "FILL_BLANK" || type === "CODING"
            ? typeof chosen === "string"
              ? chosen
              : null
            : null,
        chosenMatches:
          type === "MATCHING"
            ? typeof chosen === "object" && chosen !== null
              ? (chosen as Record<string, string>)
              : null
            : null,
        isCorrect,
        marks: q.marks,
        marksAwarded,
        negativeMarks: q.negativeMarks ?? 0,
        category: q.category ?? null,
        explanation: q.explanation ?? null,
      };
    });

    // ----- Per-category breakdown -----
    const catMap = new Map<
      string,
      { total: number; correct: number; score: number; maxScore: number }
    >();
    for (const q of reviewQuestions) {
      const cat = q.category || "Uncategorized";
      const entry = catMap.get(cat) ?? { total: 0, correct: 0, score: 0, maxScore: 0 };
      entry.total += 1;
      entry.maxScore += q.marks;
      if (q.isCorrect) entry.correct += 1;
      entry.score += q.marksAwarded;
      catMap.set(cat, entry);
    }
    const categoryStats = Array.from(catMap.entries()).map(([category, s]) => ({
      category,
      total: s.total,
      correct: s.correct,
      score: s.score,
      maxScore: s.maxScore,
    }));

    // ----- Publish gate -----
    // If quizLink.publishResults === true AND this attempt hasn't been published
    // yet (and the caller is NOT an admin), hide all scoring details and only
    // return a "pending" flag. Admin always sees the full review.
    const isPublished = attempt.publishedAt !== null;
    const hideForStudent =
      attempt.quizLink.publishResults &&
      !isPublished &&
      !isAdminView;

    const publishedAtIso = attempt.publishedAt
      ? attempt.publishedAt.toISOString()
      : null;

    // Fetch certificate for this user+event (if auto-generated).
    const certificate = await db.certificate.findFirst({
      where: { eventId: attempt.eventId, userId: attempt.userId, status: "VALID" },
      select: {
        id: true,
        certificateNumber: true,
        verificationToken: true,
        template: true,
        recipientName: true,
        issuedAt: true,
      },
    });

    // Fetch org info for the share card (logo, name, colors).
    const orgInfo = attempt.event.organizationId
      ? await db.organization.findUnique({
          where: { id: attempt.event.organizationId },
          select: { name: true, slug: true, logoUrl: true, primaryColor: true },
        })
      : null;

    if (hideForStudent) {
      return NextResponse.json({
        attemptId: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        score: null,
        totalMarks: null,
        percentage: null,
        passed: null,
        timeTaken: attempt.timeTaken,
        questionOrder,
        questions: null,
        categoryStats: null,
        totalQuestions: orderedQuestions.length,
        showResults: attempt.quizLink.showResults,
        publishResults: true,
        published: false,
        publishedAt: null,
        event: attempt.event,
        quizLink: attempt.quizLink,
        certificate: certificate
          ? {
              id: certificate.id,
              certificateNumber: certificate.certificateNumber,
              verificationToken: certificate.verificationToken,
              template: certificate.template,
              recipientName: certificate.recipientName,
              issuedAt: certificate.issuedAt.toISOString(),
            }
          : null,
        organization: orgInfo
          ? { name: orgInfo.name, slug: orgInfo.slug, logoUrl: orgInfo.logoUrl, primaryColor: orgInfo.primaryColor }
          : null,
      });
    }

    return NextResponse.json({
      attemptId: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
      passed: attempt.passed,
      tabSwitches: attempt.tabSwitches,
      fullscreenExits: attempt.fullscreenExits,
      copyAttempts: attempt.copyAttempts,
      rightClicks: attempt.rightClicks,
      devtoolsOpen: attempt.devtoolsOpen,
      screenshotAttempts: attempt.screenshotAttempts,
      keyboardViolations: attempt.keyboardViolations,
      faceNotDetected: attempt.faceNotDetected,
      multiFaceAlerts: attempt.multiFaceAlerts,
      lookAwayAlerts: attempt.lookAwayAlerts,
      timeTaken: attempt.timeTaken,
      flaggedQuestions,
      questionOrder,
      questions: reviewQuestions,
      categoryStats,
      totalQuestions: orderedQuestions.length,
      showResults: attempt.quizLink.showResults,
      publishResults: attempt.quizLink.publishResults,
      published: isPublished || !attempt.quizLink.publishResults,
      publishedAt: publishedAtIso,
      event: attempt.event,
      quizLink: attempt.quizLink,
      certificate: certificate
        ? {
            id: certificate.id,
            certificateNumber: certificate.certificateNumber,
            verificationToken: certificate.verificationToken,
            template: certificate.template,
            recipientName: certificate.recipientName,
            issuedAt: certificate.issuedAt.toISOString(),
          }
        : null,
      organization: orgInfo
        ? { name: orgInfo.name, slug: orgInfo.slug, logoUrl: orgInfo.logoUrl, primaryColor: orgInfo.primaryColor }
        : null,
    });
  } catch (error) {
    console.error("[GET /api/attempts/[id]] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch attempt" },
      { status: 500 }
    );
  }
}
