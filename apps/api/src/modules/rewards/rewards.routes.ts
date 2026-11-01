import { Router } from "express";
import { rewardsController } from "./rewards.controller.js";
import { requireCitizenAuth } from "../auth/auth.middleware.js";

export const rewardsRouter = Router();

// POST /api/v1/rewards/eligibility (TRD 7.1, 7.4)
rewardsRouter.post("/eligibility", requireCitizenAuth, (req, res, next) => {
  rewardsController.getEligibilityAndQuote(req, res).catch(next);
});
