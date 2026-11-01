import { jobQueue } from "./queue.js";
import { scoringService } from "../modules/scoring/service.js";
import { logger } from "../lib/logger.js";

export class ScoringWorker {
  /**
   * Processes all pending score calculation jobs currently due.
   */
  async processPendingJobs(now = new Date(), batchSize = 50): Promise<{ processed: number; failed: number }> {
    const jobs = await jobQueue.getPendingJobs(now, batchSize);
    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        await jobQueue.markProcessing(job.jobId);

        await scoringService.recalculateUserScore(job.userId, {
          configVersion: job.configVersion
        });

        await jobQueue.markCompleted(job.jobId);
        processed++;
      } catch (err: unknown) {
        failed++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error({ err, jobId: job.jobId, userId: job.userId }, "Failed to process score job");
        await jobQueue.markFailed(job.jobId, errorMessage);
      }
    }

    return { processed, failed };
  }
}

export const scoringWorker = new ScoringWorker();
