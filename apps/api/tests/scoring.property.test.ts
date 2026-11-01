import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeVaiScore, type ScoringChallanInput } from "../src/modules/scoring/engine.js";

describe("Property-Based Invariants (Golden Test G6)", () => {
  const asOfDate = "2026-10-30";

  // Arbitrary generator for random challans
  const arbSeverity = fc.constantFrom("LOW" as const, "MEDIUM" as const, "HIGH" as const);
  const arbStatus = fc.constantFrom("PAID", "UNPAID", "PENDING", "DISPUTED", "WAIVED");
  const arbCode = fc.constantFrom("RLVD", "SPD", "PARK", "HELM", "SEAT", "DOCS");

  const arbChallan = fc.record({
    challanId: fc.uuid(),
    challanDate: fc.date({ min: new Date("2024-01-01"), max: new Date("2026-10-30") }).map((d) => d.toISOString().slice(0, 10)),
    severity: arbSeverity,
    violationCode: arbCode,
    status: arbStatus,
    dueDate: fc.date({ min: new Date("2024-01-01"), max: new Date("2026-12-31") }).map((d) => d.toISOString().slice(0, 10)),
    paymentDate: fc.option(
      fc.date({ min: new Date("2024-01-01"), max: new Date("2026-10-30") }).map((d) => d.toISOString().slice(0, 10)),
      { nil: null }
    ),
    scoringEligible: fc.boolean()
  });

  const arbVehicle = fc.record({
    vehicleId: fc.uuid(),
    insuranceExpiry: fc.option(
      fc.date({ min: new Date("2025-01-01"), max: new Date("2028-01-01") }).map((d) => d.toISOString().slice(0, 10)),
      { nil: null }
    ),
    pucExpiry: fc.option(
      fc.date({ min: new Date("2025-01-01"), max: new Date("2028-01-01") }).map((d) => d.toISOString().slice(0, 10)),
      { nil: null }
    ),
    rcValidityTill: fc.date({ min: new Date("2025-01-01"), max: new Date("2030-01-01") }).map((d) => d.toISOString().slice(0, 10))
  });

  const arbLicence = fc.option(
    fc.record({
      licenceId: fc.uuid(),
      expiryDate: fc.date({ min: new Date("2024-01-01"), max: new Date("2032-01-01") }).map((d) => d.toISOString().slice(0, 10))
    }),
    { nil: null }
  );

  const arbUser = fc.record({
    userId: fc.uuid(),
    registrationDate: fc.date({ min: new Date("2023-01-01"), max: new Date("2026-10-25") }).map((d) => d.toISOString().slice(0, 10))
  });

  it("G6.1: Score is strictly bounded between 500 and 900 for any random history", () => {
    fc.assert(
      fc.property(
        arbUser,
        fc.array(arbChallan, { maxLength: 30 }),
        fc.array(arbVehicle, { maxLength: 5 }),
        arbLicence,
        (user, challans, vehicles, licence) => {
          const result = computeVaiScore(user, challans, vehicles, licence, { asOfDate, disableCap: true });
          expect(result.score).toBeGreaterThanOrEqual(500);
          expect(result.score).toBeLessThanOrEqual(900);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it("G6.2: Adding a confirmed violation never raises the score (monotonicity)", () => {
    fc.assert(
      fc.property(
        arbUser,
        fc.array(arbChallan, { maxLength: 10 }),
        fc.array(arbVehicle, { maxLength: 3 }),
        arbLicence,
        arbSeverity,
        arbCode,
        (user, challans, vehicles, licence, sev, code) => {
          const baseResult = computeVaiScore(user, challans, vehicles, licence, { asOfDate, disableCap: true });

          // Add a confirmed unpaid violation
          const newChallan: ScoringChallanInput = {
            challanId: "ch-extra-vio",
            challanDate: "2026-10-20",
            severity: sev,
            violationCode: code,
            status: "UNPAID",
            dueDate: "2026-12-19",
            scoringEligible: true
          };

          const withVioResult = computeVaiScore(user, [...challans, newChallan], vehicles, licence, {
            asOfDate,
            disableCap: true
          });

          // Adding violation must never increase raw score
          expect(withVioResult.rawScore).toBeLessThanOrEqual(baseResult.rawScore + 0.001);
          expect(withVioResult.score).toBeLessThanOrEqual(baseResult.score);
        }
      ),
      { numRuns: 500 }
    );
  });

  it("G6.3: Non-scoring challans (PENDING, DISPUTED, WAIVED) never change the score", () => {
    fc.assert(
      fc.property(
        arbUser,
        fc.array(arbChallan, { maxLength: 10 }),
        fc.array(arbVehicle, { maxLength: 3 }),
        arbLicence,
        fc.constantFrom("PENDING", "DISPUTED", "WAIVED"),
        (user, challans, vehicles, licence, nonScoreStatus) => {
          const baseResult = computeVaiScore(user, challans, vehicles, licence, { asOfDate, disableCap: true });

          const ignoredChallan: ScoringChallanInput = {
            challanId: "ch-ignored",
            challanDate: "2026-10-20",
            severity: "HIGH",
            violationCode: "RLVD",
            status: nonScoreStatus,
            dueDate: "2026-12-19",
            scoringEligible: false
          };

          const result = computeVaiScore(user, [...challans, ignoredChallan], vehicles, licence, {
            asOfDate,
            disableCap: true
          });

          expect(result.score).toBe(baseResult.score);
          expect(result.rawScore).toBe(baseResult.rawScore);
        }
      ),
      { numRuns: 500 }
    );
  });

  it("G6.4: Aging/decay never increases a violation penalty", () => {
    const user = { userId: "u-decay", registrationDate: "2023-01-01" };
    // Same violation evaluated at older ages
    const challanYoung = {
      challanId: "c1",
      challanDate: "2026-10-01", // age 29
      severity: "HIGH" as const,
      violationCode: "SPD",
      status: "PAID",
      dueDate: "2026-11-01",
      paymentDate: "2026-10-02",
      scoringEligible: true
    };

    const challanOld = {
      ...challanYoung,
      challanDate: "2025-10-01" // age 394 (older by 1 year)
    };

    const resYoung = computeVaiScore(user, [challanYoung], [], null, { asOfDate, disableCap: true });
    const resOld = computeVaiScore(user, [challanOld], [], null, { asOfDate, disableCap: true });

    // Older violation has decayed more, so penalty is LESS negative (greater algebraically)
    expect(resOld.vPenalty).toBeGreaterThan(resYoung.vPenalty);
  });

  it("G6.5: Ledger deltas reconcile to the total score change within +/-1", () => {
    fc.assert(
      fc.property(
        arbUser,
        fc.array(arbChallan, { maxLength: 10 }),
        fc.array(arbVehicle, { maxLength: 3 }),
        arbLicence,
        (user, challans, vehicles, licence) => {
          const result = computeVaiScore(user, challans, vehicles, licence, { asOfDate, disableCap: true });
          const sumDeltas = result.ledgerEntries.reduce((sum, entry) => sum + entry.deltaPoints, 0);
          const computedDelta = result.rawScore - 700;
          expect(Math.abs(sumDeltas - computedDelta)).toBeLessThanOrEqual(1.0);
        }
      ),
      { numRuns: 500 }
    );
  });
});
