/**
 * Stable reason codes and plain-language label mappings per TRD 6.2, 7.3 and US-02.
 */

export const ReasonCode = {
  // Violations (V)
  VIO_LOW: "VIO_LOW",
  VIO_MEDIUM: "VIO_MEDIUM",
  VIO_HIGH: "VIO_HIGH",
  VIO_CAP_REACHED: "VIO_CAP_REACHED",

  // Repeat penalty (RP)
  REPEAT_VIOLATIONS: "REPEAT_VIOLATIONS",

  // Payment behaviour (P)
  PAY_ON_TIME: "PAY_ON_TIME",
  PAY_OVERDUE_UNPAID: "PAY_OVERDUE_UNPAID",

  // Driving discipline / streak (D)
  STREAK_180D: "STREAK_180D",
  STREAK_90D: "STREAK_90D",
  STREAK_30D: "STREAK_30D",
  STREAK_NONE: "STREAK_NONE",

  // Compliance (C)
  VEH_FULL_COMPLY: "VEH_FULL_COMPLY",
  VEH_PARTIAL_COMPLY: "VEH_PARTIAL_COMPLY",
  VEH_EXPIRED_DOCS: "VEH_EXPIRED_DOCS",
  LICENCE_EXPIRED: "LICENCE_EXPIRED",
  LICENCE_VALID: "LICENCE_VALID",

  // Cap adjustment (P6)
  CAP_ADJ_MONTHLY_LIMIT: "CAP_ADJ_MONTHLY_LIMIT",

  // Account initialization
  ACCOUNT_START: "ACCOUNT_START"
} as const;

export type ReasonCodeType = (typeof ReasonCode)[keyof typeof ReasonCode];

export interface ReasonMetadata {
  code: string;
  label: string;
  plainDescription: string;
}

export const REASON_LABEL_MAP: Record<string, { label: string; plainDescription: string }> = {
  [ReasonCode.VIO_LOW]: {
    label: "Minor traffic violation",
    plainDescription: "Minor traffic violation recorded. Impact decays gradually over time."
  },
  [ReasonCode.VIO_MEDIUM]: {
    label: "Moderate traffic violation",
    plainDescription: "Moderate traffic violation (e.g. jumping signal). Impact decays over 12 months."
  },
  [ReasonCode.VIO_HIGH]: {
    label: "Serious traffic violation",
    plainDescription: "Major violation recorded. Penalty decreases over a 365-day half-life."
  },
  [ReasonCode.VIO_CAP_REACHED]: {
    label: "Violation penalty limit applied",
    plainDescription: "Total violation deductions are capped at -150 to keep recovery achievable."
  },
  [ReasonCode.REPEAT_VIOLATIONS]: {
    label: "Repeated violations penalty",
    plainDescription: "Deduction for committing the same violation category multiple times within a year."
  },
  [ReasonCode.PAY_ON_TIME]: {
    label: "Challan paid on time",
    plainDescription: "Reward points earned for settling your traffic challan by the due date."
  },
  [ReasonCode.PAY_OVERDUE_UNPAID]: {
    label: "Overdue unpaid challan",
    plainDescription: "Deduction for an unpaid challan past its 60-day due date."
  },
  [ReasonCode.STREAK_180D]: {
    label: "180+ days clean driving streak",
    plainDescription: "Maximum driving discipline reward for maintaining 6 months violation-free."
  },
  [ReasonCode.STREAK_90D]: {
    label: "90+ days clean driving streak",
    plainDescription: "Driving discipline reward for maintaining 3 months without any violations."
  },
  [ReasonCode.STREAK_30D]: {
    label: "30+ days clean driving streak",
    plainDescription: "Starting discipline reward for reaching your first 30 days without violations."
  },
  [ReasonCode.STREAK_NONE]: {
    label: "Recent violation",
    plainDescription: "Streak reset due to recent violation. Keep driving clean to reach 30 days."
  },
  [ReasonCode.VEH_FULL_COMPLY]: {
    label: "All vehicle documents valid",
    plainDescription: "All documents (Insurance, PUC, RC) on your vehicles are completely up to date."
  },
  [ReasonCode.VEH_PARTIAL_COMPLY]: {
    label: "Vehicle documents partially valid",
    plainDescription: "Some documents are valid across your vehicles."
  },
  [ReasonCode.VEH_EXPIRED_DOCS]: {
    label: "Vehicle document expired",
    plainDescription: "Deduction for one or more expired documents (Insurance, PUC, or RC)."
  },
  [ReasonCode.LICENCE_EXPIRED]: {
    label: "Driving licence expired",
    plainDescription: "Important deduction: your driving licence is past its expiration date."
  },
  [ReasonCode.LICENCE_VALID]: {
    label: "Driving licence valid",
    plainDescription: "Your driving licence is valid and active."
  },
  [ReasonCode.CAP_ADJ_MONTHLY_LIMIT]: {
    label: "Monthly score movement cap",
    plainDescription: "Score change smoothed to 50 points per month to prevent sudden swings."
  },
  [ReasonCode.ACCOUNT_START]: {
    label: "Initial account creation",
    plainDescription: "Welcome to VAI! All new accounts begin with a baseline score of 700."
  }
};

/**
 * Returns plain-language label and description for a given reason code.
 */
export function getReasonMetadata(code: string): ReasonMetadata {
  const found = REASON_LABEL_MAP[code];
  if (found) {
    return { code, label: found.label, plainDescription: found.plainDescription };
  }
  return {
    code,
    label: code.replace(/_/g, " "),
    plainDescription: "Score adjustment recorded in your ledger."
  };
}
