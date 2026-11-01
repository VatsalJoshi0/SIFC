/**
 * Configuration constants for VAI Services, Pricing, and Renewal Extensions.
 * Spec Patch P8: Simulated price table in config; FOUR_WHEELER insurance must be Rs 10,000 (1,000,000 paise).
 * All money values are strictly integer paise (BigInt).
 */

export interface ServicePriceConfig {
  serviceType: "INSURANCE" | "PUC" | "RC" | "LICENCE";
  vehicleType?: "TWO_WHEELER" | "FOUR_WHEELER" | "COMMERCIAL";
  defaultBasePaise: bigint;
}

export const SIMULATED_SERVICE_PRICES: ServicePriceConfig[] = [
  // Insurance
  { serviceType: "INSURANCE", vehicleType: "FOUR_WHEELER", defaultBasePaise: 1_000_000n }, // ₹10,000 (Golden Example)
  { serviceType: "INSURANCE", vehicleType: "TWO_WHEELER", defaultBasePaise: 200_000n },   // ₹2,000
  { serviceType: "INSURANCE", vehicleType: "COMMERCIAL", defaultBasePaise: 1_500_000n },   // ₹15,000

  // PUC
  { serviceType: "PUC", vehicleType: "TWO_WHEELER", defaultBasePaise: 10_000n },           // ₹100
  { serviceType: "PUC", vehicleType: "FOUR_WHEELER", defaultBasePaise: 20_000n },          // ₹200
  { serviceType: "PUC", vehicleType: "COMMERCIAL", defaultBasePaise: 30_000n },            // ₹300

  // RC Renewal
  { serviceType: "RC", vehicleType: "TWO_WHEELER", defaultBasePaise: 50_000n },            // ₹500
  { serviceType: "RC", vehicleType: "FOUR_WHEELER", defaultBasePaise: 100_000n },          // ₹1,000
  { serviceType: "RC", vehicleType: "COMMERCIAL", defaultBasePaise: 250_000n },            // ₹2,500

  // Driving Licence Renewal (no vehicle required)
  { serviceType: "LICENCE", defaultBasePaise: 50_000n }                                    // ₹500
];

/**
 * Returns default base amount in paise for a service and vehicle type.
 */
export function getDefaultBasePaise(
  serviceType: "INSURANCE" | "PUC" | "RC" | "LICENCE",
  vehicleType?: "TWO_WHEELER" | "FOUR_WHEELER" | "COMMERCIAL"
): bigint {
  const match = SIMULATED_SERVICE_PRICES.find(
    (p) => p.serviceType === serviceType && (p.vehicleType === vehicleType || (!p.vehicleType && !vehicleType))
  );
  if (match) {
    return match.defaultBasePaise;
  }
  // Fallback default
  return 100_000n;
}

/**
 * Renewal extension durations per Spec Patch P8:
 * - insurance_expiry +12 months
 * - puc_expiry +6 months
 * - rc_validity_till +5 years
 * - licence expiry +5 years
 * Each extending from the later of today and current expiry.
 */
export const RENEWAL_EXTENSIONS = {
  INSURANCE_MONTHS: 12,
  PUC_MONTHS: 6,
  RC_YEARS: 5,
  LICENCE_YEARS: 5
} as const;

/**
 * Quote expiry duration: 15 minutes (TRD 10.4)
 */
export const QUOTE_TTL_SECONDS = 15 * 60;
