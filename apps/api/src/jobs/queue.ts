import { prisma } from "../db/client.js";
import type { ScoreJob } from "@prisma/client";

export class JobQueue {
  /**
   * Enqueues a score calculation job.
   * Deduplicates: if a PENDING job for the same userId and configVersion exists, reuse it.
   */
  async enqueueScoreJob(
    userId: string,
    configVersion = 1,
    scheduledFor = new Date()
  ): Promise<ScoreJob> {
    const existing = await prisma.scoreJob.findFirst({
      where: {
        userId,
        configVersion,
        status: "PENDING"
      }
    });

    if (existing) {
      return existing;
    }

    return prisma.scoreJob.create({
      data: {
        userId,
        configVersion,
        status: "PENDING",
        scheduledFor
      }
    });
  }

  /**
   * Retrieves pending jobs ready for processing.
   */
  async getPendingJobs(now = new Date(), limit = 50): Promise<ScoreJob[]> {
    return prisma.scoreJob.findMany({
      where: {
        status: "PENDING",
        scheduledFor: { lte: now }
      },
      take: limit,
      orderBy: { scheduledFor: "asc" }
    });
  }

  /**
   * Updates job status to PROCESSING.
   */
  async markProcessing(jobId: string): Promise<ScoreJob> {
    return prisma.scoreJob.update({
      where: { jobId },
      data: { status: "PROCESSING" }
    });
  }

  /**
   * Updates job status to COMPLETED.
   */
  async markCompleted(jobId: string): Promise<ScoreJob> {
    return prisma.scoreJob.update({
      where: { jobId },
      data: {
        status: "COMPLETED",
        processedAt: new Date()
      }
    });
  }

  /**
   * Enqueues score recalculation triggered by events (e.g. renewal, payment, dispute resolution).
   */
  async enqueueScoreRecalc(userId: string, _triggerReason?: string, _refId?: string): Promise<ScoreJob> {
    return this.enqueueScoreJob(userId);
  }

  /**
   * Updates job status to FAILED.
   */
  async markFailed(jobId: string, error: string): Promise<ScoreJob> {
    return prisma.scoreJob.update({
      where: { jobId },
      data: {
        status: "FAILED",
        processedAt: new Date(),
        error: error.slice(0, 1000)
      }
    });
  }
}

export const jobQueue = new JobQueue();
