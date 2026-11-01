import crypto from "node:crypto";
import { getEnv } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Derives a 32-byte Buffer key from the PAN_ENCRYPTION_KEY config.
 */
function getEncryptionKey(): Buffer {
  const rawKey = getEnv().PAN_ENCRYPTION_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }
  // Otherwise hash it to ensure a 32-byte key
  return crypto.createHash("sha256").update(rawKey).digest();
}

/**
 * Encrypts a plaintext string (e.g. PAN) using AES-256-GCM.
 * Output format: Base64 string composed of [12-byte IV][16-byte Auth Tag][Ciphertext].
 */
export function encryptPan(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine IV (12) + Tag (16) + Encrypted
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypts an AES-256-GCM encrypted string back to plaintext.
 */
export function decryptPan(encryptedBase64: string): string {
  const combined = Buffer.from(encryptedBase64, "base64");
  if (combined.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Ciphertext too short: corrupted or invalid payload");
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Computes deterministic HMAC-SHA256 hash of a normalized PAN for indexed lookup.
 * Always normalizes PAN to trimmed uppercase before hashing.
 */
export function hashPan(pan: string): string {
  const normalized = pan.trim().toUpperCase();
  const hmacKey = getEnv().PAN_HMAC_KEY;
  return crypto.createHmac("sha256", hmacKey).update(normalized).digest("hex");
}

/**
 * Computes deterministic HMAC-SHA256 hash of an OTP for secure in-session verification.
 */
export function hashOtp(otp: string): string {
  const hmacKey = getEnv().OTP_HMAC_KEY;
  return crypto.createHmac("sha256", hmacKey).update(otp.trim()).digest("hex");
}

/**
 * Computes deterministic HMAC-SHA256 hash of a normalized mobile number for session tracking.
 */
export function hashMobile(mobile: string): string {
  const normalized = mobile.trim();
  const hmacKey = getEnv().PAN_HMAC_KEY;
  return crypto.createHmac("sha256", hmacKey).update(normalized).digest("hex");
}

/**
 * Constant-time comparison between two hashes to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
