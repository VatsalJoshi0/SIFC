import express, { type Express } from "express";
import type { IncomingMessage } from "node:http";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";

import { getEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { apiV1Router } from "./routes/api.js";

export function createApp(): Express {
  const env = getEnv();
  const app = express();

  // 1. Request ID header (TRD 5.2)
  app.use(requestIdMiddleware);

  // 2. Structured logging context with redaction (TRD 5.2 & 17.3)
  app.use(
    pinoHttp({
      logger,
      genReqId: (req: IncomingMessage & { requestId?: string }) => req.requestId || "unknown",
      autoLogging: env.NODE_ENV !== "test"
    })
  );

  // 3. Security headers (TRD 12.3)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"]
        }
      },
      frameguard: { action: "deny" }
    })
  );

  // 4. CORS allow-list (TRD 12.3)
  app.use(
    cors({
      origin: [env.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    })
  );

  // 5. Body size limit (100 KB) and cookie parsing (TRD 12.3)
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  // 6. Rate limiting (TRD 8.2)
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300, // 300 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
        requestId: "rate_limit",
        details: null
      }
    }
  });
  app.use(generalLimiter);

  // Health and readiness routes
  app.use(healthRouter);

  // VAI API v1 routes
  app.use("/api/v1", apiV1Router);

  // Root welcome route
  app.get("/", (_req, res) => {
    res.json({
      name: "Vehicle Accountability Index (VAI) API",
      version: "1.0.0-prototype",
      docs: "/api/v1",
      banner: "Prototype - simulated OTP - do not enter a real PAN"
    });
  });

  // Error handling middleware (always last)
  app.use(errorHandler);

  return app;
}

export function startServer(): void {
  const env = getEnv();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, `🚀 VAI API server listening on port ${env.PORT}`);
  });

  // Graceful shutdown (TRD 14.2: within 20 seconds)
  const shutdown = (signal: string) => {
    logger.info({ signal }, "Received shutdown signal. Gracefully closing HTTP server...");
    server.close(() => {
      logger.info("HTTP server closed.");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 20000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
