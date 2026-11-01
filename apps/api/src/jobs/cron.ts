import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "../db/client.js";
import { jobQueue } from "./queue.js";
import { scoringWorker } from "./worker.js";
import { logger } from "../lib/logger.js";

/**
 * Executes the nightly maintenance logic deterministically for a given asOf timestamp.
 * 1. If 1st day of month (Asia/Kolkata): write monthly score_snapshot for all users with a score.
 * 2. Enqueue recalculation jobs for all active users to refresh age decay and streaks.
 * 3. Process the enqueued jobs.
 */
export async function runNightlyMaintenance(asOf: Date = new Date()): Promise<{
  snapshotsCreated: number;
  jobsEnqueued: number;
  jobsProcessed: number;
}> {
  // Format asOf to Asia/Kolkata components
  const istFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = istFormatter.formatToParts(asOf);
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;

  const period = `${year}-${month}-01`;
  let snapshotsCreated = 0;

  // 1. If 1st day of month, capture snapshots from current scores
  if (day === "01") {
    const usersWithScores = await prisma.vaiScore.findMany({
      include: { user: true }
    });

    for (const record of usersWithScores) {
      if (record.user.status === "ACTIVE") {
        // Idempotently create snapshot for the 1st of month
        const existing = await prisma.scoreSnapshot.findUnique({
          where: {
            snapshots_user_period_uq: {
              userId: record.userId,
              period
            }
          }
        });

        if (!existing) {
          await prisma.scoreSnapshot.create({
            data: {
              userId: record.userId,
              period,
              score: record.score,
              category: record.category,
              createdAt: asOf
            }
          });
          snapshotsCreated++;
        }
      }
    }
  }

  // 2. Enqueue score recalculation for all active users
  const activeUsers = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { userId: true }
  });

  let jobsEnqueued = 0;
  for (const u of activeUsers) {
    await jobQueue.enqueueScoreJob(u.userId, 1, asOf);
    jobsEnqueued++;
  }

  // 3. Process jobs
  const workerResult = await scoringWorker.processPendingJobs(asOf, 100);

  logger.info(
    { snapshotsCreated, jobsEnqueued, workerResult, asOf: asOf.toISOString() },
    "Completed nightly maintenance run"
  );

  return {
    snapshotsCreated,
    jobsEnqueued,
    jobsProcessed: workerResult.processed
  };
}

let cronTask: ScheduledTask | null = null;

/**
 * Initializes the node-cron scheduled task at 02:00 Asia/Kolkata nightly (TRD 18.2, P1d).
 */
export function initNightlyCron(): ScheduledTask {
  if (cronTask) {
    return cronTask;
  }

  cronTask = cron.schedule(
    "0 2 * * *",
    async () => {
      logger.info("Starting scheduled 02:00 Asia/Kolkata nightly score recalculation");
      try {
        await runNightlyMaintenance();
      } catch (err) {
        logger.error({ err }, "Error during scheduled nightly maintenance");
      }
    },
    {
      timezone: "Asia/Kolkata"
    }
  );

  logger.info("Nightly scoring cron scheduled for 02:00 Asia/Kolkata");
  return cronTask;
}

export function stopNightlyCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}
