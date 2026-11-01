import type { Request, Response, NextFunction } from "express";
import { AppError } from "@vai/shared";
import { tokenService } from "../auth/token.service.js";
import { prisma } from "../../db/client.js";

declare global {
  namespace Express {
    interface Request {
      admin?: {
        adminId: string;
        email: string;
        role: "SUPER_ADMIN" | "OPS" | "ANALYST";
      };
    }
  }
}

/**
 * Middleware enforcing Admin authentication and role-based access control (TRD 12.2, Spec Patch P9).
 */
export function requireAdminRole(allowedRoles: Array<"SUPER_ADMIN" | "OPS" | "ANALYST">) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let token = "";
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7).trim();
      } else if (req.query.token && typeof req.query.token === "string") {
        token = req.query.token;
      } else {
        return next(new AppError(401, "TOKEN_INVALID", "Missing or invalid Bearer authorization token"));
      }
      const payload = tokenService.verifyAccessToken(token);

      const admin = await prisma.admin.findUnique({
        where: { adminId: payload.userId }
      });

      if (!admin || !admin.isActive) {
        return next(new AppError(401, "TOKEN_INVALID", "Admin account inactive or not found"));
      }

      const adminRole = admin.role as "SUPER_ADMIN" | "OPS" | "ANALYST";

      // SUPER_ADMIN has access to all admin operations
      if (adminRole !== "SUPER_ADMIN" && !allowedRoles.includes(adminRole)) {
        return next(
          new AppError(
            403,
            "ROLE_FORBIDDEN",
            "Authenticated but role not permitted for the action"
          )
        );
      }

      req.admin = {
        adminId: admin.adminId,
        email: admin.email,
        role: adminRole
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
