import React from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../../api/adminClient";
import {
  Users,
  Activity,
  Award,
  IndianRupee,
  ShieldAlert,
  Percent,
  TrendingUp,
} from "lucide-react";

export const AdminDashboardPage: React.FC = () => {
  const { data: scoreDist, isLoading: loadingDist } = useQuery({
    queryKey: ["admin", "score-distribution"],
    queryFn: () => adminApi.analytics.getScoreDistribution(),
  });

  const { data: revenue, isLoading: loadingRev } = useQuery({
    queryKey: ["admin", "revenue"],
    queryFn: () => adminApi.analytics.getRevenue(),
  });

  if (loadingDist || loadingRev) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Activity className="w-6 h-6 animate-spin mr-2" />
        <span>Loading Executive Analytics...</span>
      </div>
    );
  }

  const dist = scoreDist?.distribution || {
    FAIR: { count: 0, percentage: 0 },
    GOOD: { count: 0, percentage: 0 },
    VERY_GOOD: { count: 0, percentage: 0 },
  };

  const totalPaise = revenue?.totalPayablePaise ?? revenue?.totalVolumePaise ?? 0;
  const platformFeePaise = revenue?.totalPlatformFeePaise ?? revenue?.grossFeeRevenuePaise ?? 0;
  const discountPaise = revenue?.totalDiscountPaise ?? 0;
  const activeFeeOptionCode = revenue?.activeFeeOption?.optionCode || "A";
  const activeFeePpm = revenue?.activeFeeOption?.ppm ?? 150;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Executive Operations Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time national compliance index, score band distributions, and platform economics.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200">
          <Activity className="w-4 h-4" />
          <span>Active Fee Option: <strong>Option {activeFeeOptionCode} ({activeFeePpm} PPM)</strong></span>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>TOTAL CITIZENS</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {scoreDist?.totalUsers ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Avg Score: <strong>{Math.round(scoreDist?.averageScore ?? 700)}</strong> (Range: {scoreDist?.minScore} - {scoreDist?.maxScore})
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>GROSS VOLUME</span>
            <IndianRupee className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            ₹{(totalPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Processed via <strong>{revenue?.totalTransactions ?? 0} transactions</strong>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>CITIZEN REWARDS FUNDED</span>
            <Award className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            ₹{(discountPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-emerald-600 font-medium">
            100% Govt-Funded Compliance Subsidies
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>PLATFORM FEES ACCRUED</span>
            <Percent className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            ₹{(platformFeePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Separately billed per PRD 8.2 & Spec Patch P8
          </div>
        </div>
      </div>

      {/* Score Tier Distribution Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <span>VAI Score Tier Distribution (Population Cohort)</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Scoring bands per PRD 7.1: Fair (&lt;650), Good (650–749), Very Good (750–900).
        </p>

        <div className="mt-6 space-y-4">
          {/* VERY GOOD */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-emerald-700 flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>VERY GOOD (750 - 900) • 2.00% Renewal Discount</span>
              </span>
              <span className="text-slate-700">
                {dist.VERY_GOOD?.count ?? 0} citizens ({dist.VERY_GOOD?.percentage ?? 0}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(dist.VERY_GOOD?.percentage ?? 0, 4)}%` }}
              ></div>
            </div>
          </div>

          {/* GOOD */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-blue-700 flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span>GOOD (650 - 749) • 1.00% Renewal Discount</span>
              </span>
              <span className="text-slate-700">
                {dist.GOOD?.count ?? 0} citizens ({dist.GOOD?.percentage ?? 0}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(dist.GOOD?.percentage ?? 0, 4)}%` }}
              ></div>
            </div>
          </div>

          {/* FAIR */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-amber-700 flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>FAIR (500 - 649) • 0.00% Discount (Advisory Only)</span>
              </span>
              <span className="text-slate-700">
                {dist.FAIR?.count ?? 0} citizens ({dist.FAIR?.percentage ?? 0}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(dist.FAIR?.percentage ?? 0, 4)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
            <span>Compliance Integrity Guards</span>
          </h3>
          <ul className="text-xs text-slate-600 space-y-2">
            <li className="flex items-start space-x-2">
              <span className="text-emerald-500 font-bold">✓</span>
              <span><strong>Immutable Ledger:</strong> SQLite triggers actively prevent UPDATE / DELETE on score ledger entries.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-emerald-500 font-bold">✓</span>
              <span><strong>Integer Paise Precision:</strong> BigInt zero-floating-point currency arithmetic enforced globally.</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-emerald-500 font-bold">✓</span>
              <span><strong>DPDP Act 2023 Masking:</strong> PANs are masked as <code>XXXXXX001X</code> across all views.</span>
            </li>
          </ul>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
            <Award className="w-4 h-4 text-indigo-600" />
            <span>Statutory Benefits Model</span>
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Citizens in the <strong>Good (650–749)</strong> and <strong>Very Good (750–900)</strong> tiers receive statutory discounts on Motor Insurance, PUC certificates, Vehicle RC renewals, and Driving Licence renewals. All incentives are funded directly by government road safety appropriations.
          </p>
        </div>
      </div>
    </div>
  );
};
