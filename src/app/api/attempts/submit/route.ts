import { enforceLimit, BODY_LIMITS } from "@/lib/body-limit";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { parseJsonArray, stringifyJson } from "@/lib/utils";
import type { MatchPair } from "@/types";

interface SubmitBody {
  attemptId?: string;
  /** answers maps questionId -> selectedIndex | string (FILL_BLANK/CODING) | { left: right } (MATCHING) */
  answers?: Record<string, number | string | Record<string, string>>;
  tabSwitches?: number;
  fullscreenExits?: number;
  copyAttempts?: number;
  rightClicks?: number;
  devtoolsOpen?: number;
  screenshotAttempts?: number;
  keyboardViolations?: number;
  faceNotDetected?: number;
  multiFaceAlerts?: number;
  lookAwayAlerts?: number;
  flaggedQuestions?: string[];
  timeTaken?: number;
}

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit: 20 quiz submits per minute per IP ──────────────────
    const ip = getClientIp(req);
    const rl = await rateLimit(`quiz:submit:${ip}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

  const bodyResult = await enforceLimit<SubmitBody>(req, BODY_LIMITS.STANDARD);
  if (bodyResult.error) return bodyResult.error;
  const body = bodyResult.data;
    const {
      attemptId,
      answers,
      tabSwitches = 0,
      fullscreenExits = 0,
      copyAttempts = 0,
      rightClicks = 0,
      devtoolsOpen = 0,
      screenshotAttempts = 0,
      keyboardViolations = 0,
      faceNotDetected = 0,
      multiFaceAlerts = 0,
      lookAwayAlerts = 0,
      flaggedQuestions = [],
      timeTaken = 0,
    } = body;

    if (!attemptId || typeof attemptId !== "string") {
      return NextResponse.json(
        { error: "attemptId is required" },
        { status: 400 }
      );
    }

    const attempt = await db.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quizLink: {
          select: {
            id: true,
            timeLimit: true,
            passThreshold: true,
            showResults: true,
            requireFullscreen: true,
            publishResults: true,
            eventId: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    if (attempt.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        {
          error: "Attempt already submitted",
          status: attempt.status,
          score: attempt.score,
          totalMarks: attempt.totalMarks,
          percentage: attempt.percentage,
          passed: attempt.passed,
          timeTaken: attempt.timeTaken,
          showResults: attempt.quizLink.showResults,
          publishedAt: attempt.publishedAt
            ? attempt.publishedAt.toISOString()
            : null,
        },
        { status: 409 }
      );
    }

    // Resolve answers map
    const answerMap: Record<string, number | string | Record<string, string>> =
      answers && typeof answers === "object" ? answers : {};

    // Load the questions in the stored order
    const questionOrder = parseJsonArray<string>(attempt.questionOrder);
    const questions =
      questionOrder.length > 0
        ? await db.question.findMany({
            where: { id: { in: questionOrder } },
          })
        : await db.question.findMany({
            where: { eventId: attempt.eventId },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          });

    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const orderedQuestions = questionOrder
      .map((qid) => questionMap.get(qid))
      .filter(Boolean) as typeof questions;

    // ----- Score the attempt, per question type -----
    let score = 0;
    let totalMarks = 0;
    for (const q of orderedQuestions) {
      totalMarks += q.marks;
      const chosen = answerMap[q.id];
      if (chosen === undefined || chosen === null) continue;

      const type = q.type ?? "MCQ";
      let isCorrect = false;

      switch (type) {
        case "MCQ":
        case "TRUE_FALSE": {
          if (typeof chosen === "number") {
            isCorrect = chosen === q.correctAnswer;
          }
          if (isCorrect) {
            score += q.marks;
          } else if ((q.negativeMarks ?? 0) > 0) {
            score -= q.negativeMarks ?? 0;
          }
          break;
        }
        case "FILL_BLANK": {
          if (typeof chosen === "string" && q.correctText) {
            isCorrect =
              chosen.trim().toLowerCase() === q.correctText.trim().toLowerCase();
          }
          if (isCorrect) {
            score += q.marks;
          } else if ((q.negativeMarks ?? 0) > 0) {
            // No negative for fill-blank unless negativeMarks > 0.
            score -= q.negativeMarks ?? 0;
          }
          break;
        }
        case "MATCHING": {
          if (typeof chosen === "object" && chosen !== null && q.matchPairs) {
            let pairs: MatchPair[] = [];
            try {
              const parsed = JSON.parse(q.matchPairs);
              if (Array.isArray(parsed)) pairs = parsed as MatchPair[];
            } catch {
              /* ignore */
            }
            const chosenMap = chosen as Record<string, string>;
            isCorrect = pairs.every(
              (p) => chosenMap[p.left] === p.right
            );
          }
          if (isCorrect) {
            score += q.marks;
          } else if ((q.negativeMarks ?? 0) > 0) {
            score -= q.negativeMarks ?? 0;
          }
          break;
        }
        case "CODING": {
          // TODO: real code evaluation (sandboxed execution + test cases).
          // For now, do a simple case-insensitive trimmed text comparison
          // against the reference solution.
          if (typeof chosen === "string" && q.correctText) {
            const normalize = (s: string) =>
              s.replace(/\s+/g, " ").trim().toLowerCase();
            isCorrect = normalize(chosen) === normalize(q.correctText);
          }
          if (isCorrect) {
            score += q.marks;
          } else if ((q.negativeMarks ?? 0) > 0) {
            score -= q.negativeMarks ?? 0;
          }
          break;
        }
      }
    }

    // Clamp total score to >= 0
    if (score < 0) score = 0;

    const percentage =
      totalMarks > 0
        ? Math.max(0, Math.min(100, Math.round((score / totalMarks) * 100)))
        : 0;
    const passed = percentage >= attempt.quizLink.passThreshold;

    // ----- Determine status — anti-cheat heuristics + timeout -----
    let status: "COMPLETED" | "CHEAT_DETECTED" | "TIMEOUT" = "COMPLETED";

    const timeLimitSeconds = attempt.quizLink.timeLimit * 60;
    const isTimedOut =
      attempt.quizLink.timeLimit > 0 &&
      typeof timeTaken === "number" &&
      timeTaken > timeLimitSeconds + 60; // 1 min grace

    const isCheatDetected =
      (typeof tabSwitches === "number" && tabSwitches > 5) ||
      (typeof fullscreenExits === "number" && fullscreenExits > 2) ||
      (typeof copyAttempts === "number" && copyAttempts > 0) ||
      (typeof rightClicks === "number" && rightClicks > 3) ||
      (typeof devtoolsOpen === "number" && devtoolsOpen > 0) ||
      (typeof screenshotAttempts === "number" && screenshotAttempts > 0) ||
      (typeof keyboardViolations === "number" && keyboardViolations > 5) ||
      (typeof faceNotDetected === "number" && faceNotDetected > 10) ||
      (typeof multiFaceAlerts === "number" && multiFaceAlerts > 3) ||
      (typeof lookAwayAlerts === "number" && lookAwayAlerts > 10);

    if (isCheatDetected) status = "CHEAT_DETECTED";
    else if (isTimedOut) status = "TIMEOUT";

    const safe = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
    const safeTime = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
    const safeFlagged = Array.isArray(flaggedQuestions)
      ? flaggedQuestions.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];

    const updated = await db.quizAttempt.update({
      where: { id: attemptId },
      data: {
        answers: stringifyJson(answerMap),
        score,
        totalMarks,
        percentage,
        passed,
        tabSwitches: safe(tabSwitches),
        fullscreenExits: safe(fullscreenExits),
        copyAttempts: safe(copyAttempts),
        rightClicks: safe(rightClicks),
        devtoolsOpen: safe(devtoolsOpen),
        screenshotAttempts: safe(screenshotAttempts),
        keyboardViolations: safe(keyboardViolations),
        faceNotDetected: safe(faceNotDetected),
        multiFaceAlerts: safe(multiFaceAlerts),
        lookAwayAlerts: safe(lookAwayAlerts),
        flaggedQuestions: safeFlagged.length > 0 ? stringifyJson(safeFlagged) : null,
        timeTaken: safeTime(timeTaken),
        status,
        completedAt: new Date(),
      },
    });

    // If the quiz link has publishResults=false (instant results), auto-publish
    // on submit so the participant can immediately see their review.
    let publishedAt: string | null = null;
    if (!attempt.quizLink.publishResults) {
      const updated2 = await db.quizAttempt.update({
        where: { id: attemptId },
        data: { publishedAt: new Date() },
      });
      publishedAt = updated2.publishedAt ? updated2.publishedAt.toISOString() : null;
    } else if (updated.publishedAt) {
      publishedAt = updated.publishedAt.toISOString();
    }

    // ── Auto-generate certificate for THIS participant immediately ──────────
    // We call generateCertificate directly (not the batch autoGenerateCertificates)
    // so the cert is created for the current submitter regardless of the
    // event's `certAutoGenerate` flag (only `certEnabled` matters here).
    // The eligibility check inside generateCertificate handles the rest.
    let generatedCert: { certificateNumber: string; verificationToken: string } | null = null;
    let certReason: string | null = null;
    try {
      const { generateCertificate } = await import("@/lib/cert-service");
      // Resolve the base URL from the request host for email links (org domain)
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
      const proto = req.headers.get("x-forwarded-proto") || "https";
      const emailBaseUrl = host ? `${proto}://${host}` : undefined;
      const certResult = await generateCertificate({
        eventId: attempt.eventId,
        userId: session.user.id,
        attemptId,
        baseUrl: emailBaseUrl,
      });
      if (certResult.certificate) {
        generatedCert = {
          certificateNumber: certResult.certificate.certificateNumber,
          verificationToken: certResult.certificate.verificationToken,
        };
      } else {
        // Log the reason so admins can debug why no cert was issued
        certReason = certResult.reason;
        console.log("[submit] cert not generated:", certResult.reason);
      }
    } catch (e) {
      console.error("[submit] cert-generation error:", e);
    }

    return NextResponse.json({
      attemptId: updated.id,
      status: updated.status,
      score: updated.score,
      totalMarks: updated.totalMarks,
      percentage: updated.percentage,
      passed: updated.passed,
      timeTaken: updated.timeTaken,
      showResults: attempt.quizLink.showResults,
      publishedAt,
      certificate: generatedCert,
      certReason, // null if cert was generated, otherwise the reason it wasn't
    });
  } catch (error) {
    console.error("[POST /api/attempts/submit] error:", error);
    return NextResponse.json(
      { error: "Failed to submit attempt" },
      { status: 500 }
    );
  }
}
