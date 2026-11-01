import { Router } from "express";
import { usersController } from "./users.controller.js";
import { requireCitizenAuth } from "../auth/auth.middleware.js";
import { vehiclesController } from "../vehicles/vehicles.controller.js";
import { challansController } from "../challans/challans.controller.js";
import { scoringRouter } from "../scoring/scoring.routes.js";

export const usersRouter = Router();

usersRouter.use(requireCitizenAuth);

usersRouter.get("/me", (req, res, next) => {
  usersController.getProfile(req, res).catch(next);
});

usersRouter.get("/me/consents", (req, res, next) => {
  usersController.getConsents(req, res).catch(next);
});

usersRouter.put("/me/consents", (req, res, next) => {
  usersController.updateConsents(req, res).catch(next);
});

usersRouter.get("/me/vehicles", (req, res, next) => {
  vehiclesController.listUserVehicles(req, res).catch(next);
});

usersRouter.get("/me/challans", (req, res, next) => {
  challansController.listUserChallans(req, res).catch(next);
});

usersRouter.use("/me/score", scoringRouter);
