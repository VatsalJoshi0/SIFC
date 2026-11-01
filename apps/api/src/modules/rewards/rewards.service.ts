import crypto from "node:crypto";
import { prisma } from "../../db/client.js";
import { configRepository } from "../../repositories/config.repository.js";
import {
  calculateDiscountPaise,
  calculatePlatformFeePaise,
  paiseToSafeNumber,
  AppError
} from "@vai/shared";
import { getDefaultBasePaise, QUOTE_TTL_SECONDS } from "../../config/services.js";
import { quoteStore, type LockedQuote } from "./quote.store.js";

export interface QuoteRequestInput {
  serviceType: "INSURANCE" | "PUC" | "RC" | "LICENCE";
  vehicleId?: string | null;
  licenceId?: string | null;
  baseAmountPaise?: number;
}

export interface QuoteResponseOutput {
  vaiCategory: string;
  discountBps: number;
  breakdown: {
    originalAmountPaise: number;
    discountPaise: number;
    govtFundedPaise: number;
    payablePaise: number;
  };
  platformFee: {
    optionCode: string;
    ppm: number;
    feePaise: number;
    chargedTo: "PROVIDER" | "USER";
  };
  quoteId: string;
  quoteExpiresAt: string;
}

export class RewardsService {
  /**
   * Resolves category directly from latest score in database (TRD 10.1).
   */
  async resolveUserCategory(userId: string): Promise<"FAIR" | "GOOD" | "VERY_GOOD"> {
    const scoreRecord = await prisma.vaiScore.findUnique({
      where: { userId }
    });

    if (!scoreRecord) {
      return "GOOD"; // Default baseline 700
    }

    const score = scoreRecord.score;
    if (score >= 750) return "VERY_GOOD";
    if (score >= 650) return "GOOD";
    return "FAIR";
  }

  /**
   * Generates a 15-minute price-locked quote for a service (TRD 7.4, TRD 10, TRD 11).
   */
  async generateQuote(userId: string, input: QuoteRequestInput): Promise<QuoteResponseOutput> {
    const { serviceType } = input;
    let vehicleId = input.vehicleId ?? null;
    let licenceId = input.licenceId ?? null;
    let vehicleType: "TWO_WHEELER" | "FOUR_WHEELER" | "COMMERCIAL" | undefined;

    // 1. Validate vehicle ownership if vehicleId is provided or required
    if (serviceType === "INSURANCE" || serviceType === "PUC" || serviceType === "RC") {
      if (!vehicleId) {
        // If not provided, check if user has a vehicle
        const userVehicles = await prisma.vehicle.findMany({
          where: { userId }
        });
        if (userVehicles.length === 1) {
          vehicleId = userVehicles[0].vehicleId;
          vehicleType = userVehicles[0].vehicleType as "TWO_WHEELER" | "FOUR_WHEELER" | "COMMERCIAL";
        } else if (userVehicles.length === 0) {
          throw new AppError(404, "NOT_FOUND", "No vehicle registered to citizen");
        } else {
          throw new AppError(400, "VALIDATION_FAILED", "vehicleId is required for this service");
        }
      } else {
        const vehicle = await prisma.vehicle.findUnique({
          where: { vehicleId }
        });
        if (!vehicle || vehicle.userId !== userId) {
          throw new AppError(404, "NOT_FOUND", "Vehicle not found or not owned by user");
        }
        vehicleType = vehicle.vehicleType as "TWO_WHEELER" | "FOUR_WHEELER" | "COMMERCIAL";
      }
    }

    // 2. Validate licence ownership if licenceId is provided or required
    if (serviceType === "LICENCE") {
      if (!licenceId) {
        const userLicence = await prisma.licence.findFirst({
          where: { userId }
        });
        if (!userLicence) {
          throw new AppError(404, "NOT_FOUND", "No licence registered to citizen");
        }
        licenceId = userLicence.licenceId;
      } else {
        const licence = await prisma.licence.findUnique({
          where: { licenceId }
        });
        if (!licence || licence.userId !== userId) {
          throw new AppError(404, "NOT_FOUND", "Licence not found or not owned by user");
        }
      }
    }

    // 3. Resolve base amount in paise
    const baseAmountPaise = input.baseAmountPaise !== undefined
      ? BigInt(input.baseAmountPaise)
      : getDefaultBasePaise(serviceType, vehicleType);

    // 4. Resolve category from latest score (TRD 10.1)
    const vaiCategory = await this.resolveUserCategory(userId);

    // 5. Lookup discount bps (TRD 10.2)
    const rewardConfig = await configRepository.getRewardDiscount(vaiCategory, serviceType);
    let discountBps = rewardConfig ? rewardConfig.discountBps : 0;
    if (vaiCategory === "FAIR") {
      discountBps = 0; // TRD 10.4: FAIR category discount is zero
    }

    // 6. Compute discount and payable
    const discountPaise = calculateDiscountPaise(baseAmountPaise, discountBps);
    const govtFundedPaise = discountPaise; // Prototype: sponsor funds 100% of discount
    const payablePaise = baseAmountPaise - discountPaise;

    // 7. Lookup active fee config (Option A: 50 ppm, Option B: 100 ppm)
    const activeFeeConfig = await configRepository.getActiveFeeConfig();
    const optionCode = activeFeeConfig?.optionCode ?? "A";
    const ppm = activeFeeConfig?.ppm ?? 50;
    const feeMode = (activeFeeConfig?.mode as "PROVIDER_PAYS" | "PASS_THROUGH") ?? "PROVIDER_PAYS";
    const platformFeePaise = calculatePlatformFeePaise(baseAmountPaise, ppm);

    // 8. Compute user total and settlement to provider (TRD 11.2, Spec Patch P7)
    let userTotalPaise: bigint;
    let settlementToProviderPaise: bigint;

    if (feeMode === "PROVIDER_PAYS") {
      userTotalPaise = payablePaise;
      settlementToProviderPaise = baseAmountPaise - discountPaise - platformFeePaise;
    } else {
      userTotalPaise = payablePaise + platformFeePaise;
      settlementToProviderPaise = baseAmountPaise - discountPaise;
    }

    // 9. Lookup active service provider
    const provider = await prisma.serviceProvider.findFirst({
      where: { serviceType, isActive: true }
    });

    if (!provider) {
      throw new AppError(500, "INTERNAL_ERROR", `No active provider found for service ${serviceType}`);
    }

    // 10. Create 15-minute locked quote (TRD 10.4)
    const quoteId = `Q-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const createdAt = new Date();
    const quoteExpiresAt = new Date(createdAt.getTime() + QUOTE_TTL_SECONDS * 1000);

    const lockedQuote: LockedQuote = {
      quoteId,
      userId,
      serviceType,
      vehicleId,
      licenceId,
      providerId: provider.providerId,
      vaiCategory,
      baseAmountPaise,
      discountBps,
      discountPaise,
      govtFundedPaise,
      payablePaise,
      platformFeeOptionCode: optionCode,
      platformFeePpm: ppm,
      platformFeePaise,
      feeMode,
      userTotalPaise,
      settlementToProviderPaise,
      quoteExpiresAt,
      createdAt
    };

    quoteStore.saveQuote(lockedQuote);

    return {
      vaiCategory,
      discountBps,
      breakdown: {
        originalAmountPaise: paiseToSafeNumber(baseAmountPaise),
        discountPaise: paiseToSafeNumber(discountPaise),
        govtFundedPaise: paiseToSafeNumber(govtFundedPaise),
        payablePaise: paiseToSafeNumber(payablePaise)
      },
      platformFee: {
        optionCode,
        ppm,
        feePaise: paiseToSafeNumber(platformFeePaise),
        chargedTo: feeMode === "PROVIDER_PAYS" ? "PROVIDER" : "USER"
      },
      quoteId,
      quoteExpiresAt: quoteExpiresAt.toISOString()
    };
  }
}

export const rewardsService = new RewardsService();
