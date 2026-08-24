import { checkBodySize, BODY_LIMITS } from "@/lib/body-limit";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { parseJsonArray, DEFAULT_QA_METADATA } from "@/lib/activity-mapper";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/activities/[id]/respond — participant submits responses. */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const participantId = (session.user as any)?.id ?? null;
    const participantName =
      (session.user as any)?.name || (session.user as any)?.email || "Anonymous";

    const { id } = await ctx.params;
    const activity = await db.activity.findUnique({
      where: { id },
      include: { questions: true },
    });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // ----- Activity must be enabled + live-or-scheduled -----
    if (!activity.isEnabled) {
      return NextResponse.json(
        { error: "This activity is not currently accepting responses." },
        { status: 400 }
      );
    }
    if (activity.status !== "LIVE" && activity.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: `Activity is ${activity.status.toLowerCase()} — responses are closed.` },
        { status: 400 }
      );
    }

    // ----- QUIZ-type activities should use QuizAttempt, not this endpoint -----
    if (activity.type === "QUIZ" || activity.type === "LIVE_QUIZ") {
      return NextResponse.json(
        {
          error:
            "QUIZ-type activities use the assessment system. Use the quiz attempt endpoint instead.",
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const responses: any[] = Array.isArray(body?.responses) ? body.responses : [];
    if (responses.length === 0) {
      return NextResponse.json(
        { error: "responses[] is required and must be non-empty" },
        { status: 400 }
      );
    }

    const isQAndA = activity.type === "Q_AND_A";

    // ----- One-response-per-participant gate (everything except Q&A) -----
    if (!isQAndA && participantId) {
      const existing = await db.activityParticipation.findUnique({
        where: {
          activityId_participantId: { activityId: id, participantId },
        },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: "You have already responded" },
          { status: 409 }
        );
      }
    }

    // Build a quick lookup: questionId → question object
    const questionsById = new Map(activity.questions.map((q) => [q.id, q]));

    // ----- Validate every response entry before writing anything -----
    type ValidatedResponse = {
      questionId: string | null;
      // JSON-encoded string of the selected indices (matches the DB column type).
      selectedOptions: string | null;
      text: string | null;
      numberValue: number | null;
      ratingValue: number | null;
      metadata: string;
    };
    const validated: ValidatedResponse[] = [];

    for (let i = 0; i < responses.length; i++) {
      const r = responses[i] || {};
      const questionId = typeof r.questionId === "string" ? r.questionId : null;

      // For Q&A: each row is itself the submitted question (text = the question
      // asked by the participant), and `questionId` is allowed to be null.
      // For every other activity type, the questionId must point to an actual
      // question on this activity.
      if (isQAndA) {
        const qText = typeof r.text === "string" ? r.text.trim() : "";
        if (!qText) {
          return NextResponse.json(
            { error: `responses[${i}].text is required for Q&A` },
            { status: 400 }
          );
        }
        validated.push({
          questionId: questionId && questionsById.has(questionId) ? questionId : null,
          selectedOptions: null,
          text: qText,
          numberValue: null,
          ratingValue: null,
          metadata: JSON.stringify({ ...DEFAULT_QA_METADATA }),
        });
        continue;
      }

      // ----- Non-Q&A: must reference a real question on this activity -----
      if (!questionId || !questionsById.has(questionId)) {
        return NextResponse.json(
          { error: `responses[${i}].questionId does not belong to this activity` },
          { status: 400 }
        );
      }
      const question = questionsById.get(questionId)!;
      const qOptions = parseJsonArray<string>(question.options);
      const selected: number[] = Array.isArray(r.selectedOptions)
        ? r.selectedOptions.filter(
            (n: unknown) => typeof n === "number" && Number.isInteger(n)
          )
        : [];
      const textVal =
        typeof r.text === "string" ? r.text : null;
      const numVal =
        typeof r.numberValue === "number" && Number.isFinite(r.numberValue)
          ? r.numberValue
          : null;
      const ratingVal =
        typeof r.ratingValue === "number" && Number.isFinite(r.ratingValue)
          ? Math.floor(r.ratingValue)
          : null;

      // Per-type validation
      switch (question.type) {
        case "SINGLE_CHOICE": {
          if (
            selected.length !== 1 ||
            selected[0] < 0 ||
            selected[0] >= qOptions.length
          ) {
            return NextResponse.json(
              {
                error: `responses[${i}]: SINGLE_CHOICE requires exactly one valid option index`,
              },
              { status: 400 }
            );
          }
          break;
        }
        case "MULTIPLE_CHOICE": {
          if (selected.length === 0) {
            return NextResponse.json(
              {
                error: `responses[${i}]: MULTIPLE_CHOICE requires at least one selected option`,
              },
              { status: 400 }
            );
          }
          const allValid = selected.every(
            (n) => n >= 0 && n < qOptions.length
          );
          if (!allValid) {
            return NextResponse.json(
              { error: `responses[${i}]: selectedOptions contains an invalid index` },
              { status: 400 }
            );
          }
          break;
        }
        case "RATING": {
          if (ratingVal === null || ratingVal < 1 || ratingVal > 5) {
            return NextResponse.json(
              { error: `responses[${i}]: ratingValue must be a number from 1 to 5` },
              { status: 400 }
            );
          }
          break;
        }
        case "TEXT": {
          if (!textVal || !textVal.trim()) {
            return NextResponse.json(
              { error: `responses[${i}]: text is required for TEXT question` },
              { status: 400 }
            );
          }
          break;
        }
        case "NUMBER": {
          if (numVal === null) {
            return NextResponse.json(
              { error: `responses[${i}]: numberValue must be a number` },
              { status: 400 }
            );
          }
          break;
        }
        case "YES_NO": {
          // Accept either selectedOptions=[1|0], numberValue (1|0), or text "yes"/"no".
          // Normalize to numberValue (1=yes, 0=no).
          if (numVal !== null && (numVal === 1 || numVal === 0)) {
            // already normalized
          } else if (
            selected.length === 1 &&
            (selected[0] === 0 || selected[0] === 1)
          ) {
            // selectedOptions[0] is treated as the yes/no index
          } else if (
            textVal &&
            ["yes", "no", "true", "false"].includes(textVal.trim().toLowerCase())
          ) {
            // normalize via textVal
          } else {
            return NextResponse.json(
              {
                error: `responses[${i}]: YES_NO requires numberValue (1=yes, 0=no), selectedOptions [0|1], or text "yes"/"no"`,
              },
              { status: 400 }
            );
          }
          break;
        }
        case "OPEN":
          // OPEN type can also be used as a free-form question in surveys.
          if (!textVal || !textVal.trim()) {
            return NextResponse.json(
              { error: `responses[${i}]: text is required for OPEN question` },
              { status: 400 }
            );
          }
          break;
        default:
          // Unknown question type — reject defensively.
          return NextResponse.json(
            { error: `responses[${i}]: unknown question type "${question.type}"` },
            { status: 400 }
          );
      }

      // Normalize YES_NO storage to numberValue (1=yes, 0=no)
      let storedNum = numVal;
      let storedText = textVal;
      let storedSelected = selected;
      if (question.type === "YES_NO") {
        if (storedNum === null) {
          if (selected.length === 1) {
            storedNum = selected[0] === 1 ? 1 : 0;
            storedSelected = [storedNum];
          } else if (textVal) {
            const v = textVal.trim().toLowerCase();
            storedNum = v === "yes" || v === "true" ? 1 : 0;
          }
        } else {
          storedSelected = [storedNum === 1 ? 1 : 0];
        }
      }

      validated.push({
        questionId,
        selectedOptions:
          storedSelected.length > 0 ? JSON.stringify(storedSelected) : null,
        text: storedText,
        numberValue: storedNum,
        ratingValue: ratingVal,
        metadata: JSON.stringify({ ...DEFAULT_QA_METADATA }),
      });
    }

    // ----- Write everything in a transaction -----
    const createdIds: string[] = [];
    await db.$transaction(async (tx) => {
      // Create / update ActivityParticipation record.
      if (participantId && !isQAndA) {
        // We already verified above that no existing participation exists.
        await tx.activityParticipation.create({
          data: {
            activityId: id,
            participantId,
            status: "COMPLETED",
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });
      } else if (participantId && isQAndA) {
        // For Q&A, participation is created on the FIRST submitted question;
        // subsequent ones reuse the existing record (upsert).
        await tx.activityParticipation.upsert({
          where: {
            activityId_participantId: { activityId: id, participantId },
          },
          update: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
          create: {
            activityId: id,
            participantId,
            status: "COMPLETED",
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });
      }

      // Create the response rows
      for (const v of validated) {
        const created = await tx.activityResponse.create({
          data: {
            activityId: id,
            questionId: v.questionId,
            participantId,
            participantName,
            selectedOptions: v.selectedOptions,
            text: v.text,
            numberValue: v.numberValue,
            ratingValue: v.ratingValue,
            metadata: v.metadata,
          },
        });
        createdIds.push(created.id);
      }
    });

    return NextResponse.json(
      { success: true, responseIds: createdIds },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
