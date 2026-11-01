import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { AppError } from "@vai/shared";
import { getEnv } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

export interface TokenPayload {
  userId: string;
  role: "CITIZEN" | "SUPER_ADMIN" | "OPS" | "ANALYST";
}

export interface StoredRefreshToken {
  tokenHash: string;
  familyId: string;
  userId: string;
  role: "CITIZEN" | "SUPER_ADMIN" | "OPS" | "ANALYST";
  isUsed: boolean;
  expiresAt: Date;
}

export interface RefreshFamily {
  familyId: string;
  userId: string;
  isRevoked: boolean;
  createdAt: Date;
}

// In-memory token store for prototype (P1d)
const tokenStore = new Map<string, StoredRefreshToken>();
const familyStore = new Map<string, RefreshFamily>();

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export class TokenService {
  private readonly jwtSecret: string;
  private readonly accessExpirySeconds = 900; // 15 minutes (TRD 8.3, P10)
  private readonly refreshExpiryDays = 7; // 7 days (TRD 8.3)

  constructor() {
    this.jwtSecret = getEnv().JWT_ACCESS_SECRET;
  }

  /**
   * Generates a signed JWT access token.
   * Carries only userId, role, and expiry; contains no PAN or mobile (TRD 8.3).
   */
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(
      {
        sub: payload.userId,
        role: payload.role
      },
      this.jwtSecret,
      {
        expiresIn: this.accessExpirySeconds,
        algorithm: "HS256"
      }
    );
  }

  /**
   * Verifies and decodes an access token.
   */
  verifyAccessToken(rawToken: string): TokenPayload {
    try {
      const decoded = jwt.verify(rawToken, this.jwtSecret, {
        algorithms: ["HS256"]
      }) as jwt.JwtPayload;

      if (!decoded.sub || !decoded.role) {
        throw new AppError(401, "INVALID_TOKEN", "Malformed access token payload");
      }

      return {
        userId: decoded.sub,
        role: decoded.role as TokenPayload["role"]
      };
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError(401, "TOKEN_EXPIRED", "Access token has expired");
      }
      throw new AppError(401, "INVALID_TOKEN", "Invalid or malformed access token");
    }
  }

  /**
   * Issues a new access token and rotating refresh token pair.
   */
  issueTokenPair(
    userId: string,
    role: TokenPayload["role"] = "CITIZEN",
    existingFamilyId?: string
  ): {
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    familyId: string;
  } {
    const accessToken = this.generateAccessToken({ userId, role });

    const familyId = existingFamilyId ?? crypto.randomUUID();
    if (!familyStore.has(familyId)) {
      familyStore.set(familyId, {
        familyId,
        userId,
        isRevoked: false,
        createdAt: new Date()
      });
    }

    const rawRefreshToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshExpiryDays * 86_400_000);

    tokenStore.set(tokenHash, {
      tokenHash,
      familyId,
      userId,
      role,
      isUsed: false,
      expiresAt
    });

    return {
      accessToken,
      expiresIn: this.accessExpirySeconds,
      refreshToken: rawRefreshToken,
      familyId
    };
  }

  /**
   * Rotates a refresh token with strict reuse detection (TRD 8.3).
   * If a consumed token is reused, revokes the entire family immediately.
   */
  rotateRefreshToken(rawRefreshToken: string): {
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    familyId: string;
  } {
    const tokenHash = hashToken(rawRefreshToken);
    const storedToken = tokenStore.get(tokenHash);

    if (!storedToken) {
      throw new AppError(401, "INVALID_TOKEN", "Invalid refresh token");
    }

    const family = familyStore.get(storedToken.familyId);
    if (!family || family.isRevoked) {
      throw new AppError(401, "SESSION_EXPIRED", "Session has been revoked. Please log in again.");
    }

    if (new Date() > storedToken.expiresAt) {
      tokenStore.delete(tokenHash);
      throw new AppError(401, "TOKEN_EXPIRED", "Refresh token has expired. Please log in again.");
    }

    // Reuse detection: If token was already used, someone copied it!
    // Revoke the entire family immediately (TRD 8.3)
    if (storedToken.isUsed) {
      this.revokeFamily(storedToken.familyId);
      logger.warn(
        { familyId: storedToken.familyId, userId: storedToken.userId },
        "Refresh token reuse detected! Revoked entire token family."
      );
      throw new AppError(401, "TOKEN_REUSE_DETECTED", "Security violation: Refresh token reuse detected. Session terminated.");
    }

    // Mark current token as used
    storedToken.isUsed = true;

    // Issue next token in the same family
    return this.issueTokenPair(storedToken.userId, storedToken.role, storedToken.familyId);
  }

  /**
   * Revokes an entire token family (e.g. on logout or reuse detection).
   */
  revokeFamily(familyId: string): void {
    const family = familyStore.get(familyId);
    if (family) {
      family.isRevoked = true;
    }
  }

  /**
   * Revokes by raw token.
   */
  revokeByRawToken(rawRefreshToken: string): void {
    const tokenHash = hashToken(rawRefreshToken);
    const storedToken = tokenStore.get(tokenHash);
    if (storedToken) {
      this.revokeFamily(storedToken.familyId);
    }
  }

  /**
   * Resets token store (used in tests).
   */
  clearAllTokens(): void {
    tokenStore.clear();
    familyStore.clear();
  }
}

export const tokenService = new TokenService();
