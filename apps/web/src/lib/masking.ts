import { maskPan, maskMobile } from "@vai/shared";

export { maskPan, maskMobile };
export const maskPAN = maskPan;

/**
 * Mask driving licence number (e.g. GJ0120220004417 -> GJ01-XXXX-4417)
 */
export function maskLicence(licenceNo: string): string {
  if (!licenceNo) return "";
  if (licenceNo.includes("XXXX")) return licenceNo;
  if (licenceNo.length <= 8) return licenceNo;
  const prefix = licenceNo.slice(0, 4);
  const suffix = licenceNo.slice(-4);
  return `${prefix}-XXXX-${suffix}`;
}
