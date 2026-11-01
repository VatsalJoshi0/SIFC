import { diffCalendarDays, isDocumentValid } from "@vai/shared";
import { type ScoringParameters, DEFAULT_SCORING_CONFIG_V1 } from "./config.js";
import { ReasonCode, getReasonMetadata } from "./reasons.js";

export interface ScoringChallanInput {
  challanId: string;
  challanDate: string | Date;
  severity: "LOW" | "MEDIUM" | "HIGH";
  violationCode: string;
  violationDesc?: string;
  status: string; // PAID, UNPAID, PENDING, DISPUTED, WAIVED
  dueDate: string | Date;
  paymentDate?: string | Date | null;
  scoringEligible: boolean;
}

export interface ScoringVehicleInput {
  vehicleId: string;
  insuranceExpiry?: string | Date | null;
  pucExpiry?: string | Date | null;
  rcValidityTill: string | Date;
}

export interface ScoringLicenceInput {
  licenceId: string;
  expiryDate: string | Date;
}

export interface ScoringUserInput {
  userId: string;
  registrationDate: string | Date;
}

export interface EngineLedgerEntry {
  eventType: string;
  component: string;
  reasonCode: string;
  refId?: string | null;
  deltaPoints: number;
  balanceBefore: number;
  balanceAfter: number;
  configVersion: number;
  label: string;
  plainDescription: string;
}

export interface TopReasonItem {
  reasonCode: string;
  label: string;
  delta: number;
}

export interface ScoreCalculationResult {
  score: number;
  rawScore: number;
  scoreBeforeCap: number;
  category: "FAIR" | "GOOD" | "VERY_GOOD";
  vPenalty: number;
  rpPenalty: number;
  paymentComponent: number;
  streakBonus: number;
  complianceComponent: number;
  cVehicle: number;
  cLicence: number;
  ledgerEntries: EngineLedgerEntry[];
  topReasons: TopReasonItem[];
  nextMilestone: {
    score: number;
    category: "GOOD" | "VERY_GOOD";
    pointsNeeded: number;
  } | null;
}

export interface ScoringOptions {
  asOfDate?: string | Date;
  config?: ScoringParameters;
  configVersion?: number;
  monthlyAnchorScore?: number | null;
  disableCap?: boolean;
}

/**
 * Pure-function VAI scoring engine.
 * Computes transparent, deterministic score and immutable ledger entries.
 * ZERO database access inside this function.
 */
export function computeVaiScore(
  user: ScoringUserInput,
  challans: ScoringChallanInput[],
  vehicles: ScoringVehicleInput[],
  licence: ScoringLicenceInput | null,
  options: ScoringOptions = {}
): ScoreCalculationResult {
  const asOf = options.asOfDate ?? new Date();
  const cfg = options.config ?? DEFAULT_SCORING_CONFIG_V1;
  const configVer = options.configVersion ?? 1;

  // Filter confirmed challans as of evaluation date
  // P6: treat later data as non-existent
  const eligibleChallans = challans.filter((c) => {
    if (!c.scoringEligible) return false;
    if (c.status !== "PAID" && c.status !== "UNPAID") return false;
    return diffCalendarDays(c.challanDate, asOf) >= 0;
  });

  // Determine effective status as of evaluation date
  // A challan is PAID as of D only if paymentDate <= D; otherwise UNPAID as of D
  const effectiveChallans = eligibleChallans.map((c) => {
    let effectiveStatus = c.status;
    let effectivePaymentDate = c.paymentDate;

    if (c.status === "PAID") {
      if (!c.paymentDate || diffCalendarDays(c.paymentDate, asOf) < 0) {
        effectiveStatus = "UNPAID";
        effectivePaymentDate = null;
      }
    }
    return {
      ...c,
      status: effectiveStatus,
      paymentDate: effectivePaymentDate
    };
  });

  const rawLedger: Array<{
    eventType: string;
    component: string;
    reasonCode: string;
    refId?: string | null;
    delta: number;
  }> = [];

  // ==========================================================================
  // 1. V - Violation Penalty (age-decayed, severity-weighted)
  // ==========================================================================
  let vSum = 0;
  for (const c of effectiveChallans) {
    const ageDays = diffCalendarDays(c.challanDate, asOf);
    const weight = cfg.severityWeights[c.severity] ?? 5;
    // Decay: 0.5 ^ (age / 365)
    const decay = Math.pow(0.5, ageDays / cfg.halfLifeDays);
    const penalty = -weight * decay;
    vSum += penalty;

    const code =
      c.severity === "HIGH"
        ? ReasonCode.VIO_HIGH
        : c.severity === "MEDIUM"
          ? ReasonCode.VIO_MEDIUM
          : ReasonCode.VIO_LOW;

    rawLedger.push({
      eventType: "VIOLATION",
      component: "V",
      reasonCode: code,
      refId: c.challanId,
      delta: penalty
    });
  }

  // Violation penalty cap (default -150)
  const vPenalty = Math.max(cfg.vPenaltyCap, vSum);
  if (vSum < cfg.vPenaltyCap) {
    const capDelta = cfg.vPenaltyCap - vSum;
    rawLedger.push({
      eventType: "VIOLATION",
      component: "V",
      reasonCode: ReasonCode.VIO_CAP_REACHED,
      refId: null,
      delta: capDelta
    });
  }

  // ==========================================================================
  // 2. RP - Repeat Penalty (P5: sum over codes in last 365 days)
  // ==========================================================================
  const recentChallans = effectiveChallans.filter(
    (c) => diffCalendarDays(c.challanDate, asOf) <= cfg.repeatWindowDays
  );

  const codeCounts = new Map<string, number>();
  for (const c of recentChallans) {
    codeCounts.set(c.violationCode, (codeCounts.get(c.violationCode) ?? 0) + 1);
  }

  let totalRepeatsPenalty = 0;
  for (const count of codeCounts.values()) {
    if (count > 1) {
      totalRepeatsPenalty += cfg.repeatPenaltyStep * (count - 1);
    }
  }

  const rpPenalty = -Math.min(Math.abs(cfg.repeatPenaltyCap), totalRepeatsPenalty);
  if (rpPenalty < 0) {
    rawLedger.push({
      eventType: "REPEAT",
      component: "RP",
      reasonCode: ReasonCode.REPEAT_VIOLATIONS,
      refId: null,
      delta: rpPenalty
    });
  }

  // ==========================================================================
  // 3. P - Payment Behaviour
  // ==========================================================================
  let nOnTime = 0;
  let nOverdueUnpaid = 0;

  for (const c of effectiveChallans) {
    if (c.status === "PAID" && c.paymentDate) {
      // Paid on time if paymentDate <= dueDate
      if (diffCalendarDays(c.paymentDate, c.dueDate) >= 0) {
        nOnTime++;
      }
    } else if (c.status === "UNPAID") {
      // Overdue unpaid if asOf > dueDate
      if (diffCalendarDays(c.dueDate, asOf) > 0) {
        nOverdueUnpaid++;
      }
    }
  }

  const onTimeReward = Math.min(cfg.paymentOnTimeCap, cfg.paymentOnTimeReward * nOnTime);
  const overduePenalty = Math.max(cfg.paymentOverdueCap, cfg.paymentOverduePenalty * nOverdueUnpaid);
  const paymentComponent = onTimeReward + overduePenalty;

  if (onTimeReward > 0) {
    rawLedger.push({
      eventType: "PAYMENT",
      component: "P",
      reasonCode: ReasonCode.PAY_ON_TIME,
      refId: null,
      delta: onTimeReward
    });
  }
  if (overduePenalty < 0) {
    rawLedger.push({
      eventType: "UNPAID_OVERDUE",
      component: "P",
      reasonCode: ReasonCode.PAY_OVERDUE_UNPAID,
      refId: null,
      delta: overduePenalty
    });
  }

  // ==========================================================================
  // 4. D - Driving Discipline / Streak (P4: highest milestone reached)
  // ==========================================================================
  let streakDays = 0;
  if (effectiveChallans.length > 0) {
    // Days since the most recent confirmed violation
    let minAge = Infinity;
    for (const c of effectiveChallans) {
      const age = diffCalendarDays(c.challanDate, asOf);
      if (age < minAge) minAge = age;
    }
    streakDays = minAge;
  } else {
    // Zero confirmed violations: days since user registration
    streakDays = Math.max(0, diffCalendarDays(user.registrationDate, asOf));
  }

  let streakBonus = 0;
  let streakCode: string = ReasonCode.STREAK_NONE;
  // cfg.streakMilestones sorted descending (180, 90, 30)
  for (const milestone of cfg.streakMilestones) {
    if (streakDays >= milestone.days) {
      streakBonus = milestone.bonus;
      if (milestone.days >= 180) streakCode = ReasonCode.STREAK_180D;
      else if (milestone.days >= 90) streakCode = ReasonCode.STREAK_90D;
      else streakCode = ReasonCode.STREAK_30D;
      break;
    }
  }

  if (streakBonus > 0) {
    rawLedger.push({
      eventType: "STREAK",
      component: "D",
      reasonCode: streakCode,
      refId: null,
      delta: streakBonus
    });
  }

  // ==========================================================================
  // 5. C - Vehicle and Licence Compliance
  // ==========================================================================
  let cVehicle = 0;
  if (vehicles.length > 0) {
    let vehicleScoreSum = 0;
    for (const v of vehicles) {
      let cv = 0;
      let expiredCount = 0;

      // Insurance
      if (isDocumentValid(v.insuranceExpiry, asOf)) {
        cv += cfg.vehicleValidDocBonus;
      } else {
        expiredCount++;
      }

      // PUC
      if (isDocumentValid(v.pucExpiry, asOf)) {
        cv += cfg.vehicleValidDocBonus;
      } else {
        expiredCount++;
      }

      // RC
      if (isDocumentValid(v.rcValidityTill, asOf)) {
        cv += cfg.vehicleValidDocBonus;
      } else {
        expiredCount++;
      }

      cv += expiredCount * cfg.vehicleExpiredDocPenalty;
      vehicleScoreSum += cv;
    }

    const avgCv = vehicleScoreSum / vehicles.length;
    cVehicle = Math.min(cfg.vehicleBandMax, Math.max(cfg.vehicleBandMin, avgCv));
  }

  // Licence
  let cLicence = 0;
  if (!licence || !isDocumentValid(licence.expiryDate, asOf)) {
    cLicence = cfg.licenceExpiredPenalty;
  }

  const complianceComponent = cVehicle + cLicence;

  if (cVehicle > 0) {
    rawLedger.push({
      eventType: "VEHICLE",
      component: "C",
      reasonCode: cVehicle === 15 ? ReasonCode.VEH_FULL_COMPLY : ReasonCode.VEH_PARTIAL_COMPLY,
      refId: null,
      delta: cVehicle
    });
  } else if (cVehicle < 0) {
    rawLedger.push({
      eventType: "VEHICLE",
      component: "C",
      reasonCode: ReasonCode.VEH_EXPIRED_DOCS,
      refId: null,
      delta: cVehicle
    });
  }

  if (cLicence < 0) {
    rawLedger.push({
      eventType: "LICENCE",
      component: "C",
      reasonCode: ReasonCode.LICENCE_EXPIRED,
      refId: licence?.licenceId ?? null,
      delta: cLicence
    });
  }

  // ==========================================================================
  // 6. Total Calculation, Clamping & Monthly Cap (P6)
  // ==========================================================================
  const rawScore = cfg.baseScore + vPenalty + rpPenalty + paymentComponent + streakBonus + complianceComponent;
  const scoreBeforeCap = rawScore;
  let finalScore = Math.min(cfg.maxScore, Math.max(cfg.minScore, Math.round(rawScore)));

  // Monthly Cap Logic (P6)
  if (!options.disableCap && options.monthlyAnchorScore !== undefined && options.monthlyAnchorScore !== null) {
    const anchor = options.monthlyAnchorScore;
    const diff = finalScore - anchor;
    if (Math.abs(diff) > cfg.monthlyMovementLimit) {
      const capped = anchor + Math.sign(diff) * cfg.monthlyMovementLimit;
      const capAdjustment = capped - finalScore;
      finalScore = capped;

      rawLedger.push({
        eventType: "CAP_ADJ",
        component: "CAP",
        reasonCode: ReasonCode.CAP_ADJ_MONTHLY_LIMIT,
        refId: null,
        delta: capAdjustment
      });
    }
  }

  // Category Resolution (TRD 10.1)
  let category: "FAIR" | "GOOD" | "VERY_GOOD";
  if (finalScore >= 750) {
    category = "VERY_GOOD";
  } else if (finalScore >= 650) {
    category = "GOOD";
  } else {
    category = "FAIR";
  }

  // Next Milestone
  let nextMilestone: ScoreCalculationResult["nextMilestone"] = null;
  if (category === "FAIR") {
    nextMilestone = {
      score: 650,
      category: "GOOD",
      pointsNeeded: 650 - finalScore
    };
  } else if (category === "GOOD") {
    nextMilestone = {
      score: 750,
      category: "VERY_GOOD",
      pointsNeeded: 750 - finalScore
    };
  }

  // Build sequential ledger with running balances
  let runningBalance = cfg.baseScore;
  const ledgerEntries: EngineLedgerEntry[] = rawLedger.map((item) => {
    const meta = getReasonMetadata(item.reasonCode);
    const balanceBefore = runningBalance;
    runningBalance = Math.min(cfg.maxScore, Math.max(cfg.minScore, Math.round(runningBalance + item.delta)));
    return {
      eventType: item.eventType,
      component: item.component,
      reasonCode: item.reasonCode,
      refId: item.refId ?? null,
      deltaPoints: Number(item.delta.toFixed(2)),
      balanceBefore,
      balanceAfter: runningBalance,
      configVersion: configVer,
      label: meta.label,
      plainDescription: meta.plainDescription
    };
  });

  // Top 3 reasons by absolute impact
  const topReasons: TopReasonItem[] = [...rawLedger]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
    .map((item) => {
      const meta = getReasonMetadata(item.reasonCode);
      return {
        reasonCode: item.reasonCode,
        label: meta.label,
        delta: Number(item.delta.toFixed(2))
      };
    });

  return {
    score: finalScore,
    rawScore: Number(rawScore.toFixed(2)),
    scoreBeforeCap: Number(scoreBeforeCap.toFixed(2)),
    category,
    vPenalty: Number(vPenalty.toFixed(2)),
    rpPenalty: Number(rpPenalty.toFixed(2)),
    paymentComponent: Number(paymentComponent.toFixed(2)),
    streakBonus: Number(streakBonus.toFixed(2)),
    complianceComponent: Number(complianceComponent.toFixed(2)),
    cVehicle: Number(cVehicle.toFixed(2)),
    cLicence: Number(cLicence.toFixed(2)),
    ledgerEntries,
    topReasons,
    nextMilestone
  };
}
