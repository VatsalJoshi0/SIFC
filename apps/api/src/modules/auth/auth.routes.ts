import { Router } from "express";
import { authController } from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/otp/request", (req, res, next) => {
  authController.requestOtp(req, res).catch(next);
});

authRouter.post("/otp/verify", (req, res, next) => {
  authController.verifyOtp(req, res).catch(next);
});

authRouter.post("/refresh", (req, res, next) => {
  authController.refreshToken(req, res).catch(next);
});

authRouter.post("/logout", (req, res, next) => {
  authController.logout(req, res).catch(next);
});
