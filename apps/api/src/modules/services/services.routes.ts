import { Router } from "express";
import { rewardsController } from "../rewards/rewards.controller.js";
import { requireCitizenAuth } from "../auth/auth.middleware.js";

export const servicesRouter = Router();

// POST /api/v1/services/quotes (TRD 7.1)
servicesRouter.post("/quotes", requireCitizenAuth, (req, res, next) => {
  rewardsController.getEligibilityAndQuote(req, res).catch(next);
});
