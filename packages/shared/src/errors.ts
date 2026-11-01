/**
 * Error envelope and standardized error codes per TRD Section 17.
 */

export const ErrorCode = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  TOKEN_INVALID: "TOKEN_INVALID",
  ROLE_FORBIDDEN: "ROLE_FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  QUOTE_STALE: "QUOTE_STALE",
  TXN_STATE_INVALID: "TXN_STATE_INVALID",
  CONFIG_CONFLICT: "CONFIG_CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  ADAPTER_UNAVAILABLE: "ADAPTER_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  OTP_EXPIRED: "OTP_EXPIRED",
  OTP_INVALID: "OTP_INVALID",
  OTP_ATTEMPTS_EXCEEDED: "OTP_ATTEMPTS_EXCEEDED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  UNAUTHORIZED: "UNAUTHORIZED"
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
}

export interface ApiErrorEnvelope {
  error: ApiErrorPayload;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
