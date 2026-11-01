import { prisma } from "../db/client.js";
import type { Challan, Prisma } from "@prisma/client";

export interface ChallanFilterOptions {
  status?: string;
  severity?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string; // challanId
}

export class ChallanRepository {
  async findById(challanId: string): Promise<Challan | null> {
    return prisma.challan.findUnique({
      where: { challanId }
    });
  }

  async findOwnedById(challanId: string, userId: string): Promise<Challan | null> {
    const challan = await this.findById(challanId);
    if (!challan || challan.userId !== userId) {
      return null;
    }
    return challan;
  }

  /**
   * Retrieves user challans with filtering and cursor pagination (TRD 7.6).
   */
  async listByUser(userId: string, options: ChallanFilterOptions = {}): Promise<{
    items: Challan[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const where: Prisma.ChallanWhereInput = { userId };

    if (options.status) {
      where.status = options.status;
    }
    if (options.severity) {
      where.severity = options.severity;
    }
    if (options.from || options.to) {
      where.challanDate = {};
      if (options.from) where.challanDate.gte = options.from;
      if (options.to) where.challanDate.lte = options.to;
    }

    const items = await prisma.challan.findMany({
      where,
      take: limit + 1,
      cursor: options.cursor ? { challanId: options.cursor } : undefined,
      skip: options.cursor ? 1 : 0,
      orderBy: [{ challanDate: "desc" }, { challanId: "desc" }]
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem ? nextItem.challanId : null;
    }

    return { items, nextCursor };
  }

  /**
   * Retrieves confirmed and scoring-eligible challans for score calculation.
   * Excludes PENDING, DISPUTED, and WAIVED.
   */
  async listConfirmedForScoring(userId: string, asOfDate?: Date): Promise<Challan[]> {
    const where: Prisma.ChallanWhereInput = {
      userId,
      scoringEligible: true,
      status: { in: ["PAID", "UNPAID"] }
    };

    if (asOfDate) {
      where.challanDate = { lte: asOfDate };
    }

    return prisma.challan.findMany({
      where,
      orderBy: { challanDate: "asc" }
    });
  }

  async create(data: Prisma.ChallanCreateInput): Promise<Challan> {
    return prisma.challan.create({ data });
  }

  async updateStatus(challanId: string, status: string, scoringEligible: boolean): Promise<Challan> {
    return prisma.challan.update({
      where: { challanId },
      data: { status, scoringEligible }
    });
  }
}

export const challanRepository = new ChallanRepository();
