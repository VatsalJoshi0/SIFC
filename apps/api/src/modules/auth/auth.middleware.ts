import type { Request, Response, NextFunction } from "express";
import { AppError } from "@vai/shared";
import { tokenService } from "./token.service.js";
import { prisma } from "../../db/client.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
        panMasked: string;
        fullName: string;
      };
    }
  }
}

/**
 * Middleware enforcing valid citizen JWT access token (TRD 5.2, 8.3).
 */
export async function requireCitizenAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new AppError(401, "UNAUTHORIZED", "Missing or invalid Bearer authorization token"));
    }

    const token = authHeader.slice(7).trim();
    const payload = tokenService.verifyAccessToken(token);

    if (payload.role !== "CITIZEN" && payload.role !== "SUPER_ADMIN") {
      return next(new AppError(403, "FORBIDDEN", "Endpoint requires citizen credentials"));
    }

    const user = await prisma.user.findUnique({
      where: { userId: payload.userId }
    });

    if (!user || user.status !== "ACTIVE") {
      return next(new AppError(401, "ACCOUNT_INACTIVE", "User account is inactive or not found"));
    }

    req.user = {
      userId: user.userId,
      role: payload.role,
      panMasked: user.panMasked,
      fullName: user.fullName
    };

    next();
  } catch (err) {
    next(err);
  }
}
