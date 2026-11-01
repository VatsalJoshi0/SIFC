import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { prisma } from "../../db/client.js";
import { AppError } from "@vai/shared";

export class ChallansController {
  async listUserChallans(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { status, severity, vehicleId, startDate, endDate, limit = "20", cursor } = req.query;

    const takeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const where: Prisma.ChallanWhereInput = { userId };

    if (status && typeof status === "string") {
      where.status = status.toUpperCase();
    }
    if (severity && typeof severity === "string") {
      where.severity = severity.toUpperCase();
    }
    if (vehicleId && typeof vehicleId === "string") {
      where.vehicleId = vehicleId;
    }

    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate && typeof startDate === "string") {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate && typeof endDate === "string") {
      dateFilter.lte = new Date(endDate);
    }
    if (Object.keys(dateFilter).length > 0) {
      where.challanDate = dateFilter;
    }

    const [totalCount, items] = await Promise.all([
      prisma.challan.count({ where }),
      prisma.challan.findMany({
        where,
        take: takeLimit + 1,
        cursor: cursor && typeof cursor === "string" ? { challanId: cursor } : undefined,
        skip: cursor ? 1 : 0,
        orderBy: { challanDate: "desc" },
        include: {
          vehicle: {
            select: { registrationNo: true, manufacturer: true, model: true }
          }
        }
      })
    ]);

    let nextCursor: string | null = null;
    if (items.length > takeLimit) {
      const next = items.pop();
      nextCursor = next ? next.challanId : null;
    }

    res.status(200).json({
      items: items.map((c) => ({
        challanId: c.challanId,
        vehicleId: c.vehicleId,
        registrationNo: c.vehicle.registrationNo,
        challanDate: c.challanDate,
        challanType: c.challanType,
        violationCode: c.violationCode,
        violationDesc: c.violationDesc,
        severity: c.severity,
        amountPaise: Number(c.amountPaise),
        status: c.status,
        dueDate: c.dueDate,
        paymentDate: c.paymentDate,
        scoringEligible: c.scoringEligible
      })),
      nextCursor,
      totalCount
    });
  }

  async disputeChallan(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { challanId } = req.params;
    const reason = req.body.reason || req.body.note;

    if (!challanId) {
      throw new AppError(400, "VALIDATION_ERROR", "Challan ID is required");
    }
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      throw new AppError(400, "VALIDATION_ERROR", "A reason of at least 5 characters is required to dispute a challan");
    }

    // 1. Fetch challan and verify ownership
    const challan = await prisma.challan.findUnique({
      where: { challanId }
    });

    if (!challan || challan.userId !== userId) {
      throw new AppError(404, "CHALLAN_NOT_FOUND", "Challan not found");
    }

    // P7 invariant: Only PENDING challans can be disputed by citizens
    if (challan.status !== "PENDING") {
      throw new AppError(
        400,
        "CHALLAN_NOT_DISPUTABLE",
        `Only challans with PENDING status can be disputed. Current status is ${challan.status}.`
      );
    }

    // 2. Perform dispute in atomic transaction
    const disputeId = `DISP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Update challan to DISPUTED and scoringEligible = false
      const updated = await tx.challan.update({
        where: { challanId },
        data: {
          status: "DISPUTED",
          scoringEligible: false
        }
      });

      // Create dispute record
      const dispute = await tx.dispute.create({
        data: {
          disputeId,
          challanId,
          userId,
          openedAt: now,
          note: reason.trim()
        }
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          actorType: "CITIZEN",
          actorId: userId,
          action: "DISPUTE_OPENED",
          entityType: "CHALLAN",
          entityId: challanId,
          beforeJson: JSON.stringify({ status: challan.status, scoringEligible: challan.scoringEligible }),
          afterJson: JSON.stringify({ status: updated.status, scoringEligible: updated.scoringEligible, disputeId })
        }
      });

      return { dispute, updated };
    });

    res.status(200).json({
      disputeId: result.dispute.disputeId,
      challanId: result.updated.challanId,
      status: result.updated.status,
      message: "Dispute submitted successfully. Challan is excluded from scoring pending review."
    });
  }
}

export const challansController = new ChallansController();
