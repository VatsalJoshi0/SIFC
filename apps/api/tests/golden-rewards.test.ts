import { describe, it, expect } from "vitest";
import {
  calculateDiscountPaise,
  calculatePlatformFeePaise,
  calculateFeeReversalPaise
} from "@vai/shared";

describe("Golden Tests: G2, G3, G7 (Rewards, Fees, Refunds)", () => {
  const BASE_1M_PAISE = 1_000_000n; // Rs. 10,000.00 in integer paise

  describe("G2: Rewards on base 1,000,000 paise", () => {
    // VERY_GOOD 200 bps -> discount 20,000, payable 980,000.
    // GOOD 100 bps -> 10,000 and 990,000.
    // FAIR 0 -> 0 and 1,000,000 (the breakdown still shows the zero line).

    it("calculates VERY_GOOD discount (200 bps = 2%) as 20,000 paise, payable 980,000 paise", () => {
      const discountBps = 200;
      const discountPaise = calculateDiscountPaise(BASE_1M_PAISE, discountBps);
      const payablePaise = BASE_1M_PAISE - discountPaise;

      expect(discountPaise).toBe(20_000n);
      expect(payablePaise).toBe(980_000n);
    });

    it("calculates GOOD discount (100 bps = 1%) as 10,000 paise, payable 990,000 paise", () => {
      const discountBps = 100;
      const discountPaise = calculateDiscountPaise(BASE_1M_PAISE, discountBps);
      const payablePaise = BASE_1M_PAISE - discountPaise;

      expect(discountPaise).toBe(10_000n);
      expect(payablePaise).toBe(990_000n);
    });

    it("calculates FAIR discount (0 bps = 0%) as 0 paise, payable 1,000,000 paise", () => {
      const discountBps = 0;
      const discountPaise = calculateDiscountPaise(BASE_1M_PAISE, discountBps);
      const payablePaise = BASE_1M_PAISE - discountPaise;

      expect(discountPaise).toBe(0n);
      expect(payablePaise).toBe(1_000_000n);
    });
  });

  describe("G3: Fees on base 1,000,000 paise", () => {
    // 50 ppm -> 50 paise; 100 ppm -> 100 paise.
    // VERY_GOOD + PROVIDER_PAYS: user pays 980,000, settlement to provider 979,950.
    // PASS_THROUGH: user total 980,050.

    it("computes Option A (50 ppm) as 50 paise, Option B (100 ppm) as 100 paise", () => {
      const feeOptionA = calculatePlatformFeePaise(BASE_1M_PAISE, 50);
      const feeOptionB = calculatePlatformFeePaise(BASE_1M_PAISE, 100);

      expect(feeOptionA).toBe(50n);
      expect(feeOptionB).toBe(100n);
    });

    it("computes VERY_GOOD + PROVIDER_PAYS settlement and user total", () => {
      const discountBps = 200;
      const discountPaise = calculateDiscountPaise(BASE_1M_PAISE, discountBps); // 20,000
      const payablePaise = BASE_1M_PAISE - discountPaise; // 980,000
      const feePaise = calculatePlatformFeePaise(BASE_1M_PAISE, 50); // 50 paise

      // In PROVIDER_PAYS: user pays payable amount (980,000 paise)
      const userTotal = payablePaise;
      // settlement_to_provider = base - discount - fee = 1,000,000 - 20,000 - 50 = 979,950 paise
      const settlementToProvider = BASE_1M_PAISE - discountPaise - feePaise;

      expect(userTotal).toBe(980_000n);
      expect(settlementToProvider).toBe(979_950n);
    });

    it("computes VERY_GOOD + PASS_THROUGH user total", () => {
      const discountBps = 200;
      const discountPaise = calculateDiscountPaise(BASE_1M_PAISE, discountBps); // 20,000
      const payablePaise = BASE_1M_PAISE - discountPaise; // 980,000
      const feePaise = calculatePlatformFeePaise(BASE_1M_PAISE, 50); // 50 paise

      // In PASS_THROUGH: user_total = payable + fee = 980,000 + 50 = 980,050 paise
      const userTotal = payablePaise + feePaise;
      // provider receives base - discount = 980,000 paise
      const settlementToProvider = BASE_1M_PAISE - discountPaise;

      expect(userTotal).toBe(980_050n);
      expect(settlementToProvider).toBe(980_000n);
    });
  });

  describe("G7: Partial refund fee reversal", () => {
    // base 1,000,000, fee 50 paise, refund of 400,000 -> fee reversed 20 paise.

    it("reverses fee proportionally: round_half_up(50 * 400,000 / 1,000,000) = 20 paise", () => {
      const totalBasePaise = 1_000_000n;
      const feePaise = 50n;
      const refundedBasePaise = 400_000n;

      const feeReversed = calculateFeeReversalPaise(feePaise, refundedBasePaise, totalBasePaise);
      expect(feeReversed).toBe(20n);
    });
  });
});
