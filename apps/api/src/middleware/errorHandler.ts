import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, ErrorCode, type ApiErrorEnvelope } from "@vai/shared";
import { logger } from "../lib/logger.js";

/**
 * Standard error handling middleware per TRD Section 17.
 * Always formats errors in the standardized { error: { code, message, requestId, details } } envelope.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || "unknown";

  // Case 1: Known domain/operational AppError
  if (err instanceof AppError) {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: err.code,
        message: err.message,
        requestId,
        details: err.details ?? null
      }
    };
    logger.warn({ err, requestId, route: req.path }, err.message);
    res.status(err.statusCode).json(envelope);
    return;
  }

  // Case 2: Zod validation error
  if (err instanceof ZodError) {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: ErrorCode.VALIDATION_FAILED,
        message: "Request body or parameters did not match the schema",
        requestId,
        details: err.errors
      }
    };
    logger.warn({ err: err.errors, requestId, route: req.path }, "Validation failed");
    res.status(400).json(envelope);
    return;
  }

  // Case 3: JSON syntax parse error or body limit breach
  if (err instanceof SyntaxError && "status" in err && (err as { status?: number }).status === 400) {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: ErrorCode.VALIDATION_FAILED,
        message: "Malformed JSON payload",
        requestId,
        details: null
      }
    };
    res.status(400).json(envelope);
    return;
  }

  // Case 4: Unexpected unhandled error
  logger.error({ err, requestId, route: req.path }, "Unhandled internal error");
  const envelope: ApiErrorEnvelope = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: "An unexpected error occurred. Please try again later.",
      requestId,
      details: null
    }
  };
  res.status(500).json(envelope);
}
