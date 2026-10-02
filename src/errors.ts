import type { Request, Response, NextFunction, ErrorRequestHandler } from "express"
import { z } from "zod"
import { HttpStatus, ErrorCode } from "./constants.js"

// Custom error with HTTP status and error code — throw anywhere, caught by errorHandler
export class AppError extends Error {
  constructor(
    public status: HttpStatus,
    public code: ErrorCode,
    message: string,
  ) {
    super(message)
  }
}

// Wraps async route handlers so rejected promises go to errorHandler instead of crashing
export function asyncHandler<P = Record<string, string>>(
  routeHandler: (req: Request<P>, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request<P>, res: Response, next: NextFunction) => {
    routeHandler(req, res, next).catch(next)
  }
}

// Builds a standardised { error: { code, message, details? } } response
function sendError(res: Response, status: HttpStatus, code: ErrorCode, message: string, details?: unknown[]) {
  const errorBody: { code: ErrorCode; message: string; details?: unknown[] } = { code, message }
  if (details) errorBody.details = details
  res.status(status).json({ error: errorBody })
}

// Express requires exactly 4 params to recognize this as error middleware
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    return sendError(res, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "Request validation failed", error.issues)
  }

  if (error instanceof AppError) {
    return sendError(res, error.status, error.code, error.message)
  }

  // Real cause in the response (e.g. "fetch failed: connect ECONNREFUSED 127.0.0.1:8317") so n8n shows
  // what broke. Fine because ai-toolbox is internal-only (not exposed by Caddy).
  console.error(error)
  const errorMessage = error instanceof Error ? error.message : String(error)
  const causeMessage = error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : ""
  sendError(res, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR, errorMessage + causeMessage)
}
