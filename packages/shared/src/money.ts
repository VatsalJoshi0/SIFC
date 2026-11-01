/**
 * Money utilities for VAI.
 * Money is strictly stored and calculated as integer paise (BigInt).
 * 1 Rupee = 100 paise.
 * No floats for money arithmetic anywhere.
 */

/**
 * Performs round-half-up integer division: round_half_up(num / den).
 * Handles both positive and negative values correctly.
 */
export function roundHalfUpDiv(num: bigint, den: bigint): bigint {
  if (den === 0n) {
    throw new Error("Division by zero in money calculation");
  }
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  if (num >= 0n) {
    return (num + den / 2n) / den;
  } else {
    return (num - den / 2n) / den;
  }
}

/**
 * Calculates discount in paise from base amount in paise and basis points (bps).
 * 1% = 100 bps. 100% = 10,000 bps.
 * discount_paise = round_half_up(base_amount_paise * discount_bps / 10000)
 */
export function calculateDiscountPaise(baseAmountPaise: bigint, discountBps: number | bigint): bigint {
  const bps = BigInt(discountBps);
  return roundHalfUpDiv(baseAmountPaise * bps, 10_000n);
}

/**
 * Calculates platform fee in paise from base amount in paise and parts-per-million (ppm).
 * 50 ppm = 0.005%. 100 ppm = 0.010%.
 * platform_fee_paise = round_half_up(base_amount_paise * ppm / 1,000,000)
 */
export function calculatePlatformFeePaise(baseAmountPaise: bigint, feePpm: number | bigint): bigint {
  const ppm = BigInt(feePpm);
  return roundHalfUpDiv(baseAmountPaise * ppm, 1_000_000n);
}

/**
 * Calculates fee reversal for a partial refund (P7).
 * fee_reversed = round_half_up(fee * refunded_base / base)
 */
export function calculateFeeReversalPaise(
  feePaise: bigint,
  refundedBasePaise: bigint,
  totalBasePaise: bigint
): bigint {
  if (totalBasePaise === 0n) return 0n;
  return roundHalfUpDiv(feePaise * refundedBasePaise, totalBasePaise);
}

/**
 * Converts paise BigInt to safe JavaScript number with safe-integer validation.
 * Used exclusively at repository/presentation boundaries.
 */
export function paiseToSafeNumber(paise: bigint): number {
  const num = Number(paise);
  if (!Number.isSafeInteger(num)) {
    throw new RangeError(`Paise value ${paise.toString()} exceeds JavaScript safe integer limit`);
  }
  return num;
}

/**
 * Formats paise as Indian Rupees with ₹ symbol and en-IN number grouping.
 * Example: 980000n -> "₹9,800.00"
 * Example: 50n -> "₹0.50"
 */
export function formatPaiseToINR(paise: bigint): string {
  const isNegative = paise < 0n;
  const absPaise = isNegative ? -paise : paise;
  const rupees = absPaise / 100n;
  const fraction = absPaise % 100n;

  // Format whole rupee portion using en-IN grouping (e.g. 10,00,000)
  const rupeesStr = rupees.toString();
  let formattedRupees: string;

  if (rupeesStr.length <= 3) {
    formattedRupees = rupeesStr;
  } else {
    const lastThree = rupeesStr.slice(-3);
    const remaining = rupeesStr.slice(0, -3);
    // Indian numbering groups in pairs of 2 after the last 3
    const withCommas = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    formattedRupees = `${withCommas},${lastThree}`;
  }

  const fractionStr = fraction.toString().padStart(2, "0");
  const prefix = isNegative ? "-₹" : "₹";
  return `${prefix}${formattedRupees}.${fractionStr}`;
}
