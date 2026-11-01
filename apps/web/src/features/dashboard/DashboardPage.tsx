import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Car,
  FileText,
  Gift,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Clock,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { ScoreMeter } from "../../components/ScoreMeter";
import { api } from "../../api/client";
import { formatBps } from "../../lib/formatting";

export const DashboardPage: React.FC = () => {
  const {
    data: scoreData,
    isLoading: scoreLoading,
    isError: scoreError,
    refetch: refetchScore,
  } = useQuery({
    queryKey: ["score"],
    queryFn: () => api.score.getScore(),
    staleTime: 60000,
  });

  const { data: vehicleData } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api.vehicles.getVehicles(),
    staleTime: 300000,
  });

  const { data: challanData } = useQuery({
    queryKey: ["challans", "recent"],
    queryFn: () => api.challans.getChallans({ limit: 10 }),
    staleTime: 60000,
  });

  if (scoreLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-500">Loading your VAI Dashboard...</span>
        </div>
      </div>
    );
  }

  if (scoreError || !scoreData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md text-center space-y-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Score Data Unavailable</h2>
          <p className="text-sm text-slate-600">
            We were unable to load your live VAI score. You may need to review your consent settings or refresh your session.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <button
              onClick={() => refetchScore()}
              className="px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition"
            >
              Retry
            </button>
            <Link
              to="/consent"
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition"
            >
              Review Consent
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const {
    score = 700,
    category = "GOOD",
    previousMonthScore = null,
    changeSincePreviousMonth = 0,
    nextMilestone = null,
    topReasons = [],
  } = scoreData;

  const unpaidChallansCount =
    (challanData?.challans || []).filter((c) => c.status === "UNPAID").length;
  const vehicles = vehicleData?.vehicles || [];
  const fullyCompliantVehicles = vehicles.filter((v) => v.compliance?.fullyCompliant).length;

  const eligibleDiscountBps = category === "VERY_GOOD" ? 200 : category === "GOOD" ? 100 : 0;

  return (
    <div className="space-y-8">
      {/* Welcome & Overview Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Citizen Dashboard</h1>
        <p className="text-slate-600 text-base mt-1">
          Review your real-time vehicle compliance, driving streak, and active renewal benefits.
        </p>
      </div>

      {/* Main Score Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Score Meter (TRD 4.4) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0">
          <ScoreMeter
            score={score}
            category={category}
            pointsNeeded={nextMilestone?.pointsNeeded}
            nextCategory={nextMilestone?.category}
            size={280}
          />
        </div>

        {/* Score Context & Top Drivers */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider block">
                Monthly Performance
              </span>
              <div className="flex items-center gap-2 mt-1">
                {previousMonthScore !== null ? (
                  <>
                    <span className="text-2xl font-bold text-slate-900">
                      {changeSincePreviousMonth >= 0 ? `+${changeSincePreviousMonth}` : changeSincePreviousMonth} pts
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 text-sm font-semibold px-2 py-0.5 rounded-full ${
                        changeSincePreviousMonth >= 0
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {changeSincePreviousMonth >= 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      vs {previousMonthScore} last month
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                    New account - you start at 700
                  </span>
                )}
              </div>
            </div>

            {nextMilestone && (
              <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-right">
                <span className="text-xs text-slate-500 font-semibold block">Next Tier Target</span>
                <span className="text-sm font-bold text-slate-900">
                  {nextMilestone.pointsNeeded} pts to {nextMilestone.category === "VERY_GOOD" ? "Very Good" : nextMilestone.category}
                </span>
              </div>
            )}
          </div>

          {/* Top Score Drivers */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-teal-600" />
              Key Score Drivers
            </h2>
            <div className="space-y-2">
              {topReasons && topReasons.length > 0 ? (
                topReasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-sm"
                  >
                    <span className="font-medium text-slate-800">{reason.label}</span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded ${
                        reason.delta >= 0
                          ? "text-green-700 bg-green-50"
                          : "text-red-700 bg-red-50"
                      }`}
                    >
                      {reason.delta >= 0 ? `+${reason.delta}` : reason.delta}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No score changes recorded yet.</p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/score"
              className="inline-flex items-center gap-1.5 text-teal-700 hover:text-teal-900 font-bold text-sm min-h-[44px]"
            >
              <span>View full transparent score ledger</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3 Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Vehicles Compliance */}
        <Link
          to="/vehicles"
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-teal-500 transition-all space-y-3 min-h-[44px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Vehicles Registered
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{vehicles.length}</span>
            <span className="text-xs font-semibold text-slate-500">
              ({fullyCompliantVehicles} fully compliant)
            </span>
          </div>
          <span className="text-xs font-semibold text-teal-700 flex items-center gap-1">
            <span>Manage documents</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        {/* Challans */}
        <Link
          to="/challans"
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-teal-500 transition-all space-y-3 min-h-[44px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Unpaid Challans
            </span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              unpaidChallansCount > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
            }`}>
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{unpaidChallansCount}</span>
            <span className="text-xs font-semibold text-slate-500">pending payment</span>
          </div>
          <span className="text-xs font-semibold text-teal-700 flex items-center gap-1">
            <span>Review challans & disputes</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        {/* Rewards Eligibility */}
        <Link
          to="/rewards"
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-teal-500 transition-all space-y-3 min-h-[44px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Renewal Discount
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Gift className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{formatBps(eligibleDiscountBps)}</span>
            <span className="text-xs font-semibold text-slate-500">
              {category.replace("_", " ")} tier
            </span>
          </div>
          <span className="text-xs font-semibold text-teal-700 flex items-center gap-1">
            <span>Explore savings table</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>

      {/* Quick Renewal Service Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Instant Online Renewals</h2>
          <span className="text-sm text-slate-500">Applies your VAI discount directly</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Insurance */}
          <Link
            to="/services/insurance"
            className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-teal-600 hover:shadow-md transition-all space-y-3 flex flex-col justify-between min-h-[44px]"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-3">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Motor Insurance</h3>
              <p className="text-xs text-slate-500 mt-1">12-month policy extension with up to 2.00% VAI discount.</p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-teal-700">
              <span>Renew Policy</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* PUC */}
          <Link
            to="/services/puc"
            className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-teal-600 hover:shadow-md transition-all space-y-3 flex flex-col justify-between min-h-[44px]"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">PUC Certificate</h3>
              <p className="text-xs text-slate-500 mt-1">6-month emission compliance extension with certified centers.</p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-emerald-700">
              <span>Book / Renew</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* RC Fitness */}
          <Link
            to="/services/rc"
            className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-teal-600 hover:shadow-md transition-all space-y-3 flex flex-col justify-between min-h-[44px]"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                <Car className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">RC Validity</h3>
              <p className="text-xs text-slate-500 mt-1">5-year registration validity extension via Parivahan sync.</p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-blue-700">
              <span>Extend RC</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Driving Licence */}
          <Link
            to="/services/licence"
            className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-teal-600 hover:shadow-md transition-all space-y-3 flex flex-col justify-between min-h-[44px]"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Driving Licence</h3>
              <p className="text-xs text-slate-500 mt-1">5-year driving licence renewal without visiting the RTO.</p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-purple-700">
              <span>Renew Licence</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};
