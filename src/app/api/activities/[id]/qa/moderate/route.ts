import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, ownsResource } from "@/lib/tenant";
import { parseResponseMetadata, toActivityResponseDto } from "@/lib/activity-mapper";

type RouteContext = { params: Promise<{ id: string }> };

/** Allowed moderation actions on a Q&A response. */
const VALID_ACTIONS = new Set([
  "approve",
  "hide",
  "pin",
  "unpin",
  "answered",
  "unanswered",
]);

/** POST /api/activities/[id]/qa/moderate — admin toggles moderation flags
 *  on a Q&A response.
 *  Body: { responseId, action }
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePermission(req, "activity.moderate");
    if (!auth.ok) {
      if (auth.legacyAdmin) {
        return NextResponse.json({ error: "No organization context" }, { status: 403 });
      }
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await ctx.params;
    const activity = await db.activity.findUnique({
      where: { id },
      select: { id: true },
      include: { event: { select: { organizationId: true } } },
    });
    if (!activity || !ownsResource(activity.event, auth.ctx)) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const body = await req.json();
    const { responseId, action } = body || {};
    if (typeof responseId !== "string" || !responseId) {
      return NextResponse.json(
        { error: "responseId is required" },
        { status: 400 }
      );
    }
    if (typeof action !== "string" || !VALID_ACTIONS.has(action)) {
      return NextResponse.json(
        {
          error:
            'action must be one of "approve" | "hide" | "pin" | "unpin" | "answered" | "unanswered"',
        },
        { status: 400 }
      );
    }

    const existing = await db.activityResponse.findFirst({
      where: { id: responseId, activityId: id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Response not found" },
        { status: 404 }
      );
    }

    const meta = parseResponseMetadata(existing.metadata);
    switch (action) {
      case "approve":
        meta.approved = true;
        break;
      case "hide":
        meta.hidden = true;
        break;
      case "pin":
        meta.pinned = true;
        break;
      case "unpin":
        meta.pinned = false;
        break;
      case "answered":
        meta.answered = true;
        break;
      case "unanswered":
        meta.answered = false;
        break;
    }

    const updated = await db.activityResponse.update({
      where: { id: responseId },
      data: { metadata: JSON.stringify(meta) },
    });

    return NextResponse.json({
      success: true,
      response: toActivityResponseDto(updated),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
