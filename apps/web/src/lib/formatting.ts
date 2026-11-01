import { formatPaiseToINR } from "@vai/shared";

/**
 * Format paise (BigInt or number) to Rupee string (e.g. ₹9,800.00)
 */
export function formatCurrency(paise: number | bigint): string {
  const bi = typeof paise === "bigint" ? paise : BigInt(Math.round(Number(paise)));
  return formatPaiseToINR(bi);
}

/**
 * Format ISO date string to readable IST date (e.g. "30 Oct 2026")
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Format ISO date string to readable IST date & time
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Format basis points into percentage string (e.g. 200 -> "2.00%")
 */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Format parts per million (e.g. 50 -> "50 ppm (0.005%)")
 */
export function formatPpm(ppm: number): string {
  return `${ppm} ppm (${(ppm / 10000).toFixed(3)}%)`;
}
