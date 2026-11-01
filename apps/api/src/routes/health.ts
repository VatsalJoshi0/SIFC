import { Router, type Request, type Response } from "express";

export const healthRouter = Router();

healthRouter.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

healthRouter.get("/readyz", (_req: Request, res: Response) => {
  // In Phase 1, basic ready check. Phase 2 will check database connectivity.
  res.status(200).json({
    status: "ready",
    timestamp: new Date().toISOString()
  });
});
