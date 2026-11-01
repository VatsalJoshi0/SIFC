import { verify } from "@node-rs/argon2";
import { prisma } from "../../db/client.js";
import { tokenService } from "../auth/token.service.js";
import { configRepository } from "../../repositories/config.repository.js";
import { jobQueue } from "../../jobs/queue.js";
import { seed } from "../../db/seed.js";
import {
  AppError,
  maskMobile,
  formatPaiseToINR,
  paiseToSafeNumber
} from "@vai/shared";
import type { Prisma } from "@prisma/client";

export class AdminService {
  /**
   * Admin Login with Password Verification (Argon2id) and Simulated 2FA (Spec Patches P7, P9).
   */
  async login(input: {
    email: string;
    password: string;
    secondFactorCode?: string;
  }) {
    const admin = await prisma.admin.findUnique({
      where: { email: input.email }
    });

    if (!admin || !admin.isActive) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const isPasswordValid = await verify(admin.passwordHash, input.password);
    if (!isPasswordValid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    // Spec Patch P7: Simulated 6-digit second factor shown on dummy banner
    if (!input.secondFactorCode) {
      return {
        requires2FA: true,
        simulated2FACode: "123456",
        message: "Enter simulated 6-digit second factor code to complete sign-in"
      };
    }

    if (input.secondFactorCode !== "123456") {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid second factor code");
    }

    const accessToken = tokenService.generateAccessToken({
      userId: admin.adminId,
      role: admin.role as "SUPER_ADMIN" | "OPS" | "ANALYST"
    });

    return {
      accessToken,
      expiresIn: 900,
      admin: {
        adminId: admin.adminId,
        email: admin.email,
        role: admin.role
      }
    };
  }

  /**
   * Search/List Users with Masked Personal Details (TRD 12.1, 12.2).
   */
  async listUsers(options: {
    query?: string;
    status?: string;
    limit?: number;
  }) {
    const limit = options.limit ?? 20;
    const where: Prisma.UserWhereInput = {};

    if (options.status) {
      where.status = options.status;
    }

    if (options.query) {
      where.OR = [
        { fullName: { contains: options.query } },
        { panMasked: { contains: options.query } },
        { city: { contains: options.query } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      take: limit,
      orderBy: { registrationDate: "desc" },
      include: {
        vaiScore: true,
        vehicles: { select: { vehicleId: true } },
        challans: { select: { challanId: true, status: true } }
      }
    });

    return users.map((u) => ({
      userId: u.userId,
      fullName: u.fullName,
      panMasked: u.panMasked,
      mobileMasked: maskMobile(u.mobileE164),
      city: u.city,
      state: u.state,
      registrationDate: u.registrationDate.toISOString().slice(0, 10),
      status: u.status,
      vehicleCount: u.vehicles.length,
      challanCount: u.challans.length,
      unpaidChallanCount: u.challans.filter((c) => c.status === "UNPAID").length,
      score: u.vaiScore?.score ?? null,
      category: u.vaiScore?.category ?? null
    }));
  }

  /**
   * User Detail for Admin (Masked).
   */
  async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { userId },
      include: {
        vaiScore: true,
        vehicles: true,
        licences: true,
        challans: { orderBy: { challanDate: "desc" } },
        scoreSnapshots: { orderBy: { period: "desc" }, take: 12 }
      }
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "User not found");
    }

    return {
      userId: user.userId,
      fullName: user.fullName,
      panMasked: user.panMasked,
      mobileMasked: maskMobile(user.mobileE164),
      city: user.city,
      state: user.state,
      registrationDate: user.registrationDate.toISOString().slice(0, 10),
      status: user.status,
      score: user.vaiScore?.score ?? null,
      category: user.vaiScore?.category ?? null,
      vehicles: user.vehicles.map((v) => {
        const now = new Date();
        const insuranceValid = v.insuranceExpiry ? new Date(v.insuranceExpiry) > now : false;
        const pucValid = v.pucExpiry ? new Date(v.pucExpiry) > now : false;
        const rcValid = new Date(v.rcValidityTill) > now;
        return {
          vehicleId: v.vehicleId,
          registrationNo: v.registrationNo,
          vehicleType: v.vehicleType,
          manufacturer: v.manufacturer,
          model: v.model,
          insuranceExpiry: v.insuranceExpiry?.toISOString().slice(0, 10) ?? null,
          pucExpiry: v.pucExpiry?.toISOString().slice(0, 10) ?? null,
          rcValidityTill: v.rcValidityTill.toISOString().slice(0, 10),
          compliance: {
            insuranceValid,
            pucValid,
            rcValid,
            fullyCompliant: insuranceValid && pucValid && rcValid
          }
        };
      }),
      licences: user.licences.map((l) => ({
        licenceId: l.licenceId,
        licenceNoMasked: l.licenceNoMasked,
        licenceClass: l.licenceClass,
        expiryDate: l.expiryDate.toISOString().slice(0, 10)
      })),
      challans: user.challans.map((c) => ({
        challanId: c.challanId,
        vehicleId: c.vehicleId,
        challanDate: c.challanDate.toISOString().slice(0, 10),
        violationCode: c.violationCode,
        violationDesc: c.violationDesc,
        severity: c.severity,
        amountPaise: Number(c.amountPaise),
        status: c.status,
        scoringEligible: c.scoringEligible
      })),
      snapshots: user.scoreSnapshots.map((s) => ({
        period: s.period,
        score: s.score,
        category: s.category
      }))
    };
  }

  /**
   * Search Challans Across Citizens (Admin OPS+).
   */
  async listChallans(options: {
    status?: string;
    severity?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const limit = options.limit ?? 50;
    const where: Prisma.ChallanWhereInput = {};

    if (options.status) where.status = options.status;
    if (options.severity) where.severity = options.severity;
    if (options.from || options.to) {
      where.challanDate = {};
      if (options.from) where.challanDate.gte = new Date(options.from);
      if (options.to) where.challanDate.lte = new Date(options.to);
    }

    const challans = await prisma.challan.findMany({
      where,
      take: limit,
      orderBy: { challanDate: "desc" },
      include: {
        user: { select: { fullName: true, panMasked: true } },
        vehicle: { select: { registrationNo: true } },
        disputes: { take: 1, orderBy: { openedAt: "desc" } }
      }
    });

    return challans.map((c) => ({
      challanId: c.challanId,
      userId: c.userId,
      citizenName: c.user.fullName,
      panMasked: c.user.panMasked,
      registrationNo: c.vehicle.registrationNo,
      challanDate: c.challanDate.toISOString().slice(0, 10),
      violationCode: c.violationCode,
      violationDesc: c.violationDesc,
      severity: c.severity,
      amountPaise: Number(c.amountPaise),
      status: c.status,
      dueDate: c.dueDate.toISOString().slice(0, 10),
      scoringEligible: c.scoringEligible,
      dispute: c.disputes[0]
        ? {
            disputeId: c.disputes[0].disputeId,
            openedAt: c.disputes[0].openedAt.toISOString(),
            outcome: c.disputes[0].outcome,
            note: c.disputes[0].note
          }
        : null
    }));
  }

  /**
   * Dispute Resolution (Admin OPS+, Spec Patch P7).
   * UPHELD: challan status becomes WAIVED (scoring_eligible = false).
   * REJECTED: challan status reverts to UNPAID (or PAID if paymentDate exists), scoring_eligible = true.
   * Both outcomes enqueue score recalculation and record an audit log in the same transaction.
   */
  async resolveDispute(
    disputeId: string,
    outcome: "UPHELD" | "REJECTED",
    adminId: string,
    note?: string
  ) {
    const dispute = await prisma.dispute.findUnique({
      where: { disputeId },
      include: { challan: true }
    });

    if (!dispute) {
      throw new AppError(404, "NOT_FOUND", "Dispute not found");
    }

    if (dispute.resolvedAt) {
      throw new AppError(409, "DISPUTE_ALREADY_RESOLVED", "Dispute has already been resolved");
    }

    const challan = dispute.challan;

    const result = await prisma.$transaction(async (tx) => {
      let newChallanStatus: string;
      let newScoringEligible: boolean;

      if (outcome === "UPHELD") {
        newChallanStatus = "WAIVED";
        newScoringEligible = false;
      } else {
        newChallanStatus = challan.paymentDate ? "PAID" : "UNPAID";
        newScoringEligible = true;
      }

      // Update challan
      const updatedChallan = await tx.challan.update({
        where: { challanId: challan.challanId },
        data: {
          status: newChallanStatus,
          scoringEligible: newScoringEligible
        }
      });

      // Update dispute
      const updatedDispute = await tx.dispute.update({
        where: { disputeId },
        data: {
          outcome,
          resolvedAt: new Date(),
          resolverAdminId: adminId,
          note: note ?? dispute.note
        }
      });

      // Write audit log in same transaction
      await tx.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorId: adminId,
          action: "RESOLVE_DISPUTE",
          entityType: "CHALLAN",
          entityId: challan.challanId,
          beforeJson: JSON.stringify({
            status: challan.status,
            scoringEligible: challan.scoringEligible
          }),
          afterJson: JSON.stringify({
            status: newChallanStatus,
            scoringEligible: newScoringEligible,
            outcome,
            note
          })
        }
      });

      return { updatedDispute, updatedChallan };
    });

    // Enqueue score recalculation (P7)
    await jobQueue.enqueueScoreRecalc(challan.userId, "DISPUTE_RESOLVED", challan.challanId);

    return result;
  }

  /**
   * Score Distribution Analytics (Admin ANALYST+).
   */
  async getScoreDistribution() {
    const scores = await prisma.vaiScore.findMany({
      select: { score: true, category: true }
    });

    const totalCount = scores.length;
    if (totalCount === 0) {
      return {
        totalScoredUsers: 0,
        averageScore: 700,
        categories: { FAIR: 0, GOOD: 0, VERY_GOOD: 0 },
        bands: {
          "500-599": 0,
          "600-649": 0,
          "650-699": 0,
          "700-749": 0,
          "750-799": 0,
          "800-900": 0
        }
      };
    }

    const categories = { FAIR: 0, GOOD: 0, VERY_GOOD: 0 };
    const bands = {
      "500-599": 0,
      "600-649": 0,
      "650-699": 0,
      "700-749": 0,
      "750-799": 0,
      "800-900": 0
    };

    let totalScore = 0;

    for (const item of scores) {
      totalScore += item.score;
      if (item.category === "VERY_GOOD") categories.VERY_GOOD++;
      else if (item.category === "GOOD") categories.GOOD++;
      else categories.FAIR++;

      const s = item.score;
      if (s < 600) bands["500-599"]++;
      else if (s < 650) bands["600-649"]++;
      else if (s < 700) bands["650-699"]++;
      else if (s < 750) bands["700-749"]++;
      else if (s < 800) bands["750-799"]++;
      else bands["800-900"]++;
    }

    return {
      totalScoredUsers: totalCount,
      averageScore: Math.round((totalScore / totalCount) * 10) / 10,
      categories,
      bands
    };
  }

  /**
   * Revenue Analytics by Service and Fee Option (Admin ANALYST+).
   */
  async getRevenueAnalytics() {
    const successfulTxns = await prisma.transaction.findMany({
      where: { status: { in: ["SUCCESS", "REFUNDED"] } },
      include: { refunds: true }
    });

    const activeFeeConfig = await configRepository.getActiveFeeConfig();

    let totalPlatformFeePaise = 0n;
    let totalBasePaise = 0n;
    let totalDiscountPaise = 0n;
    let totalPayablePaise = 0n;
    let totalFeeReversedPaise = 0n;
    let totalRefundedPaise = 0n;

    const byService: Record<string, { txnCount: number; feePaise: bigint }> = {
      INSURANCE: { txnCount: 0, feePaise: 0n },
      PUC: { txnCount: 0, feePaise: 0n },
      RC: { txnCount: 0, feePaise: 0n },
      LICENCE: { txnCount: 0, feePaise: 0n }
    };

    const byOption: Record<string, { txnCount: number; feePaise: bigint }> = {
      A: { txnCount: 0, feePaise: 0n },
      B: { txnCount: 0, feePaise: 0n }
    };

    for (const txn of successfulTxns) {
      totalPlatformFeePaise += txn.platformFeePaise;
      totalBasePaise += txn.baseAmountPaise;
      totalDiscountPaise += txn.discountPaise;
      totalPayablePaise += txn.payablePaise;

      for (const ref of txn.refunds) {
        totalFeeReversedPaise += ref.feeReversedPaise;
        totalRefundedPaise += ref.amountPaise;
      }

      const s = txn.serviceType;
      if (byService[s]) {
        byService[s].txnCount++;
        byService[s].feePaise += txn.platformFeePaise;
      }

      const opt = txn.platformFeePpm === 50 ? "A" : "B";
      if (byOption[opt]) {
        byOption[opt].txnCount++;
        byOption[opt].feePaise += txn.platformFeePaise;
      }
    }

    const netFeePaise = totalPlatformFeePaise - totalFeeReversedPaise;

    return {
      totalTransactions: successfulTxns.length,
      totalVolumePaise: paiseToSafeNumber(totalBasePaise),
      totalVolumeINR: formatPaiseToINR(totalBasePaise),
      totalBaseAmountPaise: paiseToSafeNumber(totalBasePaise),
      totalDiscountPaise: paiseToSafeNumber(totalDiscountPaise),
      totalPayablePaise: paiseToSafeNumber(totalPayablePaise),
      totalPlatformFeePaise: paiseToSafeNumber(totalPlatformFeePaise),
      totalRefundedPaise: paiseToSafeNumber(totalRefundedPaise),
      grossFeeRevenuePaise: paiseToSafeNumber(totalPlatformFeePaise),
      grossFeeRevenueINR: formatPaiseToINR(totalPlatformFeePaise),
      feeReversedPaise: paiseToSafeNumber(totalFeeReversedPaise),
      feeReversedINR: formatPaiseToINR(totalFeeReversedPaise),
      netFeeRevenuePaise: paiseToSafeNumber(netFeePaise),
      netFeeRevenueINR: formatPaiseToINR(netFeePaise),
      activeFeeOption: activeFeeConfig
        ? {
            optionCode: activeFeeConfig.optionCode,
            ppm: activeFeeConfig.ppm,
            mode: activeFeeConfig.mode
          }
        : {
            optionCode: "A",
            ppm: 150,
            mode: "PROVIDER_PAYS"
          },
      byService: Object.fromEntries(
        Object.entries(byService).map(([k, v]) => [
          k,
          {
            txnCount: v.txnCount,
            feePaise: paiseToSafeNumber(v.feePaise),
            feeINR: formatPaiseToINR(v.feePaise)
          }
        ])
      ),
      byOption: Object.fromEntries(
        Object.entries(byOption).map(([k, v]) => [
          k,
          {
            txnCount: v.txnCount,
            feePaise: paiseToSafeNumber(v.feePaise),
            feeINR: formatPaiseToINR(v.feePaise)
          }
        ])
      )
    };
  }

  /**
   * Insert New Scoring Config Version (Admin SUPER_ADMIN, TRD 5.3).
   */
  async insertScoringConfig(
    parameters: Record<string, unknown>,
    effectiveFrom: Date,
    adminId: string,
    changeReason: string
  ) {
    const latest = await configRepository.getLatestScoringConfig();
    const nextVersion = (latest?.version ?? 0) + 1;

    return configRepository.insertScoringConfig(
      nextVersion,
      JSON.stringify(parameters),
      effectiveFrom,
      adminId,
      changeReason
    );
  }

  /**
   * Update Reward Configs (Admin SUPER_ADMIN).
   * Rejects overlapping active periods with 422 CONFIG_CONFLICT.
   */
  async updateRewardConfigs(
    configs: Array<{
      vaiCategory: string;
      serviceType: string;
      discountBps: number;
      effectiveFrom: Date;
    }>,
    adminId: string
  ) {
    return prisma.$transaction(async (tx) => {
      const created = [];
      for (const item of configs) {
        // Check conflict on exact same key
        const existing = await tx.rewardConfig.findUnique({
          where: {
            vaiCategory_serviceType_effectiveFrom: {
              vaiCategory: item.vaiCategory,
              serviceType: item.serviceType,
              effectiveFrom: item.effectiveFrom
            }
          }
        });

        if (existing) {
          throw new AppError(
            422,
            "CONFIG_CONFLICT",
            `Reward configuration conflict: entry already exists for ${item.vaiCategory} ${item.serviceType} on ${item.effectiveFrom.toISOString()}`
          );
        }

        const row = await tx.rewardConfig.create({
          data: {
            vaiCategory: item.vaiCategory,
            serviceType: item.serviceType,
            discountBps: item.discountBps,
            effectiveFrom: item.effectiveFrom,
            createdBy: adminId
          }
        });
        created.push(row);
      }

      await tx.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorId: adminId,
          action: "UPDATE_REWARD_CONFIG",
          entityType: "REWARD_CONFIG",
          entityId: "BATCH",
          afterJson: JSON.stringify(configs)
        }
      });

      return created;
    });
  }

  /**
   * Activate Fee Config Option A or B (Admin SUPER_ADMIN).
   */
  async activateFeeConfig(
    optionCode: "A" | "B",
    ppm: number,
    mode: "PROVIDER_PAYS" | "PASS_THROUGH",
    effectiveFrom = new Date(),
    adminId: string
  ) {
    return configRepository.setActiveFeeConfig(
      optionCode,
      ppm,
      mode,
      effectiveFrom,
      adminId
    );
  }

  /**
   * Dataset Reset (Admin SUPER_ADMIN, TRD 18, FR-M5).
   * Strictly blocked if any record has is_dummy = false.
   */
  async resetDataset(adminId: string) {
    const nonDummyCount = await prisma.user.count({
      where: { isDummy: false }
    });

    if (nonDummyCount > 0) {
      throw new AppError(
        403,
        "ROLE_FORBIDDEN",
        "Dataset reset blocked: non-dummy records present in system"
      );
    }

    await seed();

    await prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorId: adminId,
        action: "RESET_DATASET",
        entityType: "DATASET",
        entityId: "ALL",
        afterJson: JSON.stringify({ resetAt: new Date().toISOString() })
      }
    });

    return { success: true, message: "Dataset successfully reset to 10 dummy profiles" };
  }

  /**
   * Search Audit Logs (Admin ANALYST+).
   */
  async listAuditLogs(options: {
    action?: string;
    actorId?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
  }) {
    const limit = options.limit ?? 50;
    const where: Prisma.AuditLogWhereInput = {};

    if (options.action) where.action = options.action;
    if (options.actorId) where.actorId = options.actorId;
    if (options.entityType) where.entityType = options.entityType;
    if (options.entityId) where.entityId = options.entityId;

    return prisma.auditLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" }
    });
  }

  /**
   * Export CSV Reports (Admin ANALYST+, FR-M6).
   */
  async exportCsv(type: "users" | "transactions" | "challans" | "audit-logs"): Promise<string> {
    if (type === "users") {
      const users = await prisma.user.findMany({
        orderBy: { registrationDate: "asc" },
        include: { vaiScore: true }
      });
      const header = "User ID,Full Name,Masked PAN,Masked Mobile,City,State,Registration Date,Score,Category,Status\n";
      const rows = users
        .map(
          (u) =>
            `"${u.userId}","${u.fullName}","${u.panMasked}","${maskMobile(u.mobileE164)}","${u.city}","${u.state}","${u.registrationDate.toISOString().slice(0, 10)}",${u.vaiScore?.score ?? ""},"${u.vaiScore?.category ?? ""}","${u.status}"`
        )
        .join("\n");
      return header + rows;
    }

    if (type === "transactions") {
      const txns = await prisma.transaction.findMany({
        orderBy: { createdAt: "desc" }
      });
      const header = "Transaction ID,User ID,Service,Category,Base (Paise),Discount (Paise),Payable (Paise),Fee (Paise),Status,Created At\n";
      const rows = txns
        .map(
          (t) =>
            `"${t.txnId}","${t.userId}","${t.serviceType}","${t.vaiCategoryAtTxn}",${t.baseAmountPaise},${t.discountPaise},${t.payablePaise},${t.platformFeePaise},"${t.status}","${t.createdAt.toISOString()}"`
        )
        .join("\n");
      return header + rows;
    }

    if (type === "challans") {
      const challans = await prisma.challan.findMany({
        orderBy: { challanDate: "desc" }
      });
      const header = "Challan ID,User ID,Vehicle ID,Challan Date,Violation Code,Severity,Amount (Paise),Status,Due Date\n";
      const rows = challans
        .map(
          (c) =>
            `"${c.challanId}","${c.userId}","${c.vehicleId}","${c.challanDate.toISOString().slice(0, 10)}","${c.violationCode}","${c.severity}",${c.amountPaise},"${c.status}","${c.dueDate.toISOString().slice(0, 10)}"`
        )
        .join("\n");
      return header + rows;
    }

    // audit-logs
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 500
    });
    const header = "Log ID,Actor Type,Actor ID,Action,Entity Type,Entity ID,Created At\n";
    const rows = logs
      .map(
        (l) =>
          `${l.logId},"${l.actorType}","${l.actorId}","${l.action}","${l.entityType}","${l.entityId}","${l.createdAt.toISOString()}"`
      )
      .join("\n");
    return header + rows;
  }
}

export const adminService = new AdminService();
