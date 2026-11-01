import { describe, it, expect } from "vitest";
import { encryptPan, decryptPan, hashPan, hashOtp, timingSafeEqual } from "../src/lib/crypto.js";

describe("Crypto Module (AES-256-GCM and HMAC-SHA256)", () => {
  it("encrypts and decrypts a PAN successfully", () => {
    const rawPan = "DUMMY1001X";
    const encrypted = encryptPan(rawPan);

    expect(encrypted).not.toBe(rawPan);
    // Base64 string
    expect(typeof encrypted).toBe("string");

    const decrypted = decryptPan(encrypted);
    expect(decrypted).toBe(rawPan);
  });

  it("produces distinct ciphertexts for identical plaintext due to random IV", () => {
    const rawPan = "DUMMY1001X";
    const enc1 = encryptPan(rawPan);
    const enc2 = encryptPan(rawPan);

    expect(enc1).not.toBe(enc2);
    expect(decryptPan(enc1)).toBe(rawPan);
    expect(decryptPan(enc2)).toBe(rawPan);
  });

  it("fails decryption when ciphertext is tampered with", () => {
    const rawPan = "DUMMY1001X";
    const encrypted = encryptPan(rawPan);
    // Tamper with the base64 string
    const buf = Buffer.from(encrypted, "base64");
    buf[buf.length - 1] ^= 1; // Flip one bit
    const tampered = buf.toString("base64");

    expect(() => decryptPan(tampered)).toThrow();
  });

  it("computes deterministic HMAC-SHA256 lookup hash for PAN", () => {
    const pan1 = "DUMMY1001X";
    const pan2 = "dummy1001x"; // Case-insensitive normalization
    const pan3 = " DUMMY1001X "; // Trimming normalization

    const hash1 = hashPan(pan1);
    const hash2 = hashPan(pan2);
    const hash3 = hashPan(pan3);

    expect(hash1).toBe(hash2);
    expect(hash1).toBe(hash3);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });

  it("hashes OTP consistently and compares with timingSafeEqual", () => {
    const otp = "482913";
    const hash = hashOtp(otp);

    expect(hash).toHaveLength(64);
    expect(timingSafeEqual(hash, hashOtp("482913"))).toBe(true);
    expect(timingSafeEqual(hash, hashOtp("123456"))).toBe(false);
  });
});
