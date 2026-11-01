import { describe, it, expect } from "vitest";
import {
  roundHalfUpDiv,
  calculateDiscountPaise,
  calculatePlatformFeePaise,
  calculateFeeReversalPaise,
  formatPaiseToINR,
  paiseToSafeNumber
} from "../src/money.js";

describe("Money & Rounding (Golden Tests G2, G3, G4, G7)", () => {
  it("roundHalfUpDiv rounds positive and negative numbers correctly", () => {
    expect(roundHalfUpDiv(5n, 2n)).toBe(3n);
    expect(roundHalfUpDiv(4n, 2n)).toBe(2n);
    expect(roundHalfUpDiv(-5n, 2n)).toBe(-3n);
    expect(roundHalfUpDiv(-4n, 2n)).toBe(-2n);
    expect(() => roundHalfUpDiv(1n, 0n)).toThrow("Division by zero in money calculation");
  });

  it("G4: Rounding is half-up (base 12,350 at 100 bps -> 124; base 12,345 -> 123)", () => {
    // 12350 * 100 / 10000 = 123.5 -> 124
    const discount1 = calculateDiscountPaise(12_350n, 100);
    expect(discount1).toBe(124n);

    // 12345 * 100 / 10000 = 123.45 -> 123
    const discount2 = calculateDiscountPaise(12_345n, 100);
    expect(discount2).toBe(123n);
  });

  it("G2: Rewards on base 1,000,000 paise (VERY_GOOD 200 bps -> 20,000; GOOD 100 bps -> 10,000; FAIR 0 -> 0)", () => {
    const baseAmount = 1_000_000n; // ₹10,000.00

    // VERY_GOOD (200 bps)
    const discountVG = calculateDiscountPaise(baseAmount, 200);
    expect(discountVG).toBe(20_000n);
    expect(baseAmount - discountVG).toBe(980_000n);

    // GOOD (100 bps)
    const discountGood = calculateDiscountPaise(baseAmount, 100);
    expect(discountGood).toBe(10_000n);
    expect(baseAmount - discountGood).toBe(990_000n);

    // FAIR (0 bps)
    const discountFair = calculateDiscountPaise(baseAmount, 0);
    expect(discountFair).toBe(0n);
    expect(baseAmount - discountFair).toBe(1_000_000n);
  });

  it("G3: Fees on base 1,000,000 paise (50 ppm -> 50 paise; 100 ppm -> 100 paise; PROVIDER_PAYS & PASS_THROUGH)", () => {
    const baseAmount = 1_000_000n;

    // Option A: 50 ppm
    const feeA = calculatePlatformFeePaise(baseAmount, 50);
    expect(feeA).toBe(50n);

    // Option B: 100 ppm
    const feeB = calculatePlatformFeePaise(baseAmount, 100);
    expect(feeB).toBe(100n);

    // VERY_GOOD + PROVIDER_PAYS
    const discount = calculateDiscountPaise(baseAmount, 200); // 20,000n
    const userPayable = baseAmount - discount; // 980,000n
    const settlementToProvider = baseAmount - discount - feeA; // 979,950n
    expect(userPayable).toBe(980_000n);
    expect(settlementToProvider).toBe(979_950n);

    // PASS_THROUGH mode: user total = payable + fee
    const userTotal = userPayable + feeA;
    expect(userTotal).toBe(980_050n);
  });

  it("G7: Partial refund (base 1,000,000, fee 50 paise, refund of 400,000 -> fee reversed 20 paise)", () => {
    const totalBase = 1_000_000n;
    const fee = 50n;
    const refundedBase = 400_000n;

    const feeReversed = calculateFeeReversalPaise(fee, refundedBase, totalBase);
    expect(feeReversed).toBe(20n);
  });

  it("formats paise as Indian Rupees with en-IN numbering", () => {
    expect(formatPaiseToINR(980_000n)).toBe("₹9,800.00");
    expect(formatPaiseToINR(50n)).toBe("₹0.50");
    expect(formatPaiseToINR(1_000_000n)).toBe("₹10,000.00");
    expect(formatPaiseToINR(12_345_678n)).toBe("₹1,23,456.78");
    expect(formatPaiseToINR(0n)).toBe("₹0.00");
    expect(formatPaiseToINR(-500n)).toBe("-₹5.00");
  });

  it("safely guards against numbers exceeding MAX_SAFE_INTEGER", () => {
    expect(paiseToSafeNumber(1000n)).toBe(1000);
    expect(() => paiseToSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 10n)).toThrow(RangeError);
  });
});
