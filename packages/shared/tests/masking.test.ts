import { describe, it, expect } from "vitest";
import { maskPan, maskLicence, maskMobile } from "../src/masking.js";

describe("Masking (Golden Test G5)", () => {
  it("G5: PAN Masking (DUMMY1001X -> XXXXXX001X, exactly 10 characters)", () => {
    const masked = maskPan("DUMMY1001X");
    expect(masked).toBe("XXXXXX001X");
    expect(masked.length).toBe(10);
  });

  it("masks all dummy profile PANs consistently", () => {
    for (let i = 1; i <= 10; i++) {
      const numStr = i === 10 ? "1010" : `100${i}`;
      const pan = `DUMMY${numStr}X`;
      const expected = `XXXXXX${numStr.slice(-3)}X`;
      expect(maskPan(pan)).toBe(expected);
      expect(maskPan(pan).length).toBe(10);
    }
  });

  it("masks Driving Licence numbers", () => {
    expect(maskLicence("GJ01-20200004417")).toBe("GJ01-XXXX-4417");
  });

  it("masks E.164 mobile numbers", () => {
    expect(maskMobile("+919000000001")).toBe("+91 90000 XX001");
  });
});
