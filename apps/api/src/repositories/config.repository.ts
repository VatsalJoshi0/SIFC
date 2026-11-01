import { prisma } from "../db/client.js";
import type { ScoringConfig, RewardConfig, FeeConfig } from "@prisma/client";

export class ConfigRepository {
  /**
   * Retrieves active fee configuration.
   */
  async getActiveFeeConfig(): Promise<FeeConfig | null> {
    return prisma.feeConfig.findFirst({
      where: { isActive: true },
      orderBy: { effectiveFrom: "desc" }
    });
  }

  /**
   * Retrieves latest scoring config version.
   */
  async getLatestScoringConfig(): Promise<ScoringConfig | null> {
    return prisma.scoringConfig.findFirst({
      orderBy: { version: "desc" }
    });
  }

  /**
   * Retrieves scoring config by version number.
   */
  async getScoringConfig(version: number): Promise<ScoringConfig | null> {
    return prisma.scoringConfig.findUnique({
      where: { version }
    });
  }

  /**
   * Inserts a new versioned scoring config and logs to audit in the same transaction (TRD 5.3).
   */
  async insertScoringConfig(
    version: number,
    parametersJson: string,
    effectiveFrom: Date,
    createdBy: string,
    changeReason: string
  ): Promise<ScoringConfig> {
    return prisma.$transaction(async (tx) => {
      const config = await tx.scoringConfig.create({
        data: {
          version,
          parameters: parametersJson,
          effectiveFrom,
          createdBy,
          changeReason
        }
      });

      await tx.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorId: createdBy,
          action: "INSERT_SCORING_CONFIG",
          entityType: "SCORING_CONFIG",
          entityId: version.toString(),
          beforeJson: null,
          afterJson: parametersJson
        }
      });

      return config;
    });
  }

  /**
   * Sets the active fee configuration.
   * Enforces that exactly one row has isActive = true via transaction and the partial unique index.
   */
  async setActiveFeeConfig(
    optionCode: string,
    ppm: number,
    mode: string,
    effectiveFrom: Date,
    adminId: string
  ): Promise<FeeConfig> {
    return prisma.$transaction(async (tx) => {
      // 1. Deactivate currently active fee configs
      await tx.feeConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      // 2. Create the newly active fee config
      const active = await tx.feeConfig.create({
        data: {
          optionCode,
          ppm,
          mode,
          effectiveFrom,
          isActive: true,
          createdBy: adminId
        }
      });

      // 3. Record audit log
      await tx.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorId: adminId,
          action: "SET_ACTIVE_FEE_CONFIG",
          entityType: "FEE_CONFIG",
          entityId: active.id.toString(),
          afterJson: JSON.stringify(active)
        }
      });

      return active;
    });
  }

  /**
   * Retrieves reward discount bps for given category and service.
   */
  async getRewardDiscount(
    vaiCategory: string,
    serviceType: string,
    asOfDate: Date = new Date()
  ): Promise<RewardConfig | null> {
    return prisma.rewardConfig.findFirst({
      where: {
        vaiCategory,
        serviceType,
        effectiveFrom: { lte: asOfDate }
      },
      orderBy: { effectiveFrom: "desc" }
    });
  }
}

export const configRepository = new ConfigRepository();
