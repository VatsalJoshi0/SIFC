import { z } from "zod";

/**
 * Common regex constants
 */
// P3: Dummy PAN matches standard pattern without 4th-letter type check
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
// E.164 format: e.g. +919000000001
export const E164_MOBILE_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * Authentication schemas
 */
export const RequestOtpSchema = z.object({
  mobile: z.string().regex(E164_MOBILE_REGEX, "Invalid mobile number. Must be in E.164 format (e.g. +919000000001)"),
  pan: z.string().trim().toUpperCase().regex(PAN_REGEX, "Invalid PAN format. Must be 5 letters, 4 digits, 1 letter")
}).strict();

export const VerifyOtpSchema = z.object({
  sessionId: z.string().uuid("Invalid sessionId format"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits")
}).strict();

export const AdminLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  secondFactorCode: z.string().regex(/^\d{6}$/, "Second factor code must be 6 digits").optional()
}).strict();

/**
 * Consent schemas (P7, TRD 12.4)
 */
export const ConsentPurposeEnum = z.enum([
  "IDENTITY_VERIFICATION",
  "VEHICLE_DATA",
  "CHALLAN_DATA",
  "SCORING",
  "PARTNER_OFFERS"
]);

export const ConsentItemSchema = z.object({
  purpose: ConsentPurposeEnum,
  granted: z.boolean()
});

export const UpdateConsentsSchema = z.object({
  consents: z.array(ConsentItemSchema).min(1, "At least one consent purpose required")
}).strict();

/**
 * Domain Enums & Schemas
 */
export const VehicleTypeEnum = z.enum(["TWO_WHEELER", "FOUR_WHEELER", "COMMERCIAL"]);
export const ChallanSeverityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const ChallanStatusEnum = z.enum(["PAID", "UNPAID", "PENDING", "DISPUTED", "WAIVED"]);
export const VaiCategoryEnum = z.enum(["FAIR", "GOOD", "VERY_GOOD"]);
export const ServiceTypeEnum = z.enum(["INSURANCE", "PUC", "RC", "LICENCE"]);
export const FeeModeEnum = z.enum(["PROVIDER_PAYS", "PASS_THROUGH"]);
export const FeeOptionCodeEnum = z.enum(["A", "B"]);

export const TransactionStatusEnum = z.enum([
  "CREATED",
  "VALIDATED",
  "PAYMENT_PENDING",
  "SUCCESS",
  "FAILED",
  "TIMED_OUT",
  "REFUNDED"
]);

export const AdminRoleEnum = z.enum(["SUPER_ADMIN", "OPS", "ANALYST"]);

/**
 * Service & Quote Schemas
 */
export const CreateQuoteRequestSchema = z.object({
  serviceType: ServiceTypeEnum,
  vehicleId: z.string().min(1, "vehicleId must be a non-empty string").optional().nullable(),
  licenceId: z.string().min(1, "licenceId must be a non-empty string").optional().nullable(),
  baseAmountPaise: z.number().int().positive("Base amount must be positive integer paise").optional()
}).strict();

export const ConfirmTransactionRequestSchema = z.object({
  quoteId: z.string().min(1, "quoteId is required"),
  simulatedOutcome: z.enum(["SUCCESS", "FAILURE", "TIMEOUT"]).default("SUCCESS")
}).strict();

/**
 * Dispute Schemas (P7)
 */
export const CreateDisputeSchema = z.object({
  note: z.string().min(5, "Dispute note must be at least 5 characters").max(500)
}).strict();

export const ResolveDisputeSchema = z.object({
  outcome: z.enum(["UPHELD", "REJECTED"]),
  note: z.string().max(500).optional()
}).strict();

/**
 * Refund Schema (P7)
 */
export const CreateRefundSchema = z.object({
  amountPaise: z.number().int().positive("Refund amount must be positive paise"),
  reasonCode: z.string().min(3).max(50)
}).strict();

/**
 * Admin Config Management Schemas (TRD 5.3, FR-M2)
 */
export const AdminScoringConfigSchema = z.object({
  parameters: z.record(z.unknown()),
  effectiveFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  changeReason: z.string().min(5, "Change reason must be at least 5 characters").max(500)
}).strict();

export const AdminRewardConfigItemSchema = z.object({
  vaiCategory: VaiCategoryEnum,
  serviceType: ServiceTypeEnum,
  discountBps: z.number().int().min(0).max(10000),
  effectiveFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
}).strict();

export const AdminUpdateRewardsSchema = z.object({
  configs: z.array(AdminRewardConfigItemSchema).min(1, "At least one reward config item required")
}).strict();

export const AdminFeeConfigSchema = z.object({
  optionCode: z.enum(["A", "B"]),
  ppm: z.number().int().positive("PPM must be a positive integer"),
  mode: FeeModeEnum,
  effectiveFrom: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional()
}).strict();

export const AdminReconcileTransactionSchema = z.object({
  outcome: z.enum(["SUCCESS", "FAILED"]),
  note: z.string().max(500).optional()
}).strict();
