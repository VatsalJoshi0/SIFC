import { useSessionStore } from "../features/auth/sessionStore";

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;

  constructor(message: string, code: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

const BASE_URL = "http://127.0.0.1:3001/api/v1";

async function request<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = useSessionStore.getState().accessToken;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include", // for HttpOnly refresh cookie
  });

  // Handle 401 token refresh retry
  if (response.status === 401 && !isRetry && !path.startsWith("/auth/")) {
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        useSessionStore.getState().setAccessToken(refreshData.accessToken);
        return request<T>(path, options, true);
      }
    } catch {
      // refresh failed
    }
    useSessionStore.getState().clearSession();
  }

  // Handle PDF or blob downloads if requested
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/pdf")) {
    const blob = await response.blob();
    return blob as unknown as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = data.error || {};
    throw new ApiError(
      err.message || "An unexpected error occurred",
      err.code || "INTERNAL_ERROR",
      response.status,
      err.details
    );
  }

  return data as T;
}

export const api = {
  auth: {
    requestOtp: (mobile: string, pan: string) =>
      request<{ sessionId: string; expiresAt: string; message: string; simulatedOtp?: string }>(
        "/auth/otp/request",
        {
          method: "POST",
          body: JSON.stringify({ mobile, pan }),
        }
      ),
    verifyOtp: (sessionId: string, otp: string) =>
      request<{
        accessToken: string;
        expiresIn: number;
        user: {
          userId: string;
          fullName: string;
          panMasked: string;
          vehicleCount: number;
        };
      }>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ sessionId, otp }),
      }),
    refresh: () =>
      request<{ accessToken: string; expiresIn: number }>("/auth/refresh", {
        method: "POST",
      }),
    logout: () =>
      request<{ message: string }>("/auth/logout", {
        method: "POST",
      }),
  },

  consents: {
    getConsents: () =>
      request<{
        consents: Array<{
          consentId: string;
          purpose: string;
          granted: boolean;
          capturedAt: string;
          withdrawnAt: string | null;
        }>;
      }>("/users/me/consents"),
    updateConsents: (consents: Array<{ purpose: string; granted: boolean }>) =>
      request<{ message: string; consents: Array<unknown> }>("/users/me/consents", {
        method: "PUT",
        body: JSON.stringify({ consents }),
      }),
  },

  users: {
    getMe: () =>
      request<{
        userId: string;
        fullName: string;
        panMasked: string;
        mobileMasked: string;
        city: string;
        state: string;
        registrationDate: string;
        status: string;
        vehicleCount: number;
        vaiScore: {
          score: number;
          category: string;
        } | null;
        licence: {
          licenceNoMasked: string;
          licenceClass: string;
          expiryDate: string;
        } | null;
      }>("/users/me"),
  },

  vehicles: {
    getVehicles: () =>
      request<{
        vehicles: Array<{
          vehicleId: string;
          registrationNo: string;
          vehicleType: string;
          manufacturer: string;
          model: string;
          registrationDate: string;
          insuranceExpiry: string | null;
          pucExpiry: string | null;
          rcValidityTill: string;
          compliance: {
            insuranceValid: boolean;
            pucValid: boolean;
            rcValid: boolean;
            fullyCompliant: boolean;
          };
        }>;
      }>("/users/me/vehicles"),
    getVehicle: (regNo: string) =>
      request<{
        vehicle: {
          vehicleId: string;
          registrationNo: string;
          vehicleType: string;
          manufacturer: string;
          model: string;
          registrationDate: string;
          insuranceExpiry: string | null;
          pucExpiry: string | null;
          rcValidityTill: string;
          compliance: {
            insuranceValid: boolean;
            pucValid: boolean;
            rcValid: boolean;
            fullyCompliant: boolean;
          };
        };
      }>(`/vehicles/${regNo}`),
    getVehicleChallans: (regNo: string, params?: { status?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.append("status", params.status);
      if (params?.limit) q.append("limit", params.limit.toString());
      return request<{
        challans: Array<ChallanItem>;
        pagination: { nextCursor: string | null; hasMore: boolean };
      }>(`/vehicles/${regNo}/challans?${q.toString()}`);
    },
  },

  challans: {
    getChallans: (params?: {
      status?: string;
      severity?: string;
      from?: string;
      to?: string;
      limit?: number;
      cursor?: string;
    }) => {
      const q = new URLSearchParams();
      if (params?.status && params.status !== "ALL") q.append("status", params.status);
      if (params?.severity && params.severity !== "ALL") q.append("severity", params.severity);
      if (params?.from) q.append("from", params.from);
      if (params?.to) q.append("to", params.to);
      if (params?.limit) q.append("limit", params.limit.toString());
      if (params?.cursor) q.append("cursor", params.cursor);
      return request<{
        challans: Array<ChallanItem>;
        pagination: { nextCursor: string | null; hasMore: boolean };
      }>(`/users/me/challans?${q.toString()}`);
    },
    disputeChallan: (challanId: string, reason: string) =>
      request<{
        message: string;
        challan: ChallanItem;
      }>(`/challans/${challanId}/dispute`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
  },

  score: {
    getScore: () =>
      request<{
        score: number;
        category: "FAIR" | "GOOD" | "VERY_GOOD";
        previousMonthScore: number | null;
        changeSincePreviousMonth: number;
        computedAt: string;
        nextMilestone: {
          score: number;
          category: string;
          pointsNeeded: number;
        } | null;
        topReasons: Array<{
          reasonCode: string;
          label: string;
          delta: number;
        }>;
        configVersion: number;
      }>("/users/me/score"),
    getHistory: (months = 12) =>
      request<{
        history: Array<{
          period: string;
          score: number;
          category: string;
        }>;
      }>(`/users/me/score/history?months=${months}`),
    getLedger: (params?: { cursor?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.cursor) q.append("cursor", params.cursor);
      if (params?.limit) q.append("limit", params.limit.toString());
      return request<{
        ledger: Array<LedgerItem>;
        pagination: { nextCursor: string | null; hasMore: boolean };
      }>(`/users/me/score/ledger?${q.toString()}`);
    },
  },

  rewards: {
    getEligibility: (
      serviceType: string,
      baseAmountPaise: number,
      vehicleId?: string,
      licenceId?: string
    ) =>
      request<{
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
          chargedTo: string;
        };
        quoteId: string;
        quoteExpiresAt: string;
      }>("/rewards/eligibility", {
        method: "POST",
        body: JSON.stringify({
          serviceType,
          baseAmountPaise,
          vehicleId,
          licenceId,
        }),
      }),
  },

  services: {
    createQuote: (payload: {
      serviceType: string;
      baseAmountPaise: number;
      vehicleId?: string;
      licenceId?: string;
    }) =>
      request<{
        quoteId: string;
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
          chargedTo: string;
        };
        quoteExpiresAt: string;
      }>("/services/quotes", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  transactions: {
    confirm: (payload: {
      quoteId: string;
      simulatedOutcome?: "SUCCESS" | "FAILURE" | "TIMEOUT";
      idempotencyKey?: string;
    }) => {
      const headers: Record<string, string> = {};
      if (payload.idempotencyKey) {
        headers["Idempotency-Key"] = payload.idempotencyKey;
      }
      return request<{
        txnId: string;
        status: string;
        payablePaise: number;
        receiptUrl: string;
      }>("/transactions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          quoteId: payload.quoteId,
          simulatedOutcome: payload.simulatedOutcome || "SUCCESS",
        }),
      });
    },
    getTransactions: (params?: { cursor?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.cursor) q.append("cursor", params.cursor);
      if (params?.limit) q.append("limit", params.limit.toString());
      return request<{
        transactions: Array<TransactionItem>;
        pagination: { nextCursor: string | null; hasMore: boolean };
      }>(`/transactions?${q.toString()}`);
    },
    getReceipt: (txnId: string, format: "json" | "pdf" = "json") => {
      return request<ReceiptItem | Blob>(`/transactions/${txnId}/receipt?format=${format}`, {
        headers: {
          Accept: format === "pdf" ? "application/pdf" : "application/json",
        },
      });
    },
  },
};

export interface ChallanItem {
  challanId: string;
  vehicleId: string;
  registrationNo?: string;
  challanDate: string;
  challanType: string;
  violationCode: string;
  violationDesc: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  amountPaise: number;
  status: "PAID" | "UNPAID" | "PENDING" | "DISPUTED" | "WAIVED";
  dueDate: string;
  paymentDate: string | null;
  scoringEligible: boolean;
}

export interface LedgerItem {
  entryId: string;
  eventType: string;
  component: string;
  reasonCode: string;
  refId: string;
  deltaPoints: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

export interface TransactionItem {
  txnId: string;
  serviceType: "INSURANCE" | "PUC" | "RC" | "LICENCE";
  vaiCategoryAtTxn: "FAIR" | "GOOD" | "VERY_GOOD";
  baseAmountPaise: number;
  discountBps: number;
  discountPaise: number;
  govtFundedPaise: number;
  payablePaise: number;
  platformFeePpm: number;
  platformFeePaise: number;
  status: "CREATED" | "VALIDATED" | "PAYMENT_PENDING" | "SUCCESS" | "FAILED" | "TIMED_OUT" | "REFUNDED";
  paymentRef: string | null;
  createdAt: string;
}

export interface ReceiptItem {
  receiptNumber: string;
  transactionId: string;
  issuedAt: string;
  citizen: {
    fullName: string;
    panMasked: string;
  };
  service: {
    serviceType: string;
    description: string;
  };
  breakdown: {
    baseAmountPaise: number;
    discountBps: number;
    discountPaise: number;
    govtFundedPaise: number;
    payablePaise: number;
    platformFeePpm: number;
    platformFeePaise: number;
    totalPaidPaise: number;
  };
  payment: {
    status: string;
    paymentRef: string;
    completedAt: string;
  };
}
