import { useAdminSessionStore } from "../features/admin/adminSessionStore";
import { ApiError } from "./client";

const BASE_URL = "http://127.0.0.1:3001/api/v1/admin";

async function adminRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAdminSessionStore.getState().adminToken;
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
  });

  if (response.status === 401) {
    useAdminSessionStore.getState().clearAdminSession();
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/csv")) {
    const text = await response.text();
    return text as unknown as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = data.error || {};
    throw new ApiError(
      err.message || "Admin request failed",
      err.code || "ADMIN_ERROR",
      response.status,
      err.details
    );
  }

  return data as T;
}

export const adminApi = {
  auth: {
    login: (body: { email: string; password: string; secondFactorCode?: string }) =>
      adminRequest<{
        requires2FA?: boolean;
        simulated2FACode?: string;
        message?: string;
        accessToken?: string;
        expiresIn?: number;
        admin?: {
          adminId: string;
          email: string;
          role: "SUPER_ADMIN" | "OPS" | "ANALYST";
        };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  analytics: {
    getScoreDistribution: () =>
      adminRequest<{
        totalUsers: number;
        distribution: {
          FAIR: { count: number; percentage: number };
          GOOD: { count: number; percentage: number };
          VERY_GOOD: { count: number; percentage: number };
        };
        averageScore: number;
        minScore: number;
        maxScore: number;
      }>("/scores/distribution"),

    getRevenue: () =>
      adminRequest<{
        totalTransactions: number;
        totalBaseAmountPaise: number;
        totalDiscountPaise: number;
        totalPayablePaise: number;
        totalPlatformFeePaise: number;
        totalRefundedPaise: number;
        activeFeeOption: {
          optionCode: string;
          ppm: number;
          mode: string;
        };
      }>("/revenue"),
  },

  users: {
    list: (params?: { query?: string; status?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.query) q.append("query", params.query);
      if (params?.status) q.append("status", params.status);
      if (params?.limit) q.append("limit", params.limit.toString());
      return adminRequest<{
        users: Array<{
          userId: string;
          fullName: string;
          panMasked: string;
          mobileMasked: string;
          city: string;
          state: string;
          status: string;
          score: number | null;
          category: string | null;
          vehicleCount: number;
        }>;
        count: number;
      }>(`/users?${q.toString()}`);
    },

    getDetail: (userId: string) =>
      adminRequest<{
        user: {
          userId: string;
          fullName: string;
          panMasked: string;
          mobileMasked: string;
          city: string;
          state: string;
          status: string;
          vaiScore: { score: number; category: string } | null;
          vehicles: Array<{
            vehicleId: string;
            registrationNo: string;
            vehicleType: string;
            compliance: { fullyCompliant: boolean };
          }>;
          challans: Array<{
            challanId: string;
            violationDesc: string;
            severity: string;
            amountPaise: number;
            status: string;
          }>;
        };
      }>(`/users/${userId}`),
  },

  challans: {
    list: (params?: { status?: string; severity?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.append("status", params.status);
      if (params?.severity) q.append("severity", params.severity);
      if (params?.limit) q.append("limit", params.limit.toString());
      return adminRequest<{
        challans: Array<{
          challanId: string;
          userId: string;
          citizenName: string;
          registrationNo: string;
          violationCode: string;
          violationDesc: string;
          severity: string;
          amountPaise: number;
          status: string;
          dueDate: string;
          dispute: {
            disputeId: string;
            reason: string;
            status: string;
            createdAt: string;
          } | null;
        }>;
        count: number;
      }>(`/challans?${q.toString()}`);
    },

    resolveDispute: (disputeId: string, outcome: "UPHELD" | "REJECTED", note?: string) =>
      adminRequest<{
        message: string;
        dispute: unknown;
        challan: unknown;
      }>(`/disputes/${disputeId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ outcome, note }),
      }),
  },

  transactions: {
    list: (params?: { status?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.append("status", params.status);
      if (params?.limit) q.append("limit", params.limit.toString());
      return adminRequest<{
        transactions: Array<{
          txnId: string;
          userId: string;
          citizenName: string;
          panMasked: string;
          serviceType: string;
          vaiCategory: string;
          baseAmountPaise: number;
          discountPaise: number;
          payablePaise: number;
          platformFeePaise: number;
          status: string;
          paymentRef: string | null;
          createdAt: string;
          refunds: Array<{
            refundId: string;
            amountPaise: number;
            feeReversedPaise: number;
            reasonCode: string;
            createdAt: string;
          }>;
        }>;
        count: number;
      }>(`/transactions?${q.toString()}`);
    },

    refund: (txnId: string, amountPaise: number, reasonCode: string) =>
      adminRequest<{
        refundId: string;
        txnId: string;
        amountPaise: number;
        feeReversedPaise: number;
        transactionStatus: string;
      }>(`/transactions/${txnId}/refund`, {
        method: "POST",
        body: JSON.stringify({ amountPaise, reasonCode }),
      }),
  },

  config: {
    activateFeeConfig: (optionCode: "A" | "B", ppm: number, mode: "PROVIDER_PAYS" | "PASS_THROUGH") =>
      adminRequest<{
        configId: string;
        optionCode: string;
        ppm: number;
        mode: string;
        isActive: boolean;
      }>("/config/fees", {
        method: "PUT",
        body: JSON.stringify({ optionCode, ppm, mode }),
      }),

    updateRewards: (
      configs: Array<{
        vaiCategory: "FAIR" | "GOOD" | "VERY_GOOD";
        serviceType: "INSURANCE" | "PUC" | "RC" | "LICENCE";
        discountBps: number;
        effectiveFrom: string;
      }>
    ) =>
      adminRequest<{ updatedCount: number }>("/config/rewards", {
        method: "PUT",
        body: JSON.stringify({ configs }),
      }),

    insertScoringConfig: (parameters: Record<string, unknown>, changeReason: string) =>
      adminRequest<{ configId: string; version: number }>("/config/scoring", {
        method: "PUT",
        body: JSON.stringify({
          parameters,
          effectiveFrom: new Date().toISOString(),
          changeReason,
        }),
      }),
  },

  system: {
    resetDataset: () =>
      adminRequest<{
        success: boolean;
        message: string;
        reseededCount: number;
      }>("/datasets/reset", {
        method: "POST",
      }),

    listAuditLogs: (params?: { limit?: number; action?: string; entityType?: string }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.append("limit", params.limit.toString());
      if (params?.action) q.append("action", params.action);
      if (params?.entityType) q.append("entityType", params.entityType);
      return adminRequest<{
        logs: Array<{
          logId: string;
          action: string;
          actorId: string;
          entityType: string;
          entityId: string;
          details: unknown;
          ipAddress: string | null;
          createdAt: string;
        }>;
        count: number;
      }>(`/audit-logs?${q.toString()}`);
    },

    getExportCsvUrl: (type: "users" | "transactions" | "challans" | "audit-logs") => {
      const token = useAdminSessionStore.getState().adminToken;
      return `${BASE_URL}/export/csv?type=${type}${token ? `&token=${encodeURIComponent(token)}` : ""}`;
    },
  },
};
