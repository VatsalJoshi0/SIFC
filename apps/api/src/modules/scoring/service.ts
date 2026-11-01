import { prisma } from "../../db/client.js";
import {
  computeVaiScore,
  type ScoreCalculationResult,
  type ScoringChallanInput,
  type ScoringVehicleInput,
  type ScoringLicenceInput,
  type ScoringUserInput
} from "./engine.js";
import { DEFAULT_SCORING_CONFIG_V1, ScoringParametersSchema, type ScoringParameters } from "./config.js";
import { scoreRepository } from "../../repositories/score.repository.js";

export interface RecalculateOptions {
  asOfDate?: Date;
  configVersion?: number;
  disableCap?: boolean;
  writeLedger?: boolean;
}

export class ScoringService {
  /**
   * Recalculates the score for a user and commits score + ledger atomically.
   */
  async recalculateUserScore(
    userId: string,
    options: RecalculateOptions = {}
  ): Promise<ScoreCalculationResult> {
    const asOf = options.asOfDate ?? new Date();

    // 1. Fetch user
    const user = await prisma.user.findUnique({
      where: { userId }
    });
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // 2. Fetch vehicles
    const vehicles = await prisma.vehicle.findMany({
      where: { userId }
    });

    // 3. Fetch driving licences
    const licence = await prisma.licence.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    // 4. Fetch challans
    const challans = await prisma.challan.findMany({
      where: { userId }
    });

    // 5. Fetch scoring config
    let configVersion = options.configVersion ?? 1;
    let configParameters: ScoringParameters = DEFAULT_SCORING_CONFIG_V1;

    const scoringConfigRow = await prisma.scoringConfig.findFirst({
      where: options.configVersion ? { version: options.configVersion } : undefined,
      orderBy: { version: "desc" }
    });

    if (scoringConfigRow) {
      configVersion = scoringConfigRow.version;
      try {
        const parsed = JSON.parse(scoringConfigRow.parameters);
        configParameters = ScoringParametersSchema.parse(parsed);
      } catch {
        configParameters = DEFAULT_SCORING_CONFIG_V1;
      }
    }

    // 6. Monthly cap anchor (P6)
    // Anchor = score snapshot at start of current calendar month (700 if none)
    let monthlyAnchorScore: number | null = 700;
    if (!options.disableCap) {
      // Current calendar month period: YYYY-MM-01
      const year = asOf.getUTCFullYear();
      const month = String(asOf.getUTCMonth() + 1).padStart(2, "0");
      const currentMonthPeriod = `${year}-${month}-01`;

      // Fetch current or most recent snapshot as anchor (P6)
      const snapshot = await prisma.scoreSnapshot.findFirst({
        where: {
          userId,
          period: { lte: currentMonthPeriod }
        },
        orderBy: { period: "desc" }
      });

      if (snapshot) {
        monthlyAnchorScore = snapshot.score;
      } else {
        // Brand new account with no historical snapshot starts at 700
        monthlyAnchorScore = 700;
      }
    }

    // 7. Prepare inputs for pure engine
    const scoringUserInput: ScoringUserInput = {
      userId: user.userId,
      registrationDate: user.registrationDate
    };

    const scoringVehicleInputs: ScoringVehicleInput[] = vehicles.map((v) => ({
      vehicleId: v.vehicleId,
      insuranceExpiry: v.insuranceExpiry,
      pucExpiry: v.pucExpiry,
      rcValidityTill: v.rcValidityTill
    }));

    const scoringLicenceInput: ScoringLicenceInput | null = licence
      ? {
          licenceId: licence.licenceId,
          expiryDate: licence.expiryDate
        }
      : null;

    const scoringChallanInputs: ScoringChallanInput[] = challans.map((c) => ({
      challanId: c.challanId,
      challanDate: c.challanDate,
      severity: c.severity as "LOW" | "MEDIUM" | "HIGH",
      violationCode: c.violationCode,
      violationDesc: c.violationDesc,
      status: c.status,
      dueDate: c.dueDate,
      paymentDate: c.paymentDate,
      scoringEligible: c.scoringEligible
    }));

    // 8. Execute pure calculation
    const result = computeVaiScore(
      scoringUserInput,
      scoringChallanInputs,
      scoringVehicleInputs,
      scoringLicenceInput,
      {
        asOfDate: asOf,
        config: configParameters,
        configVersion,
        monthlyAnchorScore,
        disableCap: options.disableCap ?? false
      }
    );

    // 9. Persist to DB if writeLedger !== false
    if (options.writeLedger !== false) {
      await scoreRepository.persistScoreAndLedger(
        userId,
        result.score,
        result.scoreBeforeCap,
        result.category,
        configVersion,
        result.ledgerEntries.map((e) => ({
          eventType: e.eventType,
          component: e.component,
          reasonCode: e.reasonCode,
          refId: e.refId,
          deltaPoints: e.deltaPoints,
          balanceBefore: e.balanceBefore,
          balanceAfter: e.balanceAfter,
          configVersion: e.configVersion,
          createdAt: asOf
        })),
        asOf
      );
    }

    return result;
  }
}

export const scoringService = new ScoringService();
