import type { Request, Response } from "express";
import { otpService } from "./otp.service.js";
import { tokenService } from "./token.service.js";
import { AppError } from "@vai/shared";
import { getEnv } from "../../config/env.js";

export class AuthController {
  async requestOtp(req: Request, res: Response): Promise<void> {
    const { mobile, pan } = req.body;
    if (!mobile || !pan) {
      throw new AppError(400, "VALIDATION_ERROR", "mobile and pan are required fields");
    }

    const result = await otpService.requestOtp(mobile, pan);

    if (result.simulatedOtp) {
      res.setHeader("X-Simulated-OTP", result.simulatedOtp);
    }

    res.status(200).json({
      sessionId: result.sessionId,
      expiresIn: result.expiresIn,
      cooldownSeconds: result.cooldownSeconds,
      ...(result.simulatedOtp && { simulatedOtp: result.simulatedOtp })
    });
  }

  async verifyOtp(req: Request, res: Response): Promise<void> {
    const { sessionId, otp } = req.body;
    if (!sessionId || !otp) {
      throw new AppError(400, "VALIDATION_ERROR", "sessionId and otp are required fields");
    }

    const result = await otpService.verifyOtp(sessionId, otp);

    // Set refresh token in HttpOnly Strict cookie (TRD 8.3)
    res.cookie("vai_refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: getEnv().NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 86_400_000 // 7 days
    });

    res.status(200).json({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user
    });
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    const rawToken = req.cookies?.vai_refresh_token ?? req.body?.refreshToken;
    if (!rawToken) {
      throw new AppError(401, "UNAUTHORIZED", "Missing refresh token. Please log in again.");
    }

    const rotated = tokenService.rotateRefreshToken(rawToken);

    res.cookie("vai_refresh_token", rotated.refreshToken, {
      httpOnly: true,
      secure: getEnv().NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 86_400_000
    });

    res.status(200).json({
      accessToken: rotated.accessToken,
      expiresIn: rotated.expiresIn
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const rawToken = req.cookies?.vai_refresh_token ?? req.body?.refreshToken;
    if (rawToken) {
      tokenService.revokeByRawToken(rawToken);
    }

    res.clearCookie("vai_refresh_token", {
      httpOnly: true,
      secure: getEnv().NODE_ENV === "production",
      sameSite: "strict"
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  }
}

export const authController = new AuthController();
