import type { Request, Response } from "express";
import { ConfirmTransactionRequestSchema, AppError } from "@vai/shared";
import { transactionsService } from "./transactions.service.js";

export class TransactionsController {
  /**
   * POST /api/v1/transactions
   * Confirms quote and executes payment.
   */
  async confirmTransaction(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      throw new AppError(401, "TOKEN_INVALID", "Authentication required");
    }

    const idempotencyKey = req.header("Idempotency-Key");
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new AppError(400, "VALIDATION_FAILED", "Idempotency-Key header is required");
    }

    const parseResult = ConfirmTransactionRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "Request body did not match the schema",
        parseResult.error.flatten().fieldErrors
      );
    }

    const result = await transactionsService.confirmTransaction(
      user.userId,
      idempotencyKey,
      parseResult.data
    );

    res.status(201).json(result);
  }

  /**
   * GET /api/v1/transactions
   * Lists citizen transactions.
   */
  async listUserTransactions(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      throw new AppError(401, "TOKEN_INVALID", "Authentication required");
    }

    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const transactions = await transactionsService.listUserTransactions(user.userId, limit);

    res.status(200).json({
      transactions: transactions.map((t) => ({
        txnId: t.txnId,
        serviceType: t.serviceType,
        vaiCategory: t.vaiCategoryAtTxn,
        baseAmountPaise: Number(t.baseAmountPaise),
        discountPaise: Number(t.discountPaise),
        payablePaise: Number(t.payablePaise),
        platformFeePaise: Number(t.platformFeePaise),
        status: t.status,
        receiptUrl: t.receiptUrl,
        createdAt: t.createdAt.toISOString()
      }))
    });
  }

  /**
   * GET /api/v1/transactions/:txnId
   * Retrieves single transaction details (IDOR protected).
   */
  async getTransaction(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      throw new AppError(401, "TOKEN_INVALID", "Authentication required");
    }

    const txnId = req.params.txnId;
    const txn = await transactionsService.getTransaction(txnId, user.userId);

    res.status(200).json({
      txnId: txn.txnId,
      serviceType: txn.serviceType,
      vaiCategory: txn.vaiCategoryAtTxn,
      baseAmountPaise: Number(txn.baseAmountPaise),
      discountBps: txn.discountBps,
      discountPaise: Number(txn.discountPaise),
      govtFundedPaise: Number(txn.govtFundedPaise),
      payablePaise: Number(txn.payablePaise),
      platformFeePpm: txn.platformFeePpm,
      platformFeePaise: Number(txn.platformFeePaise),
      feeMode: txn.feeMode,
      userTotalPaise: Number(txn.userTotalPaise),
      settlementToProviderPaise: Number(txn.settlementToProviderPaise),
      status: txn.status,
      paymentRef: txn.paymentRef,
      receiptUrl: txn.receiptUrl,
      createdAt: txn.createdAt.toISOString(),
      updatedAt: txn.updatedAt.toISOString(),
      vehicle: txn.vehicle
        ? {
            vehicleId: txn.vehicle.vehicleId,
            registrationNo: txn.vehicle.registrationNo,
            vehicleType: txn.vehicle.vehicleType
          }
        : null,
      licence: txn.licence
        ? {
            licenceId: txn.licence.licenceId,
            licenceNoMasked: txn.licence.licenceNoMasked
          }
        : null
    });
  }

  /**
   * GET /api/v1/transactions/:txnId/receipt
   * Retrieves deterministic receipt as JSON or PDF.
   */
  async getReceipt(req: Request, res: Response): Promise<void> {
    const user = req.user;
    if (!user) {
      throw new AppError(401, "TOKEN_INVALID", "Authentication required");
    }

    const txnId = req.params.txnId;
    const format = req.query.format;
    const acceptHeader = req.header("accept");

    if (format === "pdf" || (acceptHeader && acceptHeader.includes("application/pdf"))) {
      const pdfBuffer = await transactionsService.getReceiptPdf(txnId, user.userId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="receipt-${txnId}.pdf"`);
      res.status(200).send(pdfBuffer);
      return;
    }

    const receiptData = await transactionsService.getReceiptData(txnId, user.userId);
    res.status(200).json(receiptData);
  }
}

export const transactionsController = new TransactionsController();
