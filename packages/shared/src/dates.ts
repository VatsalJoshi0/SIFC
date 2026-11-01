/**
 * Date and timezone handling utilities for VAI.
 * All timestamps stored in UTC ISO 8601; formatted/displayed in Asia/Kolkata (IST).
 * Integer calendar day arithmetic is used for streaks and age calculations.
 */

export const IST_TIMEZONE = "Asia/Kolkata";
export const SEED_DATE_STR = "2026-10-30";

/**
 * Parses an ISO date or YYYY-MM-DD string into integer year, month (1-12), and day
 * in the context of Asia/Kolkata or UTC date string.
 */
export function parseDateOnly(dateInput: string | Date): { year: number; month: number; day: number } {
  if (typeof dateInput === "string") {
    // If format is YYYY-MM-DD
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10)
      };
    }
  }

  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  // Format as YYYY-MM-DD in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const [yearStr, monthStr, dayStr] = formatter.format(d).split("-");
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    day: parseInt(dayStr, 10)
  };
}

/**
 * Calculates calendar days between two dates (to - from).
 * Uses UTC date values to prevent daylight saving / timezone distortion.
 * If to is after from, returns a positive integer.
 */
export function diffCalendarDays(from: string | Date, to: string | Date): number {
  const pFrom = parseDateOnly(from);
  const pTo = parseDateOnly(to);

  const utcFrom = Date.UTC(pFrom.year, pFrom.month - 1, pFrom.day);
  const utcTo = Date.UTC(pTo.year, pTo.month - 1, pTo.day);

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((utcTo - utcFrom) / msPerDay);
}

/**
 * Formats a Date or ISO string into human-readable IST display string.
 * Example: "30 Oct 2026, 02:00 IST"
 */
export function formatToIST(date: string | Date, includeTime = true): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Invalid Date";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: IST_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric"
  };

  if (includeTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
    options.hour12 = false;
  }

  return new Intl.DateTimeFormat("en-IN", options).format(d);
}

/**
 * Checks whether a given expiry date (YYYY-MM-DD or Date) is valid as of evaluation date.
 * An item is valid if expiryDate >= asOfDate. Null or undefined expiry is considered expired.
 */
export function isDocumentValid(expiryDate: string | Date | null | undefined, asOf: string | Date): boolean {
  if (!expiryDate) return false;
  return diffCalendarDays(asOf, expiryDate) >= 0;
}
