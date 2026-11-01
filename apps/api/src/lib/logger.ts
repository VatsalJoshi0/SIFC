import pino from "pino";
import { getEnv } from "../config/env.js";

const env = getEnv();

/**
 * Redaction list per TRD 12.1 and 17.3:
 * Prohibited content: PAN, full mobile, OTP values, tokens, passwords.
 */
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "pan",
      "req.body.pan",
      "otp",
      "req.body.otp",
      "password",
      "req.body.password",
      "token",
      "req.headers.authorization",
      "req.headers.cookie",
      "accessToken",
      "refreshToken"
    ],
    censor: "[REDACTED]"
  },
  base: {
    service: "vai-api"
  },
  timestamp: pino.stdTimeFunctions.isoTime
});
