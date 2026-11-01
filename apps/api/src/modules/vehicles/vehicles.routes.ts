import { Router } from "express";
import { vehiclesController } from "./vehicles.controller.js";
import { requireCitizenAuth } from "../auth/auth.middleware.js";

export const vehiclesRouter = Router();

vehiclesRouter.use(requireCitizenAuth);

vehiclesRouter.get("/", (req, res, next) => {
  vehiclesController.listUserVehicles(req, res).catch(next);
});

vehiclesRouter.get("/:idOrRegNo", (req, res, next) => {
  vehiclesController.getVehicleDetail(req, res).catch(next);
});

vehiclesRouter.get("/:idOrRegNo/challans", (req, res, next) => {
  vehiclesController.getVehicleChallans(req, res).catch(next);
});
