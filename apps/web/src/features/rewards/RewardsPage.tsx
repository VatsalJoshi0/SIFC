import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ArrowRight, Sparkles, Award } from "lucide-react";
import { api } from "../../api/client";
import { formatBps } from "../../lib/formatting";

export const RewardsPage: React.FC = () => {
  const { data: scoreData, isLoading } = useQuery({
    queryKey: ["score"],
    queryFn: () => api.score.getScore(),
    staleTime: 60000,
  });

  if (isLoading || !scoreData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { score, category, nextMilestone } = scoreData;
  const currentDiscountBps = category === "VERY_GOOD" ? 200 : category === "GOOD" ? 100 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Accountability Rewards & Savings</h1>
        <p className="text-slate-600 text-base mt-1">
          Good driving directly lowers your renewal costs. No complicated claims, instant checkout discounts.
        </p>
      </div>

      {/* User Eligibility Hero */}
      <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-400" />
            <span className="text-xs uppercase font-bold tracking-wider text-teal-300">
              Active Privilege Tier
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-3xl font-black text-white">
              {category.replace("_", " ")} Category
            </h2>
            <span className="text-sm font-semibold text-teal-200">
              (Score: {score})
            </span>
          </div>
          <p className="text-sm text-slate-300 max-w-xl">
            You qualify for an instant <strong>{formatBps(currentDiscountBps)} discount</strong> on all eligible vehicle and driving renewals.
          </p>
        </div>

        {nextMilestone && (
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20 text-right">
            <span className="text-xs text-teal-200 font-semibold block">Next Benefit Level</span>
            <span className="text-lg font-bold text-white block">
              {nextMilestone.category === "VERY_GOOD" ? "Very Good (2.00%)" : nextMilestone.category}
            </span>
            <span className="text-xs text-slate-300">
              {nextMilestone.pointsNeeded} points needed
            </span>
          </div>
        )}
      </div>

      {/* Discount Tier Schedule Table */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-900">National Reward Schedule</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th scope="col" className="px-5 py-3.5">Score Range</th>
                <th scope="col" className="px-5 py-3.5">VAI Tier</th>
                <th scope="col" className="px-5 py-3.5">Discount Rate</th>
                <th scope="col" className="px-5 py-3.5">₹10,000 Insurance Benefit</th>
                <th scope="col" className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Very Good */}
              <tr className={category === "VERY_GOOD" ? "bg-green-50/70 font-semibold" : ""}>
                <td className="px-5 py-4 font-mono font-bold text-slate-900">750 – 900</td>
                <td className="px-5 py-4">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                    Very Good
                  </span>
                </td>
                <td className="px-5 py-4 font-bold text-green-700">200 bps (2.00%)</td>
                <td className="px-5 py-4 font-bold text-slate-900">₹200.00 saved</td>
                <td className="px-5 py-4">
                  {category === "VERY_GOOD" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                      <CheckCircle2 className="w-4 h-4" /> Current Tier
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Target</span>
                  )}
                </td>
              </tr>

              {/* Good */}
              <tr className={category === "GOOD" ? "bg-teal-50/70 font-semibold" : ""}>
                <td className="px-5 py-4 font-mono font-bold text-slate-900">650 – 749</td>
                <td className="px-5 py-4">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800">
                    Good
                  </span>
                </td>
                <td className="px-5 py-4 font-bold text-teal-700">100 bps (1.00%)</td>
                <td className="px-5 py-4 font-bold text-slate-900">₹100.00 saved</td>
                <td className="px-5 py-4">
                  {category === "GOOD" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700">
                      <CheckCircle2 className="w-4 h-4" /> Current Tier
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>

              {/* Fair */}
              <tr className={category === "FAIR" ? "bg-amber-50/70 font-semibold" : ""}>
                <td className="px-5 py-4 font-mono font-bold text-slate-900">500 – 649</td>
                <td className="px-5 py-4">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    Fair
                  </span>
                </td>
                <td className="px-5 py-4 font-medium text-slate-500">0 bps (0.00%)</td>
                <td className="px-5 py-4 text-slate-500">₹0.00 (Standard rate)</td>
                <td className="px-5 py-4">
                  {category === "FAIR" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                      <CheckCircle2 className="w-4 h-4" /> Current Tier
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4 Eligible Services Grid */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Eligible Renewal Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Motor Insurance</h3>
              <p className="text-xs text-slate-500 mt-1">
                Annual renewal for 2-wheeler, 4-wheeler or commercial policies.
              </p>
              <div className="mt-3 text-sm font-semibold text-teal-700">
                Golden rate: ₹10,000 base → Save up to ₹200
              </div>
            </div>
            <Link
              to="/services/insurance"
              className="inline-flex items-center justify-between text-sm font-bold text-teal-700 hover:text-teal-900 pt-2 border-t border-slate-100 min-h-[44px]"
            >
              <span>Renew Insurance</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">PUC Certificate</h3>
              <p className="text-xs text-slate-500 mt-1">
                6-month vehicle emission compliance certificate.
              </p>
              <div className="mt-3 text-sm font-semibold text-emerald-700">
                Standard: ₹150 base
              </div>
            </div>
            <Link
              to="/services/puc"
              className="inline-flex items-center justify-between text-sm font-bold text-emerald-700 hover:text-emerald-900 pt-2 border-t border-slate-100 min-h-[44px]"
            >
              <span>Book PUC</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">RC Validity</h3>
              <p className="text-xs text-slate-500 mt-1">
                5-year vehicle registration certificate fitness renewal.
              </p>
              <div className="mt-3 text-sm font-semibold text-blue-700">
                Standard: ₹600 base
              </div>
            </div>
            <Link
              to="/services/rc"
              className="inline-flex items-center justify-between text-sm font-bold text-blue-700 hover:text-blue-900 pt-2 border-t border-slate-100 min-h-[44px]"
            >
              <span>Extend RC</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Driving Licence</h3>
              <p className="text-xs text-slate-500 mt-1">
                5-year commercial or personal driving licence renewal.
              </p>
              <div className="mt-3 text-sm font-semibold text-purple-700">
                Standard: ₹400 base
              </div>
            </div>
            <Link
              to="/services/licence"
              className="inline-flex items-center justify-between text-sm font-bold text-purple-700 hover:text-purple-900 pt-2 border-t border-slate-100 min-h-[44px]"
            >
              <span>Renew Licence</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
