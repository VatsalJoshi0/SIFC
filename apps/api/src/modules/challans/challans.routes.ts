import { Router } from "express";
import { challansController } from "./challans.controller.js";
import { requireCitizenAuth } from "../auth/auth.middleware.js";

export const challansRouter = Router();

challansRouter.use(requireCitizenAuth);

challansRouter.get("/", (req, res, next) => {
  challansController.listUserChallans(req, res).catch(next);
});

challansRouter.post("/:challanId/dispute", (req, res, next) => {
  challansController.disputeChallan(req, res).catch(next);
});
