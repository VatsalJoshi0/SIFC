import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Gauge,
  History,
  ChevronRight,
  Award,
} from "lucide-react";
import { api } from "../../api/client";
import { ScoreMeter } from "../../components/ScoreMeter";
import { formatDateTime } from "../../lib/formatting";

export const ScorePage: React.FC = () => {
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const { data: scoreData, isLoading: scoreLoading } = useQuery({
    queryKey: ["score"],
    queryFn: () => api.score.getScore(),
    staleTime: 60000,
  });

  const { data: historyData } = useQuery({
    queryKey: ["score", "history"],
    queryFn: () => api.score.getHistory(12),
    staleTime: 300000,
  });

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ["score", "ledger", cursor],
    queryFn: () => api.score.getLedger({ cursor, limit: 15 }),
    staleTime: 60000,
  });

  if (scoreLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const score = scoreData?.score ?? 700;
  const category = scoreData?.category ?? "GOOD";
  const nextMilestone = scoreData?.nextMilestone ?? null;
  const history = (historyData as any)?.history || (historyData as any)?.snapshots || [];
  const ledger = ledgerData?.ledger || [];

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">VAI Score & Transparent Ledger</h1>
        <p className="text-slate-600 text-base mt-1">
          Every point change is permanent, auditable, and mathematically explained.
        </p>
      </div>

      {/* Meter & Milestone Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center shadow-sm">
          <ScoreMeter
            score={score}
            category={category}
            pointsNeeded={nextMilestone?.pointsNeeded}
            nextCategory={nextMilestone?.category}
            size={260}
          />
        </div>

        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-teal-600" />
              <h2 className="text-lg font-bold text-slate-900">Score Target & Milestones</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              VAI evaluates your road accountability on a scale of <strong>500 to 900 (base 700)</strong>.
              Sustained violation-free driving, on-time challan payments, and valid vehicle documents continuously improve your rating.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-center">
                <span className="text-xs font-bold text-amber-800 uppercase block">Fair</span>
                <span className="text-sm font-bold text-slate-900">500–649</span>
                <span className="text-xs text-amber-700 block mt-0.5">0% discount</span>
              </div>
              <div className="p-3 rounded-xl border border-teal-200 bg-teal-50 text-center">
                <span className="text-xs font-bold text-teal-800 uppercase block">Good</span>
                <span className="text-sm font-bold text-slate-900">650–749</span>
                <span className="text-xs text-teal-700 block mt-0.5">1.00% discount</span>
              </div>
              <div className="p-3 rounded-xl border border-green-200 bg-green-50 text-center">
                <span className="text-xs font-bold text-green-800 uppercase block">Very Good</span>
                <span className="text-sm font-bold text-slate-900">750–900</span>
                <span className="text-xs text-green-700 block mt-0.5">2.00% discount</span>
              </div>
            </div>
          </div>

          {nextMilestone && (
            <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-800 block">
                  Next Milestone Tier
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {nextMilestone.pointsNeeded} points needed to reach {nextMilestone.category.replace("_", " ")}
                </span>
              </div>
              <span className="text-xl font-black text-teal-700">{nextMilestone.score}</span>
            </div>
          )}
        </div>
      </div>

      {/* 12-Month History Chart */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">12-Month Score Progression</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Monthly snapshots</span>
        </div>

        {/* Responsive Score Trend Chart using pure SVG */}
        <div className="w-full h-48 sm:h-64 pt-4">
          {history.length > 0 ? (
            <div className="relative w-full h-full flex flex-col justify-end">
              <svg viewBox="0 0 1000 240" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                {/* Horizontal reference bands */}
                {/* 750 (Very Good line): Y = 240 - ((750 - 500) / 400 * 200) = 240 - 125 = 115 */}
                <line x1="0" y1="115" x2="1000" y2="115" stroke="#16a34a" strokeDasharray="4 4" strokeWidth="1" />
                <text x="10" y="110" fill="#16a34a" fontSize="12" fontWeight="600">750 (Very Good)</text>

                {/* 650 (Good line): Y = 240 - ((650 - 500) / 400 * 200) = 240 - 75 = 165 */}
                <line x1="0" y1="165" x2="1000" y2="165" stroke="#0d9488" strokeDasharray="4 4" strokeWidth="1" />
                <text x="10" y="160" fill="#0d9488" fontSize="12" fontWeight="600">650 (Good)</text>

                {/* Trend line */}
                {(() => {
                  const points = history.map((item, idx) => {
                    const x = (idx / Math.max(1, history.length - 1)) * 960 + 20;
                    const y = 220 - ((Math.max(500, Math.min(900, item.score)) - 500) / 400) * 190;
                    return { x, y, score: item.score, period: item.period };
                  });

                  const pathD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");

                  return (
                    <g>
                      <path d={pathD} fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      {points.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke="#0d9488" strokeWidth="3" />
                          <text x={p.x} y={p.y - 10} fill="#0f172a" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {p.score}
                          </text>
                        </g>
                      ))}
                    </g>
                  );
                })()}
              </svg>

              {/* X-axis labels */}
              <div className="flex justify-between items-center text-xs text-slate-500 font-medium pt-3 border-t border-slate-100">
                {history.map((h, i) => (
                  <span key={i} className="text-center font-mono">
                    {h.period.slice(0, 7)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-12">No snapshot history available yet.</p>
          )}
        </div>
      </section>

      {/* Transparent Score Ledger */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">Score Adjustment Ledger</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Immutable audit trail</span>
        </div>

        {ledgerLoading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Loading ledger rows...</div>
        ) : ledger.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No ledger entries recorded yet.</p>
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-y border-slate-200">
                  <tr>
                    <th scope="col" className="px-4 py-3">Timestamp (IST)</th>
                    <th scope="col" className="px-4 py-3">Component</th>
                    <th scope="col" className="px-4 py-3">Event / Reason</th>
                    <th scope="col" className="px-4 py-3 text-right">Points</th>
                    <th scope="col" className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.map((entry) => (
                    <tr key={entry.entryId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-slate-500">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {entry.component}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div>{entry.reasonCode}</div>
                        <span className="text-xs text-slate-400 font-mono">Ref: {entry.refId}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-bold">
                        <span
                          className={
                            entry.deltaPoints > 0
                              ? "text-green-700"
                              : entry.deltaPoints < 0
                              ? "text-red-700"
                              : "text-slate-500"
                          }
                        >
                          {entry.deltaPoints > 0 ? `+${entry.deltaPoints}` : entry.deltaPoints}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-slate-700">
                        {entry.balanceBefore} → <strong className="text-slate-900">{entry.balanceAfter}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards (< 768px per TRD 4.5) */}
            <div className="md:hidden space-y-3">
              {ledger.map((entry) => (
                <div key={entry.entryId} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-slate-500">{formatDateTime(entry.createdAt)}</span>
                    <span className="font-mono font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                      {entry.component}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-900 text-sm">{entry.reasonCode}</div>
                  <div className="text-xs text-slate-500 font-mono">Ref: {entry.refId}</div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm">
                    <span className="font-mono text-xs text-slate-600">
                      Balance: {entry.balanceBefore} → <strong>{entry.balanceAfter}</strong>
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        entry.deltaPoints > 0 ? "text-green-700" : entry.deltaPoints < 0 ? "text-red-700" : "text-slate-600"
                      }`}
                    >
                      {entry.deltaPoints > 0 ? `+${entry.deltaPoints}` : entry.deltaPoints}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {ledgerData?.pagination.hasMore && (
              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setCursor(ledgerData.pagination.nextCursor || undefined)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm min-h-[44px]"
                >
                  <span>Load older ledger entries</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
