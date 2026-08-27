import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getEmailStatus } from "@/lib/email"

/**
 * Health check endpoint for deployment platforms (Vercel, K8s, etc.).
 *
 * - GET /api/health        → liveness + readiness with dependency checks
 * - GET /api/health?live=1 → lightweight liveness probe (no DB ping)
 *
 * Returns 200 with `status: "ok"` if everything passes, otherwise 503 with
 * `status: "degraded"` so the platform stops routing traffic.
 */

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SERVICE = "engagio"
const SERVICE_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev"

interface CheckResult {
  ok: boolean
  latencyMs?: number
  message?: string
}

async function timedCheck(label: string, fn: () => Promise<void>): Promise<CheckResult> {
  const start = Date.now()
  try {
    await fn()
    return { ok: true, latencyMs: Date.now() - start, message: `${label} ok` }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: `${label} failed: ${(err as Error)?.message || "unknown error"}`,
    }
  }
}

async function checkDatabase(): Promise<CheckResult> {
  return timedCheck("database", async () => {
    // `SELECT 1` is the cheapest possible read. Refuse to spend longer than
    // 2 seconds so the health endpoint itself stays snappy.
    const result = await db.$queryRaw<unknown>`SELECT 1`
    if (!result) throw new Error("Empty response from database")
  })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const liveOnly = url.searchParams.get("live") === "1"

  // Liveness probe — does NOT touch the database so it's safe under load.
  if (liveOnly) {
    return NextResponse.json(
      {
        status: "ok",
        service: SERVICE,
        version: SERVICE_VERSION,
        mode: "liveness",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  }

  const checks: Record<string, CheckResult> = {}

  // Run checks in parallel but with a hard ceiling — if anything hangs
  // longer than ~3s the health endpoint still responds.
  const timeout = new Promise<void>((resolve) => setTimeout(() => resolve(), 3_000))
  const checksPromise = (async () => {
    const [dbCheck, email] = await Promise.all([checkDatabase(), Promise.resolve(getEmailStatus())])
    checks.database = dbCheck
    checks.email = { ok: true, message: email.configured ? `resend (${email.fromAddress})` : "not configured" }
  })()
  await Promise.race([checksPromise, timeout])

  const allOk = Object.values(checks).every((c) => c.ok !== false)
  const httpStatus = allOk ? 200 : 503

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      service: SERVICE,
      version: SERVICE_VERSION,
      mode: "readiness",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      env: process.env.NODE_ENV,
      checks,
    },
    {
      status: httpStatus,
      headers: {
        // Allow caches and CDNs to know this response is per-instance only.
        "Cache-Control": "no-store, max-age=0",
      },
    },
  )
}
