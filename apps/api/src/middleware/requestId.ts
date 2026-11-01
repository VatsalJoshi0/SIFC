import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Middleware: Attaches a unique X-Request-Id header to incoming requests and outgoing responses.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header("X-Request-Id");
  const requestId = incomingId && incomingId.length <= 64 ? incomingId : `req_${crypto.randomUUID().replace(/-/g, "")}`;
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}
