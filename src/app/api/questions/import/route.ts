import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { parseCsvQuestions } from "@/lib/csv";

async function requireAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.role === "ADMIN";
}

/**
 * POST /api/questions/import
 *
 * Accepts either:
 *  - multipart/form-data with fields `eventId` and `file` (CSV text file)
 *  - application/json with `{ eventId, csvText }`
 *
 * Returns `{ imported: number, errors: string[] }`.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let eventId: string | undefined;
    let csvText: string | undefined;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      eventId = (form.get("eventId") as string)?.toString();
      const file = form.get("file");
      if (file instanceof File) {
        csvText = await file.text();
      } else if (typeof file === "string") {
        csvText = file;
      }
    } else {
      const body = await req.json();
      eventId = body?.eventId;
      csvText = body?.csvText;
    }

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }
    if (!csvText || !csvText.trim()) {
      return NextResponse.json({ error: "CSV content is empty" }, { status: 400 });
    }

    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const { rows, errors } = parseCsvQuestions(csvText);
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json(
        { errors: ["No valid question rows found in CSV."] },
        { status: 400 }
      );
    }

    // Determine the starting order index.
    const lastQuestion = await db.question.findFirst({
      where: { eventId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    let nextOrder = (lastQuestion?.order ?? -1) + 1;

    await db.$transaction(
      rows.map((row) =>
        db.question.create({
          data: {
            eventId,
            question: row.question,
            options: JSON.stringify(row.options),
            correctAnswer: row.correctAnswer,
            marks: typeof row.marks === "number" && row.marks > 0 ? Math.floor(row.marks) : 1,
            order: nextOrder++,
            explanation: row.explanation || null,
          },
        })
      )
    );

    return NextResponse.json({ imported: rows.length, errors: [] });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: String(e) },
      { status: 500 }
    );
  }
}
