import { NextResponse } from "next/server";

/**
 * Health check endpoint for deployment platforms.
 * Returns 200 when the service is running.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "engagio",
  });
}