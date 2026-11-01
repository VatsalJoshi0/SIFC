import React from "react";
import { formatCurrency, formatBps, formatPpm } from "../lib/formatting";
import { Info, ShieldCheck } from "lucide-react";

export interface BreakdownDetails {
  originalAmountPaise: number;
  discountBps: number;
  discountPaise: number;
  govtFundedPaise: number;
  payablePaise: number;
}

export interface PlatformFeeDetails {
  optionCode: string;
  ppm: number;
  feePaise: number;
  chargedTo: string; // "PROVIDER" | "USER"
}

export interface QuoteData {
  quoteId: string;
  quoteExpiresAt: string;
  vaiCategory: string;
  discountBps: number;
  breakdown: BreakdownDetails;
  platformFee: PlatformFeeDetails;
}

interface PriceBreakdownProps {
  breakdown: BreakdownDetails;
  platformFee: PlatformFeeDetails;
  vaiCategory: string;
}

export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({
  breakdown,
  platformFee,
  vaiCategory,
}) => {
  const isFair = vaiCategory === "FAIR";
  const isPassThrough = platformFee.chargedTo === "USER";
  const userTotalPaise = isPassThrough
    ? breakdown.payablePaise + platformFee.feePaise
    : breakdown.payablePaise;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-lg font-bold text-slate-900">Renewal Price Breakdown</h3>
        <span
          className={`px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
            vaiCategory === "VERY_GOOD"
              ? "bg-green-100 text-green-800 border border-green-200"
              : vaiCategory === "GOOD"
              ? "bg-teal-100 text-teal-800 border border-teal-200"
              : "bg-amber-100 text-amber-800 border border-amber-200"
          }`}
        >
          {vaiCategory.replace("_", " ")} Category
        </span>
      </div>

      <div className="space-y-3 text-base">
        {/* Line 1: Base Amount */}
        <div className="flex justify-between items-center text-slate-700">
          <span>Base Service Price</span>
          <span className="font-semibold">{formatCurrency(breakdown.originalAmountPaise)}</span>
        </div>

        {/* Line 2: VAI Discount */}
        <div className="flex justify-between items-center text-teal-700">
          <div className="flex items-center gap-1.5">
            <span>VAI Accountability Discount ({formatBps(breakdown.discountBps)})</span>
            {isFair && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Fair tier (0%)
              </span>
            )}
          </div>
          <span className="font-semibold">
            {breakdown.discountPaise > 0
              ? `- ${formatCurrency(breakdown.discountPaise)}`
              : "₹0.00"}
          </span>
        </div>

        {/* Line 3: Government-Funded Benefit */}
        <div className="flex justify-between items-center text-emerald-700 bg-emerald-50/60 px-3 py-1.5 rounded-lg border border-emerald-100 text-sm">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            <span className="font-medium">Government-Funded Incentive</span>
          </div>
          <span className="font-semibold">{formatCurrency(breakdown.govtFundedPaise)}</span>
        </div>

        {/* Line 4: Net Service Payable */}
        <div className="flex justify-between items-center text-slate-900 pt-2 border-t border-slate-100">
          <span className="font-semibold">Service Payable Amount</span>
          <span className="text-lg font-bold text-slate-900">
            {formatCurrency(breakdown.payablePaise)}
          </span>
        </div>

        {/* Line 5: Platform Fee (Separately Shown) */}
        <div className="pt-2 border-t border-dashed border-slate-200">
          <div className="flex justify-between items-center text-slate-600 text-sm">
            <div className="flex items-center gap-1.5">
              <span>VAI Platform Fee ({formatPpm(platformFee.ppm)})</span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Option {platformFee.optionCode}
              </span>
            </div>
            <span className="font-medium">{formatCurrency(platformFee.feePaise)}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
            {platformFee.chargedTo === "PROVIDER" ? (
              <span>Absorbed by service provider (deducted from settlement). No extra cost to you.</span>
            ) : (
              <span>Pass-through fee added to citizen total.</span>
            )}
          </p>
        </div>
      </div>

      {/* Total Due */}
      <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-center">
        <div>
          <span className="text-base font-bold text-slate-900 block">Total Due Today</span>
          <span className="text-xs text-slate-500">Includes all taxes and compliance benefits</span>
        </div>
        <span className="text-2xl font-black text-slate-900">
          {formatCurrency(userTotalPaise)}
        </span>
      </div>
    </div>
  );
};
