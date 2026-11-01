import type { Request, Response } from "express";
import crypto from "node:crypto";
import { prisma } from "../../db/client.js";
import { AppError, maskMobile } from "@vai/shared";

const VALID_PURPOSES = new Set(["IDENTITY_VERIFICATION", "VAI_SCORING", "REWARD_DISCOUNT"]);
const CONSENT_TEXT_HASH = crypto
  .createHash("sha256")
  .update("VAI Citizen Consent v1.0 - DPDP Act 2023 Compliant")
  .digest("hex");

export class UsersController {
  async getProfile(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { userId },
      include: {
        _count: { select: { vehicles: true } }
      }
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "Citizen profile not found");
    }

    res.status(200).json({
      userId: user.userId,
      fullName: user.fullName,
      mobileMasked: maskMobile(user.mobileE164),
      panMasked: user.panMasked,
      city: user.city,
      state: user.state,
      registrationDate: user.registrationDate,
      status: user.status,
      vehicleCount: user._count.vehicles
    });
  }

  async getConsents(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;

    const records = await prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { capturedAt: "desc" }
    });

    // Group by purpose to show latest consent status
    const latestByPurpose = new Map<string, (typeof records)[0]>();
    for (const r of records) {
      if (!latestByPurpose.has(r.purpose)) {
        latestByPurpose.set(r.purpose, r);
      }
    }

    const consentList = Array.from(latestByPurpose.values()).map((c) => ({
      consentId: c.consentId,
      purpose: c.purpose,
      granted: c.granted,
      capturedAt: c.capturedAt,
      withdrawnAt: c.withdrawnAt
    }));

    res.status(200).json({
      consents: consentList
    });
  }

  async updateConsents(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { consents } = req.body;

    if (!Array.isArray(consents) || consents.length === 0) {
      throw new AppError(400, "VALIDATION_ERROR", "consents array is required");
    }

    const created = [];
    const now = new Date();

    for (const item of consents) {
      if (!item.purpose || typeof item.granted !== "boolean") {
        throw new AppError(400, "VALIDATION_ERROR", "Each consent must have purpose and granted boolean");
      }
      if (!VALID_PURPOSES.has(item.purpose)) {
        throw new AppError(
          400,
          "INVALID_CONSENT_PURPOSE",
          `Invalid consent purpose: ${item.purpose}. Valid purposes are: ${Array.from(VALID_PURPOSES).join(", ")}`
        );
      }

      const record = await prisma.consentRecord.create({
        data: {
          userId,
          purpose: item.purpose,
          granted: item.granted,
          versionTextHash: CONSENT_TEXT_HASH,
          capturedAt: now,
          withdrawnAt: item.granted ? null : now
        }
      });
      created.push(record);
    }

    res.status(200).json({
      success: true,
      updatedCount: created.length,
      updatedAt: now.toISOString()
    });
  }
}

export const usersController = new UsersController();
