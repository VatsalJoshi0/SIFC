import type { Request, Response } from "express";
import { prisma } from "../../db/client.js";
import { scoringService } from "./service.js";
import { getReasonMetadata } from "./reasons.js";

export class ScoringController {
  async getScore(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;

    // 1. Get or compute latest score
    let score = await prisma.vaiScore.findUnique({
      where: { userId }
    });

    if (!score) {
      const calc = await scoringService.recalculateUserScore(userId);
      score = await prisma.vaiScore.findUnique({ where: { userId } });
      if (!score) {
        score = {
          userId,
          score: calc.score,
          category: calc.category,
          scoreBeforeCap: calc.scoreBeforeCap,
          scoringConfigVersion: 1,
          computedAt: new Date(),
          updatedAt: new Date()
        };
      }
    }

    // 2. Previous month score from snapshot (P6)
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const currentPeriod = `${year}-${month}-01`;

    const snapshot = await prisma.scoreSnapshot.findFirst({
      where: {
        userId,
        period: { lte: currentPeriod }
      },
      orderBy: { period: "desc" }
    });

    const previousMonthScore = snapshot ? snapshot.score : null;
    const changeSincePreviousMonth = previousMonthScore !== null ? score.score - previousMonthScore : score.score - 700;

    // 3. Next milestone
    let nextMilestone: { score: number; category: "GOOD" | "VERY_GOOD"; pointsNeeded: number } | null = null;
    if (score.score < 650) {
      nextMilestone = {
        score: 650,
        category: "GOOD",
        pointsNeeded: 650 - score.score
      };
    } else if (score.score < 750) {
      nextMilestone = {
        score: 750,
        category: "VERY_GOOD",
        pointsNeeded: 750 - score.score
      };
    }

    // 4. Derive top reasons from latest ledger entries
    const recentLedger = await prisma.scoreLedger.findMany({
      where: { userId },
      orderBy: { entryId: "desc" },
      take: 20
    });

    const topReasons = recentLedger
      .filter((e) => Math.abs(e.deltaPoints) > 0)
      .slice(0, 3)
      .map((e) => {
        const meta = getReasonMetadata(e.reasonCode);
        return {
          reasonCode: e.reasonCode,
          label: meta.label,
          delta: e.deltaPoints
        };
      });

    res.status(200).json({
      score: score.score,
      category: score.category,
      previousMonthScore,
      changeSincePreviousMonth,
      computedAt: score.computedAt,
      nextMilestone,
      topReasons,
      configVersion: score.scoringConfigVersion
    });
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { months = "12" } = req.query;
    const takeMonths = Math.min(Math.max(Number(months) || 12, 1), 24);

    const snapshots = await prisma.scoreSnapshot.findMany({
      where: { userId },
      orderBy: { period: "asc" },
      take: takeMonths
    });

    const mapped = snapshots.map((s) => ({
      snapshotId: s.snapshotId,
      period: s.period,
      score: s.score,
      category: s.category,
      createdAt: s.createdAt
    }));

    res.status(200).json({
      snapshots: mapped,
      history: mapped
    });
  }

  async getLedger(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { limit = "20", cursor } = req.query;
    const takeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const cursorId = cursor ? Number(cursor) : undefined;

    const entries = await prisma.scoreLedger.findMany({
      where: { userId },
      take: takeLimit + 1,
      cursor: cursorId ? { entryId: cursorId } : undefined,
      skip: cursorId ? 1 : 0,
      orderBy: { entryId: "desc" }
    });

    let nextCursor: number | null = null;
    if (entries.length > takeLimit) {
      const nextItem = entries.pop();
      nextCursor = nextItem ? nextItem.entryId : null;
    }

    const items = entries.map((e) => {
      const meta = getReasonMetadata(e.reasonCode);
      return {
        entryId: e.entryId,
        eventType: e.eventType,
        component: e.component,
        reasonCode: e.reasonCode,
        refId: e.refId,
        deltaPoints: e.deltaPoints,
        balanceBefore: e.balanceBefore,
        balanceAfter: e.balanceAfter,
        configVersion: e.configVersion,
        createdAt: e.createdAt,
        label: meta.label,
        plainDescription: meta.plainDescription
      };
    });

    res.status(200).json({
      items,
      nextCursor
    });
  }
}

export const scoringController = new ScoringController();
