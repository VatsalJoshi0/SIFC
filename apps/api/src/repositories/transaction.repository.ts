import { prisma } from "../db/client.js";
import type { Transaction, Refund, Prisma } from "@prisma/client";
import { calculateFeeReversalPaise } from "@vai/shared";

export class TransactionRepository {
  async findById(txnId: string): Promise<Transaction | null> {
    return prisma.transaction.findUnique({
      where: { txnId },
      include: { refunds: true }
    });
  }

  async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    return prisma.transaction.findUnique({
      where: { idempotencyKey: key }
    });
  }

  async listByUser(userId: string, limit = 20): Promise<Transaction[]> {
    return prisma.transaction.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { refunds: true }
    });
  }

  async create(data: Prisma.TransactionCreateInput): Promise<Transaction> {
    return prisma.transaction.create({ data });
  }

  async updateStatus(
    txnId: string,
    status: string,
    paymentRef?: string,
    receiptUrl?: string
  ): Promise<Transaction> {
    return prisma.transaction.update({
      where: { txnId },
      data: {
        status,
        paymentRef: paymentRef ?? undefined,
        receiptUrl: receiptUrl ?? undefined
      }
    });
  }

  /**
   * Processes a refund per spec patch P7:
   * Partial refund -> refund row only; txn stays SUCCESS; total refunded <= base; fee reversal = round_half_up(fee * refunded_base / base).
   * Full refund -> txn status becomes REFUNDED.
   */
  async recordRefund(
    txnId: string,
    amountPaise: bigint,
    reasonCode: string,
    adminId: string
  ): Promise<{ refund: Refund; transaction: Transaction }> {
    return prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.findUnique({
        where: { txnId },
        include: { refunds: true }
      });

      if (!txn) {
        throw new Error(`Transaction ${txnId} not found`);
      }

      if (txn.status !== "SUCCESS") {
        throw new Error(`Cannot refund transaction with status ${txn.status}`);
      }

      const existingRefundTotal = txn.refunds.reduce(
        (sum, r) => sum + r.amountPaise,
        0n
      );

      if (existingRefundTotal + amountPaise > txn.baseAmountPaise) {
        throw new Error(
          `Refund amount exceeds remaining refundable base (${(txn.baseAmountPaise - existingRefundTotal).toString()} paise remaining)`
        );
      }

      // Calculate proportional fee reversal (P7, TRD 11.3)
      const feeReversedPaise = calculateFeeReversalPaise(
        txn.platformFeePaise,
        amountPaise,
        txn.baseAmountPaise
      );

      const refund = await tx.refund.create({
        data: {
          txnId,
          amountPaise,
          feeReversedPaise,
          reasonCode,
          adminId
        }
      });

      const isFullRefund = existingRefundTotal + amountPaise === txn.baseAmountPaise;
      const updatedTxn = isFullRefund
        ? await tx.transaction.update({
            where: { txnId },
            data: { status: "REFUNDED" }
          })
        : txn;

      return { refund, transaction: updatedTxn };
    });
  }
}

export const transactionRepository = new TransactionRepository();
