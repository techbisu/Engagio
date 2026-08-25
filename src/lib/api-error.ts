/**
 * Standardized API error handling for Engagio.
 *
 * Goals:
 * - Never leak internal stack traces or Prisma error codes to clients.
 * - Always log a structured, request-id-tagged error server-side.
 * - Return a consistent JSON envelope with code + safe message.
 * - Map known conditions (ZodError, Prisma known errors, AppError) to the
 *   right HTTP status without forcing every route to know about them.
 */

import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { Prisma } from "@prisma/client"

/** Distinct error category that becomes the HTTP status + a stable `code`. */
export class AppError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly details?: unknown
  public readonly expose: boolean

  constructor(opts: {
    status: number
    code: string
    message: string
    details?: unknown
    expose?: boolean
  }) {
    super(opts.message)
    this.name = "AppError"
    this.status = opts.status
    this.code = opts.code
    this.details = opts.details
    this.expose = opts.expose ?? opts.status < 500
  }
}

/** Convenience constructors for common cases. */
export const httpError = {
  badRequest: (message = "Bad request", details?: unknown) =>
    new AppError({ status: 400, code: "BAD_REQUEST", message, details }),
  unauthorized: (message = "Unauthorized") =>
    new AppError({ status: 401, code: "UNAUTHORIZED", message }),
  forbidden: (message = "Forbidden") =>
    new AppError({ status: 403, code: "FORBIDDEN", message }),
  notFound: (message = "Not found") =>
    new AppError({ status: 404, code: "NOT_FOUND", message }),
  conflict: (message = "Conflict", details?: unknown) =>
    new AppError({ status: 409, code: "CONFLICT", message, details }),
  tooManyRequests: (message = "Too many requests") =>
    new AppError({ status: 429, code: "RATE_LIMITED", message }),
  internal: (message = "Internal server error") =>
    new AppError({ status: 500, code: "INTERNAL", message, expose: false }),
}

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: unknown
    requestId?: string
  }
}

export function generateRequestId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }
}

/**
 * Wrap a Next.js route handler so any thrown or rejected error is converted
 * to a structured response and logged with a request-id.
 *
 *   export const POST = withErrorHandling(async (req, ctx) => {
 *     ...
 *   })
 */
export function withErrorHandling<
  T extends (req: NextRequest, ctx: unknown) => Promise<Response | NextResponse> | Response | NextResponse,
>(handler: T) {
  return async function wrapped(req: NextRequest, ctx: unknown) {
    const requestId = req.headers.get("x-request-id") || generateRequestId()
    try {
      return await handler(req, ctx)
    } catch (err) {
      return handleApiError(err, requestId)
    }
  } as T
}

export function handleApiError(err: unknown, requestId: string): NextResponse {
  if (err instanceof AppError) {
    logError(err.code, err.message, requestId, err.details, err)
    if (err.expose) {
      return NextResponse.json<ApiErrorBody>(
        {
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
            requestId,
          },
        },
        { status: err.status },
      )
    }
    return genericServerError(requestId)
  }

  if (err instanceof ZodError) {
    logError("VALIDATION_ERROR", "Request validation failed", requestId, err.issues, err)
    return NextResponse.json<ApiErrorBody>(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          requestId,
        },
      },
      { status: 422 },
    )
  }

  // Prisma known errors — map to safe HTTP responses without leaking codes.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      logError("CONFLICT", "Unique constraint violation", requestId, undefined, err)
      return NextResponse.json<ApiErrorBody>(
        {
          error: {
            code: "CONFLICT",
            message: "A record with these values already exists",
            requestId,
          },
        },
        { status: 409 },
      )
    }
    if (err.code === "P2025") {
      logError("NOT_FOUND", "Record not found", requestId, undefined, err)
      return NextResponse.json<ApiErrorBody>(
        {
          error: {
            code: "NOT_FOUND",
            message: "Resource not found",
            requestId,
          },
        },
        { status: 404 },
      )
    }
    if (err.code === "P2003") {
      logError("CONFLICT", "Foreign key constraint failed", requestId, undefined, err)
      return NextResponse.json<ApiErrorBody>(
        {
          error: {
            code: "CONFLICT",
            message: "Cannot complete operation due to related records",
            requestId,
          },
        },
        { status: 409 },
      )
    }
    logError(`PRISMA_${err.code}`, "Database error", requestId, undefined, err)
    return genericServerError(requestId)
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logError("DATABASE_VALIDATION", "Database validation failed", requestId, undefined, err)
    return genericServerError(requestId)
  }

  logError("INTERNAL", "Unhandled exception", requestId, undefined, err)
  return genericServerError(requestId)
}

function genericServerError(requestId: string): NextResponse {
  return NextResponse.json<ApiErrorBody>(
    {
      error: {
        code: "INTERNAL",
        message: "An unexpected error occurred",
        requestId,
      },
    },
    { status: 500 },
  )
}

function logError(
  code: string,
  message: string,
  requestId: string,
  details: unknown,
  err?: unknown,
) {
  // Structured single-line log — easy to grep and ship to a log aggregator.
  const meta = {
    code,
    message,
    requestId,
    timestamp: new Date().toISOString(),
    ...(details !== undefined ? { details } : {}),
    ...(err instanceof Error ? { errorName: err.name, stack: err.stack } : {}),
  }
  console.error(`[api_error] ${JSON.stringify(meta)}`)
}

/**
 * Helper: convert a known error or thrown validation into an AppError so it
 * stays inside the safe-response envelope.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  if (err instanceof ZodError) {
    return new AppError({
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: err.issues,
    })
  }
  return httpError.internal()
}
