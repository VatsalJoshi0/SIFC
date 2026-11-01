import { describe, it, expect } from "vitest";
import { diffCalendarDays, isDocumentValid, formatToIST } from "../src/dates.js";

describe("Dates & Timezone Handling", () => {
  it("calculates exact calendar day difference", () => {
    // 2026-10-30 - 2024-03-14 = 960 days (2024 was leap year)
    expect(diffCalendarDays("2024-03-14", "2026-10-30")).toBe(960);
    expect(diffCalendarDays("2026-10-01", "2026-10-30")).toBe(29);
    expect(diffCalendarDays("2026-10-30", "2026-10-30")).toBe(0);
    expect(diffCalendarDays("2026-10-30", "2026-10-20")).toBe(-10);
  });

  it("checks document validity correctly against asOf date", () => {
    const asOf = "2026-10-30";
    expect(isDocumentValid("2026-11-01", asOf)).toBe(true);
    expect(isDocumentValid("2026-10-30", asOf)).toBe(true);
    expect(isDocumentValid("2026-10-29", asOf)).toBe(false);
    expect(isDocumentValid(null, asOf)).toBe(false);
    expect(isDocumentValid(undefined, asOf)).toBe(false);
  });

  it("formats dates in IST (Asia/Kolkata)", () => {
    const formatted = formatToIST("2026-10-30T02:00:00Z", true);
    // 02:00 UTC = 07:30 IST
    expect(formatted).toContain("2026");
    expect(formatted).toContain("07:30");
  });
});
