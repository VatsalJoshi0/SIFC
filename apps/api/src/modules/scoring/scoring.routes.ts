import { Router } from "express";
import { scoringController } from "./scoring.controller.js";
import { requireCitizenAuth } from "../auth/auth.middleware.js";

export const scoringRouter = Router();

scoringRouter.use(requireCitizenAuth);

scoringRouter.get("/", (req, res, next) => {
  scoringController.getScore(req, res).catch(next);
});

scoringRouter.get("/history", (req, res, next) => {
  scoringController.getHistory(req, res).catch(next);
});

scoringRouter.get("/ledger", (req, res, next) => {
  scoringController.getLedger(req, res).catch(next);
});
