import type { Request, Response } from "express";
import {
  AdminLoginSchema,
  ResolveDisputeSchema,
  AdminScoringConfigSchema,
  AdminUpdateRewardsSchema,
  AdminFeeConfigSchema,
  AdminReconcileTransactionSchema,
  CreateRefundSchema,
  AppError
} from "@vai/shared";
import { adminService } from "./admin.service.js";
import { transactionsService } from "../transactions/transactions.service.js";
import { prisma } from "../../db/client.js";

export class AdminController {
  /**
   * POST /api/v1/admin/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    const parseResult = AdminLoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "Request body did not match the schema",
        parseResult.error.flatten().fieldErrors
      );
    }

    const result = await adminService.login(parseResult.data);
    res.status(200).json(result);
  }

  /**
   * GET /api/v1/admin/users
   */
  async listUsers(req: Request, res: Response): Promise<void> {
    const query = req.query.query as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const users = await adminService.listUsers({ query, status, limit });
    res.status(200).json({ users, count: users.length });
  }

  /**
   * GET /api/v1/admin/users/:userId
   */
  async getUserDetail(req: Request, res: Response): Promise<void> {
    const userId = req.params.userId;
    const user = await adminService.getUserDetail(userId);
    res.status(200).json(user);
  }

  /**
   * GET /api/v1/admin/challans
   */
  async listChallans(req: Request, res: Response): Promise<void> {
    const status = req.query.status as string | undefined;
    const severity = req.query.severity as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const challans = await adminService.listChallans({
      status,
      severity,
      from,
      to,
      limit
    });
    res.status(200).json({ challans, count: challans.length });
  }

  /**
   * POST /api/v1/admin/disputes/:disputeId/resolve
   */
  async resolveDispute(req: Request, res: Response): Promise<void> {
    const admin = req.admin;
    if (!admin) {
      throw new AppError(401, "TOKEN_INVALID", "Admin authentication required");
    }

    const disputeId = req.params.disputeId;
    const parseResult = ResolveDisputeSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "Request body did not match the schema",
        parseResult.error.flatten().fieldErrors
      );
    }

    const result = await adminService.resolveDispute(
      disputeId,
      parseResult.data.outcome,
      admin.adminId,
      parseResult.data.note
    );

    res.status(200).json({
      message: `Dispute resolved as ${parseResult.data.outcome}`,
      dispute: result.updatedDispute,
      challan: {
        ...result.updatedChallan,
        amountPaise: Number(result.updatedChallan.amountPaise)
      }
    });
  }

  /**
   * GET /api/v1/admin/scores/distribution
   */
  async getScoreDistribution(_req: Request, res: Response): Promise<void> {
    const distribution = await adminService.getScoreDistribution();
    res.status(200).json(distribution);
  }

  /**
   * GET /api/v1/admin/revenue
   */
  async getRevenueAnalytics(_req: Request, res: Response): Promise<void> {
    const revenue = await adminService.getRevenueAnalytics();
    res.status(200).json(revenue);
  }

  /**
   * PUT /api/v1/admin/config/scoring
   */
  async insertScoringConfig(req: Request, res: Response): Promise<void> {
    const admin = req.admin;
    if (!admin) {
      throw new AppError(401, "TOKEN_INVALID", "Admin authentication required");
    }

    const parseResult = AdminScoringConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "Request body did not match the schema",
        parseResult.error.flatten().fieldErrors
      );
    }

    const config = await adminService.insertScoringConfig(
      parseResult.data.parameters,
      new Date(parseResult.data.effectiveFrom),
      admin.adminId,
      parseResult.data.changeReason
    );

    res.status(201).json(config);
  }

  /**
   * PUT /api/v1/admin/config/rewards
   */
  async updateRewardConfigs(req: Request, res: Response): Promise<void> {
    const admin = req.admin;
    if (!admin) {
      throw new AppError(401, "TOKEN_INVALID", "Admin authentication required");
    }

    const parseResult = AdminUpdateRewardsSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "Request body did not match the schema",
        parseResult.error.flatten().fieldErrors
      );
    }

    const formattedConfigs = (parseResult.data.configs as Array<{
      vaiCategory: "FAIR" | "GOOD" | "VERY_GOOD";
      serviceType: "INSURANCE" | "PUC" | "RC" | "LICENCE";
      discountBps: number;
      effectiveFrom: string;
    }>).map((c) => ({
      vaiCategory: c.vaiCategory,
      serviceType: c.serviceType,
      discountBps: c.discountBps,
      effectiveFrom: new Date(c.effectiveFrom)
    }));

    const result = await adminService.updateRewardConfigs(
      formattedConfigs,
      admin.adminId
    );

    res.status(200).json({ updatedCount: result.length, configs: result });
  }

  /**
   * PUT /api/v1/admin/config/fees
   */
  async activateFeeConfig(req: Request, res: Response): Promise<void> {
    const admin = req.admin;
    if (!admin) {
      throw new AppError(401, "TOKEN_INVALID", "Admin authentication required");
    }

    const parseResult = AdminFeeConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "Request body did not match the schema",
        parseResult.error.flatten().fieldErrors
      );
    }

    const effectiveFrom = parseResult.data.effectiveFrom
      ? new Date(parseResult.data.effectiveFrom)
      : new Date();

    const result = await adminService.activateFeeConfig(
      parseResult.data.optionCode,
      parseResult.data.ppm,
      parseResult.data.mode,
      effectiveFrom,
      admin.adminId
    );

    res.status(200).json(result);
  }

  /**
   * GET /api/v1/admin/transactions
   */
  async listTransactions(req: Request, res: Response): Promise<void> {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const status = req.query.status as string | undefined;

    const txns = await prisma.transaction.findMany({
      where: status ? { status } : undefined,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { fullName: true, panMasked: true } },
        refunds: true
      }
    });

    res.status(200).json({
      transactions: txns.map((t) => ({
        txnId: t.txnId,
        userId: t.userId,
        citizenName: t.user.fullName,
        panMasked: t.user.panMasked,
        serviceType: t.serviceType,
        vaiCategory: t.vaiCategoryAtTxn,
        baseAmountPaise: Number(t.baseAmountPaise),
        discountPaise: Number(t.discountPaise),
        payablePaise: Number(t.payablePaise),
        platformFeePaise: Number(t.platformFeePaise),
        status: t.status,
        paymentRef: t.paymentRef,
        createdAt: t.createdAt.toISOString(),
        refunds: t.refunds.map((r) => ({
          refundId: r.refundId,
          amountPaise: Number(r.amountPaise),
          feeReversedPaise: Number(r.feeReversedPaise),
          reasonCode: r.reasonCode,
          createdAt: r.createdAt.toISOString()
        }))
      })),
      count: txns.length
    });
  }

  /**
   * POST /api/v1/admin/transactions/:txnId/refund (SUPER_ADMIN)
   */
  async refundTransaction(req: Request, res: Response): Promise<void> {
    const admin = req.admin;
    if (!admin) {
      throw new AppError(401, "TOKEN_INVALID", "Admin authentication required");
    }

    const txnId = req.params.txnId;
    const parseResult = CreateRefundSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "Request body did not match the schema",
        parseResult.error.flatten().fieldErrors
      );
    }

    const result = await transactionsService.processRefund(
      txnId,
      BigInt(parseResult.data.amountPaise),
      parseResult.data.reasonCode,
      admin.adminId
    );

    res.status(200).json({
      refundId: result.refund.refundId,
      txnId: result.transaction.txnId,
      amountPaise: Number(result.refund.amountPaise),
      feeReversedPaise: Number(result.refund.feeReversedPaise),
      transactionStatus: result.transaction.status
    });
  }

  /**
   * POST /api/v1/admin/transactions/:txnId/reconcile (OPS+)
   */
  async reconcileTransaction(req: Request, res: Response): Promise<void> {
    const admin = req.admin;
    if (!admin) {
      throw new AppError(401, "TOKEN_INVALID", "Admin authentication required");
    }

    const txnId = req.params.txnId;
    const parseResult = AdminReconcileTransactionSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "Request body did not match the schema",
        parseResult.error.flatten().fieldErrors
      );
    }

    const result = await transactionsService.reconcileTransaction(
      txnId,
      parseResult.data.outcome,
      admin.adminId,
      parseResult.data.note
    );

    res.status(200).json({
      txnId: result.txnId,
      status: result.status,
      receiptUrl: result.receiptUrl
    });
  }

  /**
   * POST /api/v1/admin/datasets/reset (SUPER_ADMIN, TRD 18, FR-M5)
   */
  async resetDataset(req: Request, res: Response): Promise<void> {
    const admin = req.admin;
    if (!admin) {
      throw new AppError(401, "TOKEN_INVALID", "Admin authentication required");
    }

    const result = await adminService.resetDataset(admin.adminId);
    res.status(200).json(result);
  }

  /**
   * GET /api/v1/admin/audit-logs
   */
  async listAuditLogs(req: Request, res: Response): Promise<void> {
    const action = req.query.action as string | undefined;
    const actorId = req.query.actorId as string | undefined;
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const logs = await adminService.listAuditLogs({
      action,
      actorId,
      entityType,
      entityId,
      limit
    });

    res.status(200).json({ logs, count: logs.length });
  }

  /**
   * GET /api/v1/admin/export/csv
   */
  async exportCsv(req: Request, res: Response): Promise<void> {
    const type = typeof req.query.type === "string" ? req.query.type : "users";
    if (!["users", "transactions", "challans", "audit-logs"].includes(type)) {
      throw new AppError(400, "VALIDATION_FAILED", "Invalid export type. Must be users, transactions, challans, or audit-logs");
    }

    const csvData = await adminService.exportCsv(type as "users" | "transactions" | "challans" | "audit-logs");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${type}-export.csv"`);
    res.status(200).send(csvData);
  }
}

export const adminController = new AdminController();
