/**
 * Masking utilities for VAI.
 * Masks sensitive attributes such as PAN, driving licence, and phone numbers.
 */

/**
 * Masks a PAN number according to spec patch P2:
 * Masked form = "XXXXXX" + last 4 characters = exactly 10 characters.
 * Example: "DUMMY1001X" -> "XXXXXX001X"
 */
export function maskPan(pan: string): string {
  const cleanPan = pan.trim().toUpperCase();
  if (cleanPan.length < 4) {
    throw new Error("Invalid PAN: length must be at least 4 characters");
  }
  const lastFour = cleanPan.slice(-4);
  return `XXXXXX${lastFour}`;
}

/**
 * Masks a Driving Licence number.
 * Example: "GJ01-20200004417" -> "GJ01-XXXX-4417"
 */
export function maskLicence(licence: string): string {
  const clean = licence.trim();
  if (clean.length < 8) return clean;
  // Keep first 4 and last 4, mask middle
  const prefix = clean.slice(0, 5);
  const suffix = clean.slice(-4);
  return `${prefix}XXXX-${suffix}`;
}

/**
 * Masks a phone number (E.164).
 * Example: "+919000000001" -> "+91 90000 XX001"
 */
export function maskMobile(mobile: string): string {
  const clean = mobile.replace(/\s+/g, "");
  if (clean.length < 10) return clean;
  const last3 = clean.slice(-3);
  const prefix = clean.slice(0, 3); // "+91"
  const mid = clean.slice(3, 8);    // "90000"
  return `${prefix} ${mid} XX${last3}`;
}
