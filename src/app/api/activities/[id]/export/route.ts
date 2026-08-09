import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { parseJsonArray, parseResponseMetadata } from "@/lib/activity-mapper";

/** Check the session for an admin role. Returns true if the caller is an admin. */
async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

type RouteContext = { params: Promise<{ id: string }> };

/** RFC-4180 compliant CSV field escaping. */
function csvField(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Quote the field if it contains a comma, double-quote, newline, or CR.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(values: (string | number | null | undefined)[]): string {
  return values.map(csvField).join(",");
}

/** GET /api/activities/[id]/export — admin exports responses as CSV.
 *  Format depends on the activity type:
 *   - POLL/VOTING: one row per participant with their selected option label.
 *   - SURVEY/FEEDBACK/KNOWLEDGE_CHECK/PRE_POST_ASSESSMENT: one row per participant
 *     with one column per question.
 *   - Q_AND_A: one row per submitted question with upvotes + status.
 *   - QUIZ/LIVE_QUIZ: refuse (use the existing assessment export).
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const activity = await db.activity.findUnique({
      where: { id },
      include: { questions: { orderBy: { sortOrder: "asc" } } },
    });
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    if (activity.type === "QUIZ" || activity.type === "LIVE_QUIZ") {
      return NextResponse.json(
        {
          error:
            "QUIZ-type activities use the assessment system. Export quiz attempts instead.",
        },
        { status: 400 }
      );
    }

    const responses = await db.activityResponse.findMany({
      where: { activityId: id },
      orderBy: { createdAt: "asc" },
    });

    const lines: string[] = [];

    if (activity.type === "Q_AND_A") {
      // Header: Participant, Question, Upvotes, Approved, Pinned, Answered, Hidden, Submitted At
      lines.push(
        row([
          "Participant",
          "Question",
          "Upvotes",
          "Approved",
          "Pinned",
          "Answered",
          "Hidden",
          "Submitted At",
        ])
      );
      // Sort by upvotes desc (matches results endpoint)
      const sorted = responses
        .map((r) => ({ r, meta: parseResponseMetadata(r.metadata) }))
        .sort((a, b) => (b.meta.upvotes ?? 0) - (a.meta.upvotes ?? 0));
      for (const { r, meta } of sorted) {
        lines.push(
          row([
            r.participantName ?? r.participantId ?? "",
            r.text ?? "",
            meta.upvotes ?? 0,
            meta.approved ? "Yes" : "No",
            meta.pinned ? "Yes" : "No",
            meta.answered ? "Yes" : "No",
            meta.hidden ? "Yes" : "No",
            r.createdAt.toISOString(),
          ])
        );
      }
    } else if (
      activity.type === "POLL" ||
      activity.type === "VOTING"
    ) {
      // One row per participant with their selected option label.
      lines.push(row(["Participant", "Selected Option", "Submitted At"]));
      // Group by participant (each poll participant has one response row).
      const byParticipant = new Map<
        string,
        { name: string; responseIds: string[]; createdAt: Date }
      >();
      const question = activity.questions[0];
      const opts = question ? parseJsonArray<string>(question.options) : [];
      for (const r of responses) {
        const key = r.participantId ?? r.participantName ?? r.id;
        const existing = byParticipant.get(key);
        if (existing) {
          existing.responseIds.push(r.id);
        } else {
          byParticipant.set(key, {
            name: r.participantName ?? r.participantId ?? "",
            responseIds: [r.id],
            createdAt: r.createdAt,
          });
        }
      }
      for (const { name, responseIds, createdAt } of byParticipant.values()) {
        // Collect all selected option labels from this participant's responses.
        const selectedLabels: string[] = [];
        for (const rid of responseIds) {
          const r = responses.find((x) => x.id === rid);
          if (!r) continue;
          const sel = parseJsonArray<number>(r.selectedOptions);
          for (const idx of sel) {
            if (idx >= 0 && idx < opts.length) {
              selectedLabels.push(opts[idx]);
            }
          }
        }
        lines.push(
          row([
            name,
            selectedLabels.join("; "),
            createdAt.toISOString(),
          ])
        );
      }
    } else {
      // SURVEY / FEEDBACK / KNOWLEDGE_CHECK / PRE_POST_ASSESSMENT
      // One row per participant with one column per question.
      const header = ["Participant", ...activity.questions.map((q) => q.text), "Submitted At"];
      lines.push(row(header));
      // Group responses by participant
      const byParticipant = new Map<
        string,
        { name: string; byQuestion: Map<string, any[]>; submittedAt: Date }
      >();
      for (const r of responses) {
        const key = r.participantId ?? r.participantName ?? r.id;
        const existing = byParticipant.get(key);
        if (existing) {
          if (r.questionId) {
            const arr = existing.byQuestion.get(r.questionId) ?? [];
            arr.push(r);
            existing.byQuestion.set(r.questionId, arr);
          }
          if (r.createdAt > existing.submittedAt) {
            existing.submittedAt = r.createdAt;
          }
        } else {
          const byQuestion = new Map<string, any[]>();
          if (r.questionId) {
            byQuestion.set(r.questionId, [r]);
          }
          byParticipant.set(key, {
            name: r.participantName ?? r.participantId ?? "",
            byQuestion,
            submittedAt: r.createdAt,
          });
        }
      }
      for (const { name, byQuestion, submittedAt } of byParticipant.values()) {
        const cells: string[] = [name];
        for (const q of activity.questions) {
          const arr = byQuestion.get(q.id) ?? [];
          const qOpts = parseJsonArray<string>(q.options);
          const values: string[] = [];
          for (const r of arr) {
            const sel = parseJsonArray<number>(r.selectedOptions);
            if (sel.length > 0) {
              for (const idx of sel) {
                if (idx >= 0 && idx < qOpts.length) values.push(qOpts[idx]);
              }
            }
            if (typeof r.ratingValue === "number") values.push(`Rating: ${r.ratingValue}/5`);
            if (typeof r.numberValue === "number") {
              // For YES_NO, 1=yes/0=no; otherwise show raw value.
              if (q.type === "YES_NO") {
                values.push(r.numberValue === 1 ? "Yes" : "No");
              } else {
                values.push(String(r.numberValue));
              }
            }
            if (r.text && r.text.trim()) values.push(r.text.trim());
          }
          cells.push(values.join(" | "));
        }
        cells.push(submittedAt.toISOString());
        lines.push(row(cells));
      }
    }

    const csv = lines.join("\r\n");
    const filename = `activity-${id}-responses.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
