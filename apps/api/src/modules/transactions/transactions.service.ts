import crypto from "node:crypto";
import { prisma } from "../../db/client.js";
import { transactionRepository } from "../../repositories/transaction.repository.js";
import { paymentAdapter } from "../../adapters/payment/simulated.adapter.js";
import { quoteStore } from "../rewards/quote.store.js";
import { receiptService, type DeterministicReceiptData } from "../receipts/receipt.service.js";
import { jobQueue } from "../../jobs/queue.js";
import {
  AppError,
  paiseToSafeNumber
} from "@vai/shared";
import { RENEWAL_EXTENSIONS } from "../../config/services.js";
import type { Transaction } from "@prisma/client";

export interface ConfirmTransactionInput {
  quoteId: string;
  simulatedOutcome?: "SUCCESS" | "FAILURE" | "TIMEOUT";
}

export interface ConfirmTransactionResult {
  txnId: string;
  status: string;
  payablePaise: number;
  receiptUrl?: string;
}

export class TransactionsService {
  /**
   * Generates human-readable transaction ID (TRD 1.1: TXN-YYYYMMDD-nnnnnn)
   */
  private generateTxnId(): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const rand = crypto.randomInt(100000, 999999);
    return `TXN-${yyyy}${mm}${dd}-${rand}`;
  }

  /**
   * Confirms quote and processes payment (TRD 7.5, 11.1, 11.4).
   * Enforces 15-minute quote validity and mandatory idempotency key.
   */
  async confirmTransaction(
    userId: string,
    idempotencyKey: string | undefined,
    input: ConfirmTransactionInput
  ): Promise<ConfirmTransactionResult> {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new AppError(400, "VALIDATION_FAILED", "Idempotency-Key header is required");
    }

    // 1. Idempotency Check (P11, TRD 11.4)
    const existing = await transactionRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (existing.userId !== userId) {
        throw new AppError(404, "NOT_FOUND", "Transaction not found");
      }
      return {
        txnId: existing.txnId,
        status: existing.status,
        payablePaise: paiseToSafeNumber(existing.payablePaise),
        receiptUrl: existing.receiptUrl ?? undefined
      };
    }

    // 2. Validate Quote & Freshness (TRD 10.4, 17.2)
    const quoteLookup = quoteStore.getQuote(input.quoteId);
    if (!quoteLookup.quote || quoteLookup.quote.userId !== userId) {
      throw new AppError(404, "NOT_FOUND", "Quote not found or not owned by user");
    }

    if (quoteLookup.isExpired) {
      throw new AppError(
        409,
        "QUOTE_STALE",
        "Quote expired or superseded; a new quote is required"
      );
    }

    const quote = quoteLookup.quote;
    const txnId = this.generateTxnId();

    // 3. Create initial transaction record with CREATED status
    const txn = await transactionRepository.create({
      txnId,
      user: { connect: { userId: quote.userId } },
      ...(quote.vehicleId ? { vehicle: { connect: { vehicleId: quote.vehicleId } } } : {}),
      ...(quote.licenceId ? { licence: { connect: { licenceId: quote.licenceId } } } : {}),
      provider: { connect: { providerId: quote.providerId } },
      serviceType: quote.serviceType,
      vaiCategoryAtTxn: quote.vaiCategory,
      baseAmountPaise: quote.baseAmountPaise,
      discountBps: quote.discountBps,
      discountPaise: quote.discountPaise,
      govtFundedPaise: quote.govtFundedPaise,
      payablePaise: quote.payablePaise,
      platformFeePpm: quote.platformFeePpm,
      platformFeePaise: quote.platformFeePaise,
      feeMode: quote.feeMode,
      userTotalPaise: quote.userTotalPaise,
      settlementToProviderPaise: quote.settlementToProviderPaise,
      status: "CREATED",
      idempotencyKey,
      quoteId: quote.quoteId,
      quoteExpiresAt: quote.quoteExpiresAt
    });

    // 4. Transition: CREATED -> VALIDATED
    await transactionRepository.updateStatus(txn.txnId, "VALIDATED");

    // 5. Transition: VALIDATED -> PAYMENT_PENDING
    await transactionRepository.updateStatus(txn.txnId, "PAYMENT_PENDING");

    // 6. Execute Payment through Simulated Adapter (TRD 13.1, P11)
    const outcome = input.simulatedOutcome ?? "SUCCESS";
    const paymentResult = await paymentAdapter.capture(quote.quoteId, outcome);

    let finalStatus: string;
    let receiptUrl: string | undefined;

    if (paymentResult.status === "SUCCESS") {
      finalStatus = "SUCCESS";
      receiptUrl = `/api/v1/transactions/${txnId}/receipt`;

      // Apply Renewal Effects (P8)
      await this.applyRenewalEffects(quote.serviceType, quote.vehicleId, quote.licenceId);

      // Enqueue score recalculation job (P8, TRD 9.6)
      await jobQueue.enqueueScoreRecalc(userId, "RENEWAL_COMPLETED", txnId);

      // Invalidate used quote
      quoteStore.invalidateQuote(quote.quoteId);
    } else if (paymentResult.status === "TIMED_OUT") {
      finalStatus = "TIMED_OUT";
    } else {
      finalStatus = "FAILED";
      quoteStore.invalidateQuote(quote.quoteId);
    }

    // 7. Transition to final outcome
    const updatedTxn = await transactionRepository.updateStatus(
      txnId,
      finalStatus,
      paymentResult.reference,
      receiptUrl
    );

    return {
      txnId: updatedTxn.txnId,
      status: updatedTxn.status,
      payablePaise: paiseToSafeNumber(updatedTxn.payablePaise),
      receiptUrl: updatedTxn.receiptUrl ?? undefined
    };
  }

  /**
   * Applies renewal extensions per Spec Patch P8:
   * Extending from later of today and current expiry.
   */
  private async applyRenewalEffects(
    serviceType: string,
    vehicleId: string | null,
    licenceId: string | null
  ): Promise<void> {
    const today = new Date();

    if (vehicleId && (serviceType === "INSURANCE" || serviceType === "PUC" || serviceType === "RC")) {
      const vehicle = await prisma.vehicle.findUnique({ where: { vehicleId } });
      if (!vehicle) return;

      if (serviceType === "INSURANCE") {
        const current = vehicle.insuranceExpiry;
        const base = (current && current > today) ? new Date(current) : new Date(today);
        const nextDate = new Date(base);
        nextDate.setUTCMonth(nextDate.getUTCMonth() + RENEWAL_EXTENSIONS.INSURANCE_MONTHS);

        await prisma.vehicle.update({
          where: { vehicleId },
          data: { insuranceExpiry: nextDate }
        });
      } else if (serviceType === "PUC") {
        const current = vehicle.pucExpiry;
        const base = (current && current > today) ? new Date(current) : new Date(today);
        const nextDate = new Date(base);
        nextDate.setUTCMonth(nextDate.getUTCMonth() + RENEWAL_EXTENSIONS.PUC_MONTHS);

        await prisma.vehicle.update({
          where: { vehicleId },
          data: { pucExpiry: nextDate }
        });
      } else if (serviceType === "RC") {
        const current = vehicle.rcValidityTill;
        const base = (current && current > today) ? new Date(current) : new Date(today);
        const nextDate = new Date(base);
        nextDate.setUTCFullYear(nextDate.getUTCFullYear() + RENEWAL_EXTENSIONS.RC_YEARS);

        await prisma.vehicle.update({
          where: { vehicleId },
          data: { rcValidityTill: nextDate }
        });
      }
    } else if (licenceId && serviceType === "LICENCE") {
      const licence = await prisma.licence.findUnique({ where: { licenceId } });
      if (!licence) return;

      const current = licence.expiryDate;
      const base = (current && current > today) ? new Date(current) : new Date(today);
      const nextDate = new Date(base);
      nextDate.setUTCFullYear(nextDate.getUTCFullYear() + RENEWAL_EXTENSIONS.LICENCE_YEARS);

      await prisma.licence.update({
        where: { licenceId },
        data: { expiryDate: nextDate }
      });
    }
  }

  /**
   * Retrieves transaction by ID with full relations (IDOR protected).
   */
  async getTransaction(txnId: string, userId?: string) {
    const txn = await prisma.transaction.findUnique({
      where: { txnId },
      include: {
        user: true,
        vehicle: true,
        licence: true,
        provider: true,
        refunds: true
      }
    });

    if (!txn || (userId && txn.userId !== userId)) {
      throw new AppError(404, "NOT_FOUND", "Transaction not found");
    }

    return txn;
  }

  /**
   * Lists transactions for a citizen.
   */
  async listUserTransactions(userId: string, limit = 20): Promise<Transaction[]> {
    return transactionRepository.listByUser(userId, limit);
  }

  /**
   * Retrieves deterministic receipt data (JSON).
   */
  async getReceiptData(txnId: string, userId?: string): Promise<DeterministicReceiptData> {
    const txn = await this.getTransaction(txnId, userId);
    return receiptService.buildReceiptJson(txn);
  }

  /**
   * Generates deterministic receipt PDF buffer.
   */
  async getReceiptPdf(txnId: string, userId?: string): Promise<Buffer> {
    const receiptData = await this.getReceiptData(txnId, userId);
    return receiptService.buildReceiptPdf(receiptData);
  }

  /**
   * Processes a full or partial refund (P7, TRD 11.3, G7).
   * Restricted to SUPER_ADMIN.
   */
  async processRefund(
    txnId: string,
    amountPaise: bigint,
    reasonCode: string,
    adminId: string
  ) {
    const result = await transactionRepository.recordRefund(
      txnId,
      amountPaise,
      reasonCode,
      adminId
    );

    // Audit log written
    await prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorId: adminId,
        action: "REFUND_TRANSACTION",
        entityType: "TRANSACTION",
        entityId: txnId,
        afterJson: JSON.stringify({
          refundId: result.refund.refundId,
          amountPaise: result.refund.amountPaise.toString(),
          feeReversedPaise: result.refund.feeReversedPaise.toString(),
          reasonCode
        })
      }
    });

    return result;
  }

  /**
   * Reconciles a TIMED_OUT transaction (P7).
   * Restricted to OPS and above.
   */
  async reconcileTransaction(
    txnId: string,
    outcome: "SUCCESS" | "FAILED",
    adminId: string,
    note?: string
  ) {
    const txn = await prisma.transaction.findUnique({
      where: { txnId },
      include: { vehicle: true, licence: true }
    });

    if (!txn) {
      throw new AppError(404, "NOT_FOUND", "Transaction not found");
    }

    if (txn.status !== "TIMED_OUT") {
      throw new AppError(
        409,
        "TXN_STATE_INVALID",
        `Only TIMED_OUT transactions can be reconciled (current status: ${txn.status})`
      );
    }

    let receiptUrl: string | undefined;

    if (outcome === "SUCCESS") {
      receiptUrl = `/api/v1/transactions/${txnId}/receipt`;
      await this.applyRenewalEffects(txn.serviceType, txn.vehicleId, txn.licenceId);
      await jobQueue.enqueueScoreRecalc(txn.userId, "RECONCILIATION_COMPLETED", txnId);
    }

    const updated = await transactionRepository.updateStatus(
      txnId,
      outcome,
      undefined,
      receiptUrl
    );

    await prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        actorId: adminId,
        action: "RECONCILE_TRANSACTION",
        entityType: "TRANSACTION",
        entityId: txnId,
        beforeJson: JSON.stringify({ status: "TIMED_OUT" }),
        afterJson: JSON.stringify({ status: outcome, note })
      }
    });

    return updated;
  }
}

export const transactionsService = new TransactionsService();
