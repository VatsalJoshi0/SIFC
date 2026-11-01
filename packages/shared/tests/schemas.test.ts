import { describe, it, expect } from "vitest";
import {
  RequestOtpSchema,
  VerifyOtpSchema,
  UpdateConsentsSchema,
  CreateQuoteRequestSchema,
  ConfirmTransactionRequestSchema,
  PAN_REGEX
} from "../src/schemas/index.js";

describe("Shared Zod Schemas Validation", () => {
  it("validates P3 Dummy PAN with standard format without 4th-letter restriction", () => {
    // Standard dummy PANs
    expect(PAN_REGEX.test("DUMMY1001X")).toBe(true);
    expect(PAN_REGEX.test("DUMMY1010X")).toBe(true);

    // Rejects invalid formats
    expect(PAN_REGEX.test("DUMMY1001XX")).toBe(false); // too long
    expect(PAN_REGEX.test("DUM1001X")).toBe(false); // too short
    expect(PAN_REGEX.test("12345ABCDE")).toBe(false);
  });

  it("validates RequestOtpSchema successfully for valid inputs", () => {
    const valid = {
      mobile: "+919000000001",
      pan: "dummy1001x" // should be trimmed and uppercased
    };
    const parsed = RequestOtpSchema.parse(valid);
    expect(parsed.pan).toBe("DUMMY1001X");
    expect(parsed.mobile).toBe("+919000000001");
  });

  it("rejects unknown fields in RequestOtpSchema (.strict())", () => {
    const invalid = {
      mobile: "+919000000001",
      pan: "DUMMY1001X",
      extraField: "malicious"
    };
    expect(() => RequestOtpSchema.parse(invalid)).toThrow();
  });

  it("validates VerifyOtpSchema with 6-digit OTP", () => {
    const valid = {
      sessionId: "3f1c9a52-0b7e-4d8e-9a61-2c57e0d4b910",
      otp: "482913"
    };
    expect(VerifyOtpSchema.parse(valid)).toEqual(valid);

    // Rejects non-6-digit OTP
    expect(() => VerifyOtpSchema.parse({ ...valid, otp: "123" })).toThrow();
    expect(() => VerifyOtpSchema.parse({ ...valid, otp: "1234567" })).toThrow();
    expect(() => VerifyOtpSchema.parse({ ...valid, otp: "abcdef" })).toThrow();
  });

  it("validates UpdateConsentsSchema", () => {
    const valid = {
      consents: [
        { purpose: "IDENTITY_VERIFICATION", granted: true },
        { purpose: "SCORING", granted: true }
      ]
    };
    expect(UpdateConsentsSchema.parse(valid)).toEqual(valid);

    // Rejects invalid purpose
    expect(() =>
      UpdateConsentsSchema.parse({
        consents: [{ purpose: "INVALID_PURPOSE", granted: true }]
      })
    ).toThrow();
  });

  it("validates CreateQuoteRequestSchema and ConfirmTransactionRequestSchema", () => {
    const quote = {
      serviceType: "INSURANCE",
      vehicleId: "8a0d2e7c-5f1b-4c3a-b8e9-1d6f7a2c9e44",
      baseAmountPaise: 1000000
    };
    expect(CreateQuoteRequestSchema.parse(quote)).toEqual(quote);

    const confirm = {
      quoteId: "Q-12345",
      simulatedOutcome: "SUCCESS"
    };
    expect(ConfirmTransactionRequestSchema.parse(confirm)).toEqual(confirm);
  });
});
