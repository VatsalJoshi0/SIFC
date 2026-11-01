import type { Request, Response } from "express";
import { CreateQuoteRequestSchema, AppError } from "@vai/shared";
import { rewardsService } from "./rewards.service.js";

export class RewardsController {
  async getEligibilityAndQuote(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      throw new AppError(401, "TOKEN_INVALID", "Authentication required");
    }

    const parseResult = CreateQuoteRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "Request body did not match the schema",
        parseResult.error.flatten().fieldErrors
      );
    }

    const quote = await rewardsService.generateQuote(user.userId, parseResult.data);
    res.status(200).json(quote);
  }
}

export const rewardsController = new RewardsController();
