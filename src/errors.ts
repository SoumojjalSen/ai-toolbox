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
  fn: (req: Request<P>, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request<P>, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}

// Builds a standardised { error: { code, message, details? } } response
function sendError(res: Response, status: HttpStatus, code: ErrorCode, message: string, details?: unknown[]) {
  const body: { code: ErrorCode; message: string; details?: unknown[] } = { code, message }
  if (details) body.details = details
  res.status(status).json({ error: body })
}

// Express requires exactly 4 params to recognize this as error middleware
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    return sendError(res, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "Request validation failed", err.issues)
  }

  if (err instanceof AppError) {
    return sendError(res, err.status, err.code, err.message)
  }

  console.error(err)
  sendError(res, HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR, "Internal server error")
}
