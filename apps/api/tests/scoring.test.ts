import { describe, it, expect } from "vitest";
import { computeVaiScore } from "../src/modules/scoring/engine.js";

describe("VAI Scoring Engine - Golden Test G1 & Edge Cases", () => {
  const asOfDate = "2026-10-30";

  it("G1: Golden Test (PRD 7.4, TRD 9.5 worked example)", () => {
    // 1 user
    const user = {
      userId: "u-golden-1",
      registrationDate: "2024-01-01"
    };

    // 2 LOW challans aged 200 and 300 days, 1 MEDIUM aged 60 days, all PAID on time
    // Age 60 days before 2026-10-30 = 2026-08-31
    // Age 200 days before 2026-10-30 = 2026-04-13
    // Age 300 days before 2026-10-30 = 2026-01-03
    const challans = [
      {
        challanId: "CH-G1-1",
        challanDate: "2026-08-31", // age 60
        severity: "MEDIUM" as const,
        violationCode: "RLVD",
        status: "PAID",
        dueDate: "2026-10-30",
        paymentDate: "2026-09-15", // on time
        scoringEligible: true
      },
      {
        challanId: "CH-G1-2",
        challanDate: "2026-04-13", // age 200
        severity: "LOW" as const,
        violationCode: "PARK",
        status: "PAID",
        dueDate: "2026-06-12",
        paymentDate: "2026-05-01", // on time
        scoringEligible: true
      },
      {
        challanId: "CH-G1-3",
        challanDate: "2026-01-03", // age 300
        severity: "LOW" as const,
        violationCode: "SEAT",
        status: "PAID",
        dueDate: "2026-03-04",
        paymentDate: "2026-02-01", // on time
        scoringEligible: true
      }
    ];

    // One vehicle with valid insurance, PUC, and RC
    const vehicles = [
      {
        vehicleId: "v-g1-1",
        insuranceExpiry: "2027-01-01",
        pucExpiry: "2027-01-01",
        rcValidityTill: "2030-01-01"
      }
    ];

    // Valid licence
    const licence = {
      licenceId: "lic-g1-1",
      expiryDate: "2030-01-01"
    };

    const result = computeVaiScore(user, challans, vehicles, licence, { asOfDate });

    // Golden values verification
    expect(result.vPenalty).toBe(-19.63);
    expect(result.rpPenalty).toBe(0);
    expect(result.paymentComponent).toBe(9);
    expect(result.streakBonus).toBe(10); // 60 days streak
    expect(result.complianceComponent).toBe(15);
    expect(result.rawScore).toBe(714.37);
    expect(result.score).toBe(714);
    expect(result.category).toBe("GOOD");
    expect(result.nextMilestone).not.toBeNull();
    expect(result.nextMilestone?.score).toBe(750);
    expect(result.nextMilestone?.category).toBe("VERY_GOOD");
    expect(result.nextMilestone?.pointsNeeded).toBe(36);
  });

  it("excludes PENDING, DISPUTED, and WAIVED challans from scoring", () => {
    const user = { userId: "u-pend", registrationDate: "2026-09-01" };
    const vehicles = [{ vehicleId: "v1", rcValidityTill: "2030-01-01", insuranceExpiry: "2027-01-01", pucExpiry: "2027-01-01" }];
    const licence = { licenceId: "l1", expiryDate: "2030-01-01" };

    const cleanResult = computeVaiScore(user, [], vehicles, licence, { asOfDate });

    const nonEligibleChallans = [
      {
        challanId: "CH-P1",
        challanDate: "2026-10-15",
        severity: "HIGH" as const,
        violationCode: "SPD",
        status: "PENDING",
        dueDate: "2026-12-14",
        scoringEligible: false
      },
      {
        challanId: "CH-D1",
        challanDate: "2026-10-10",
        severity: "HIGH" as const,
        violationCode: "SPD",
        status: "DISPUTED",
        dueDate: "2026-12-09",
        scoringEligible: false
      },
      {
        challanId: "CH-W1",
        challanDate: "2026-10-05",
        severity: "HIGH" as const,
        violationCode: "SPD",
        status: "WAIVED",
        dueDate: "2026-12-04",
        scoringEligible: false
      }
    ];

    const withPendingResult = computeVaiScore(user, nonEligibleChallans, vehicles, licence, { asOfDate });

    expect(withPendingResult.score).toBe(cleanResult.score);
    expect(withPendingResult.vPenalty).toBe(0);
    expect(withPendingResult.rpPenalty).toBe(0);
  });

  it("applies monthly movement cap at 50 points (P6)", () => {
    const user = { userId: "u-cap", registrationDate: "2026-01-01" };
    // Brand new user with heavy violations: raw score drops to 520
    const manyViolations = Array.from({ length: 10 }, (_, i) => ({
      challanId: `CH-HEAVY-${i}`,
      challanDate: "2026-10-25",
      severity: "HIGH" as const,
      violationCode: `CODE_${i}`,
      status: "UNPAID",
      dueDate: "2026-09-01", // overdue
      scoringEligible: true
    }));

    // With monthlyAnchorScore = 700: max drop is 50 points -> score cannot drop below 650
    const cappedResult = computeVaiScore(user, manyViolations, [], null, {
      asOfDate,
      monthlyAnchorScore: 700,
      disableCap: false
    });

    expect(cappedResult.score).toBe(650);
    expect(cappedResult.ledgerEntries.some((e) => e.eventType === "CAP_ADJ")).toBe(true);

    // With disableCap = true (e.g. during seed backfill): can drop below 650
    const uncappedResult = computeVaiScore(user, manyViolations, [], null, {
      asOfDate,
      monthlyAnchorScore: 700,
      disableCap: true
    });

    expect(uncappedResult.score).toBeLessThan(650);
  });

  it("caps violation deductions at -150 and overdue deductions at -100", () => {
    const user = { userId: "u-limits", registrationDate: "2026-01-01" };
    // 20 HIGH violations (20 * 30 = 600 points)
    const severeViolations = Array.from({ length: 20 }, (_, i) => ({
      challanId: `CH-HIGH-${i}`,
      challanDate: "2026-10-29",
      severity: "HIGH" as const,
      violationCode: `VIO_${i}`,
      status: "UNPAID",
      dueDate: "2026-08-01", // overdue
      scoringEligible: true
    }));

    const result = computeVaiScore(user, severeViolations, [], null, { asOfDate, disableCap: true });
    expect(result.vPenalty).toBe(-150);
    expect(result.paymentComponent).toBe(-100);
  });
});
