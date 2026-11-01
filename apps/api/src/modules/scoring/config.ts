import { z } from "zod";

export const ScoringParametersSchema = z.object({
  baseScore: z.number().default(700),
  minScore: z.number().default(500),
  maxScore: z.number().default(900),
  halfLifeDays: z.number().default(365),
  severityWeights: z
    .object({
      LOW: z.number().default(5),
      MEDIUM: z.number().default(15),
      HIGH: z.number().default(30)
    })
    .default({ LOW: 5, MEDIUM: 15, HIGH: 30 }),
  vPenaltyCap: z.number().default(-150),
  repeatPenaltyStep: z.number().default(10),
  repeatPenaltyCap: z.number().default(-40),
  repeatWindowDays: z.number().default(365),
  paymentOnTimeReward: z.number().default(3),
  paymentOnTimeCap: z.number().default(30),
  paymentOverduePenalty: z.number().default(-20),
  paymentOverdueCap: z.number().default(-100),
  streakMilestones: z.array(
    z.object({
      days: z.number(),
      bonus: z.number()
    })
  ).default([
    { days: 180, bonus: 50 },
    { days: 90, bonus: 25 },
    { days: 30, bonus: 10 }
  ]),
  vehicleValidDocBonus: z.number().default(5),
  vehicleExpiredDocPenalty: z.number().default(-10),
  vehicleBandMin: z.number().default(-30),
  vehicleBandMax: z.number().default(15),
  licenceExpiredPenalty: z.number().default(-15),
  monthlyMovementLimit: z.number().default(50)
});

export type ScoringParameters = z.infer<typeof ScoringParametersSchema>;

export const DEFAULT_SCORING_CONFIG_V1: ScoringParameters = ScoringParametersSchema.parse({});
