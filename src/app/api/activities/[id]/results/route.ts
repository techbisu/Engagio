import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import {
  parseActivitySettings,
  parseJsonArray,
  parseResponseMetadata,
  toActivityResponseDto,
} from "@/lib/activity-mapper";
import type {
  ActivityResultsDto,
  PollOptionResult,
} from "@/types";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/activities/[id]/results — aggregated activity results.
 *  Admin sees everything. A participant sees aggregated results only when
 *  `settings.showResults` is true (and may be further gated by
 *  `hideResultsUntilClosed`).
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isAdmin = (session?.user as any)?.role === "ADMIN";

    const { id } = await ctx.params;
    const activity = await db.activity.findUnique({
      where: { id },
      include: { questions: { orderBy: { sortOrder: "asc" } } },
    });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const settings = parseActivitySettings(activity.settings);

    // Participant visibility gate
    let participantCanSee = true;
    if (!isAdmin) {
      participantCanSee = !!settings.showResults;
      if (settings.hideResultsUntilClosed && activity.status !== "CLOSED" && activity.status !== "COMPLETED") {
        participantCanSee = false;
      }
    }

    // Total counts
    const [totalResponses, totalParticipants] = await Promise.all([
      db.activityResponse.count({ where: { activityId: id } }),
      db.activityParticipation.count({ where: { activityId: id } }),
    ]);

    // QUIZ-type → punt to the existing quiz results endpoint
    if (activity.type === "QUIZ" || activity.type === "LIVE_QUIZ") {
      const payload: ActivityResultsDto = {
        activityId: id,
        type: activity.type as any,
        totalResponses,
        totalParticipants,
      };
      // Include quizLinkId so the client can fetch the proper results.
      return NextResponse.json({ ...payload, quizLinkId: activity.quizLinkId });
    }

    // Q&A → list of submitted questions (responses), sorted by upvotes desc
    if (activity.type === "Q_AND_A") {
      if (!participantCanSee) {
        // Participant cannot see results
        const payload: ActivityResultsDto = {
          activityId: id,
          type: activity.type as any,
          totalResponses,
          totalParticipants,
          questions: [],
        };
        return NextResponse.json(payload);
      }
      const responses = await db.activityResponse.findMany({
        where: {
          activityId: id,
          // Hide "hidden" questions from participants (admins see everything)
          ...(isAdmin ? {} : { metadata: { not: { contains: '"hidden":true' } } }),
        },
        orderBy: { createdAt: "desc" },
      });
      // Sort by upvotes desc (parse metadata)
      const withUpvotes = responses
        .map((r) => ({ r, meta: parseResponseMetadata(r.metadata) }))
        .sort((a, b) => (b.meta.upvotes ?? 0) - (a.meta.upvotes ?? 0));
      const questionDtos = withUpvotes.map(({ r }) => toActivityResponseDto(r));
      const payload: ActivityResultsDto = {
        activityId: id,
        type: activity.type as any,
        totalResponses,
        totalParticipants,
        questions: questionDtos,
      };
      return NextResponse.json(payload);
    }

    // POLL / VOTING → aggregate per option of the (single) question
    if (activity.type === "POLL" || activity.type === "VOTING") {
      // Use the first (usually only) question for these types
      const question = activity.questions[0];
      if (!question) {
        const payload: ActivityResultsDto = {
          activityId: id,
          type: activity.type as any,
          totalResponses,
          totalParticipants,
          options: [],
        };
        return NextResponse.json(payload);
      }
      const opts = parseJsonArray<string>(question.options);
      const responses = await db.activityResponse.findMany({
        where: { activityId: id, questionId: question.id },
        select: { selectedOptions: true },
      });
      const counts = new Array(opts.length).fill(0);
      let totalSelected = 0;
      for (const r of responses) {
        const sel = parseJsonArray<number>(r.selectedOptions);
        for (const idx of sel) {
          if (idx >= 0 && idx < counts.length) {
            counts[idx]++;
            totalSelected++;
          }
        }
      }
      const options: PollOptionResult[] = opts.map((label, index) => ({
        index,
        label,
        count: counts[index],
        percentage:
          totalSelected === 0 ? 0 : Math.round((counts[index] / totalSelected) * 1000) / 10,
      }));
      if (!participantCanSee) {
        const payload: ActivityResultsDto = {
          activityId: id,
          type: activity.type as any,
          totalResponses,
          totalParticipants,
          options: [],
        };
        return NextResponse.json(payload);
      }
      const payload: ActivityResultsDto = {
        activityId: id,
        type: activity.type as any,
        totalResponses,
        totalParticipants,
        options,
      };
      return NextResponse.json(payload);
    }

    // SURVEY / FEEDBACK / KNOWLEDGE_CHECK / PRE_POST_ASSESSMENT → per-question breakdown
    if (
      activity.type === "SURVEY" ||
      activity.type === "FEEDBACK" ||
      activity.type === "KNOWLEDGE_CHECK" ||
      activity.type === "PRE_POST_ASSESSMENT"
    ) {
      const questionResults: ActivityResultsDto["questionResults"] = [];
      for (const q of activity.questions) {
        const opts = parseJsonArray<string>(q.options);
        const responses = await db.activityResponse.findMany({
          where: { activityId: id, questionId: q.id },
        });
        const counts = new Array(opts.length).fill(0);
        let totalSelected = 0;
        let ratingSum = 0;
        let ratingCount = 0;
        const textResponses: string[] = [];
        for (const r of responses) {
          const sel = parseJsonArray<number>(r.selectedOptions);
          for (const idx of sel) {
            if (idx >= 0 && idx < counts.length) {
              counts[idx]++;
              totalSelected++;
            }
          }
          if (typeof r.ratingValue === "number" && r.ratingValue >= 1 && r.ratingValue <= 5) {
            ratingSum += r.ratingValue;
            ratingCount++;
          }
          if (r.text && r.text.trim()) {
            textResponses.push(r.text.trim());
          }
        }
        const optionResults: PollOptionResult[] = opts.map((label, index) => ({
          index,
          label,
          count: counts[index],
          percentage:
            totalSelected === 0
              ? 0
              : Math.round((counts[index] / totalSelected) * 1000) / 10,
        }));
        questionResults.push({
          questionId: q.id,
          questionText: q.text,
          questionType: q.type as any,
          optionResults: opts.length > 0 ? optionResults : undefined,
          averageRating:
            ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 100) / 100 : undefined,
          textResponses: textResponses.length > 0 ? textResponses : undefined,
          responseCount: responses.length,
        });
      }
      if (!participantCanSee) {
        const payload: ActivityResultsDto = {
          activityId: id,
          type: activity.type as any,
          totalResponses,
          totalParticipants,
          questionResults: [],
        };
        return NextResponse.json(payload);
      }
      const payload: ActivityResultsDto = {
        activityId: id,
        type: activity.type as any,
        totalResponses,
        totalParticipants,
        questionResults,
      };
      return NextResponse.json(payload);
    }

    // Fallback (unknown type)
    const payload: ActivityResultsDto = {
      activityId: id,
      type: activity.type as any,
      totalResponses,
      totalParticipants,
    };
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
