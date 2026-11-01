import crypto from "node:crypto";
import { AppError } from "@vai/shared";
import { prisma } from "../../db/client.js";
import { hashMobile, hashPan, timingSafeEqual, encryptPan } from "../../lib/crypto.js";
import { maskPan } from "@vai/shared";
import { tokenService } from "./token.service.js";
import { logger } from "../../lib/logger.js";

// In-memory rate limiting tracker for OTP requests (TRD 8.2)
// mobileHash -> Array of request timestamps
const otpRateLimitMap = new Map<string, number[]>();

export class OtpService {
  private readonly otpExpirySeconds = 300; // 5 minutes (TRD 8.1)
  private readonly cooldownSeconds = 30; // 30 seconds (TRD 8.1)
  private readonly maxRequestsPerWindow = 3; // 3 requests (TRD 8.2)
  private readonly rateLimitWindowMs = 10 * 60 * 1000; // 10 minutes (TRD 8.2)

  /**
   * Generates a 6-digit CSPRNG OTP and creates an OTP session.
   * Returns identical response for known and unknown users (TRD 8.1).
   */
  async requestOtp(
    mobileE164: string,
    pan: string
  ): Promise<{
    sessionId: string;
    expiresIn: number;
    cooldownSeconds: number;
    simulatedOtp?: string;
  }> {
    const normalizedMobile = mobileE164.trim();
    const normalizedPan = pan.trim().toUpperCase();

    // 1. Validate formats
    if (!/^\+91[6-9]\d{9}$/.test(normalizedMobile)) {
      throw new AppError(400, "INVALID_MOBILE", "Invalid mobile number format. Expected E.164 (+91XXXXXXXXXX)");
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizedPan)) {
      throw new AppError(400, "INVALID_PAN", "Invalid PAN format. Expected 5 letters, 4 digits, 1 letter");
    }

    const mobileH = hashMobile(normalizedMobile);
    const now = Date.now();

    // 2. Check rate limit per mobile (TRD 8.2)
    const timestamps = otpRateLimitMap.get(mobileH) ?? [];
    const recent = timestamps.filter((t) => now - t < this.rateLimitWindowMs);

    // Cooldown check (30s)
    if (recent.length > 0) {
      const lastRequest = recent[recent.length - 1]!;
      const elapsedSeconds = Math.floor((now - lastRequest) / 1000);
      if (elapsedSeconds < this.cooldownSeconds) {
        throw new AppError(
          429,
          "OTP_COOLDOWN",
          `Please wait ${this.cooldownSeconds - elapsedSeconds} seconds before requesting a new OTP.`,
          { retryAfterSeconds: this.cooldownSeconds - elapsedSeconds }
        );
      }
    }

    // Max limit check (3 per 10m)
    if (recent.length >= this.maxRequestsPerWindow) {
      throw new AppError(
        429,
        "OTP_RATE_LIMIT",
        "Maximum OTP request limit reached. Please try again in 10 minutes.",
        { retryAfterSeconds: Math.ceil((this.rateLimitWindowMs - (now - recent[0]!)) / 1000) }
      );
    }

    // 3. Generate 6-digit CSPRNG OTP
    const otp = crypto.randomInt(100_000, 1_000_000).toString();
    const otpHash = crypto.createHmac("sha256", "VAI_OTP_SALT").update(otp).digest("hex");
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(now + this.otpExpirySeconds * 1000);

    // 4. Save session in otp_sessions table
    await prisma.otpSession.create({
      data: {
        sessionId,
        mobileHash: mobileH,
        otpHash,
        expiresAt,
        attempts: 0
      }
    });

    // Record timestamp for rate limiting
    recent.push(now);
    otpRateLimitMap.set(mobileH, recent);

    logger.info({ sessionId, mobileMasked: normalizedMobile.slice(0, 3) + "***" }, "Generated simulated OTP");

    // Return simulated OTP in non-production mode for easy test verification
    const simulatedOtp = process.env.NODE_ENV !== "production" ? otp : undefined;

    return {
      sessionId,
      expiresIn: this.otpExpirySeconds,
      cooldownSeconds: this.cooldownSeconds,
      simulatedOtp
    };
  }

  /**
   * Verifies OTP in constant time, increments attempts, and issues auth tokens.
   */
  async verifyOtp(
    sessionId: string,
    otp: string
  ): Promise<{
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    user: {
      userId: string;
      fullName: string;
      panMasked: string;
      vehicleCount: number;
    };
  }> {
    if (!/^\d{6}$/.test(otp.trim())) {
      throw new AppError(400, "INVALID_OTP_FORMAT", "OTP must be a 6-digit number");
    }

    // 1. Fetch OTP session
    const session = await prisma.otpSession.findUnique({
      where: { sessionId }
    });

    if (!session || session.consumedAt !== null || new Date() > session.expiresAt) {
      throw new AppError(400, "OTP_EXPIRED", "OTP session has expired or is invalid. Please request a new OTP.");
    }

    if (session.attempts >= 3) {
      // Invalidate session
      await prisma.otpSession.update({
        where: { sessionId },
        data: { consumedAt: new Date() }
      });
      throw new AppError(400, "OTP_ATTEMPTS_EXCEEDED", "Maximum verification attempts exceeded. Session invalidated.");
    }

    // 2. Constant-time OTP comparison
    const candidateHash = crypto.createHmac("sha256", "VAI_OTP_SALT").update(otp.trim()).digest("hex");
    const isMatch = timingSafeEqual(candidateHash, session.otpHash);

    if (!isMatch) {
      const nextAttempts = session.attempts + 1;
      const consumedAt = nextAttempts >= 3 ? new Date() : null;

      await prisma.otpSession.update({
        where: { sessionId },
        data: {
          attempts: nextAttempts,
          consumedAt
        }
      });

      const remaining = 3 - nextAttempts;
      throw new AppError(
        400,
        "OTP_INVALID",
        remaining > 0
          ? `Incorrect OTP. You have ${remaining} attempt(s) remaining.`
          : "Incorrect OTP. Maximum verification attempts exceeded.",
        { remainingAttempts: remaining }
      );
    }

    // 3. Mark session consumed
    await prisma.otpSession.update({
      where: { sessionId },
      data: { consumedAt: new Date() }
    });

    // 4. Resolve user by matching mobileHash
    const allUsers = await prisma.user.findMany();
    let user = allUsers.find((u) => hashMobile(u.mobileE164) === session.mobileHash) ?? null;

    if (!user) {
      // Auto-create new dummy profile for demonstration
      const demoPan = "DUMMY9999Z";
      const dummyId = `U${crypto.randomInt(100, 999)}`;
      user = await prisma.user.create({
        data: {
          userId: dummyId,
          fullName: "New Demo Citizen",
          mobileE164: "+919999999999",
          panEncrypted: encryptPan(demoPan),
          panHash: hashPan(demoPan),
          panMasked: maskPan(demoPan),
          city: "New Delhi",
          state: "Delhi",
          registrationDate: new Date(),
          status: "ACTIVE",
          isDummy: true
        }
      });
    }

    // Count vehicles
    const vehicleCount = await prisma.vehicle.count({
      where: { userId: user.userId }
    });

    // 5. Issue token pair
    const tokenPair = tokenService.issueTokenPair(user.userId, "CITIZEN");

    return {
      accessToken: tokenPair.accessToken,
      expiresIn: tokenPair.expiresIn,
      refreshToken: tokenPair.refreshToken,
      user: {
        userId: user.userId,
        fullName: user.fullName,
        panMasked: user.panMasked,
        vehicleCount
      }
    };
  }

  /**
   * Resets OTP rate limits (used in test teardown).
   */
  clearRateLimits(): void {
    otpRateLimitMap.clear();
  }
}

export const otpService = new OtpService();
