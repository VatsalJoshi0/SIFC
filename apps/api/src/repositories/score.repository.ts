import { prisma } from "../db/client.js";
import type { VaiScore, ScoreLedger, ScoreSnapshot } from "@prisma/client";

export interface LedgerEntryInput {
  eventType: string;
  component: string;
  reasonCode: string;
  refId?: string | null;
  deltaPoints: number;
  balanceBefore: number;
  balanceAfter: number;
  configVersion: number;
  createdAt?: Date;
}

export class ScoreRepository {
  async getScore(userId: string): Promise<VaiScore | null> {
    return prisma.vaiScore.findUnique({
      where: { userId }
    });
  }

  async getLatestMonthlySnapshot(userId: string): Promise<ScoreSnapshot | null> {
    return prisma.scoreSnapshot.findFirst({
      where: { userId },
      orderBy: { period: "desc" }
    });
  }

  async getMonthlySnapshot(userId: string, period: string): Promise<ScoreSnapshot | null> {
    return prisma.scoreSnapshot.findUnique({
      where: {
        snapshots_user_period_uq: { userId, period }
      }
    });
  }

  async listSnapshots(userId: string, months = 12): Promise<ScoreSnapshot[]> {
    return prisma.scoreSnapshot.findMany({
      where: { userId },
      take: months,
      orderBy: { period: "desc" }
    });
  }

  async listLedger(userId: string, limit = 50, cursor?: number): Promise<{
    items: ScoreLedger[];
    nextCursor: number | null;
  }> {
    const items = await prisma.scoreLedger.findMany({
      where: { userId },
      take: limit + 1,
      cursor: cursor ? { entryId: cursor } : undefined,
      skip: cursor ? 1 : 0,
      orderBy: { entryId: "desc" }
    });

    let nextCursor: number | null = null;
    if (items.length > limit) {
      const next = items.pop();
      nextCursor = next ? next.entryId : null;
    }

    return { items, nextCursor };
  }

  /**
   * Persists score update and ledger entries in a single atomic database transaction (TRD 9.7).
   */
  async persistScoreAndLedger(
    userId: string,
    score: number,
    scoreBeforeCap: number,
    category: string,
    configVersion: number,
    ledgerEntries: LedgerEntryInput[],
    computedAt = new Date()
  ): Promise<{ score: VaiScore; ledger: ScoreLedger[] }> {
    return prisma.$transaction(async (tx) => {
      // 1. Upsert VAI score
      const updatedScore = await tx.vaiScore.upsert({
        where: { userId },
        create: {
          userId,
          score,
          category,
          scoreBeforeCap,
          scoringConfigVersion: configVersion,
          computedAt
        },
        update: {
          score,
          category,
          scoreBeforeCap,
          scoringConfigVersion: configVersion,
          computedAt
        }
      });

      // 2. Append ledger entries
      const createdLedger: ScoreLedger[] = [];
      for (const entry of ledgerEntries) {
        const row = await tx.scoreLedger.create({
          data: {
            userId,
            eventType: entry.eventType,
            component: entry.component,
            reasonCode: entry.reasonCode,
            refId: entry.refId,
            deltaPoints: entry.deltaPoints,
            balanceBefore: entry.balanceBefore,
            balanceAfter: entry.balanceAfter,
            configVersion: entry.configVersion,
            createdAt: entry.createdAt ?? computedAt
          }
        });
        createdLedger.push(row);
      }

      return { score: updatedScore, ledger: createdLedger };
    });
  }
}

export const scoreRepository = new ScoreRepository();
