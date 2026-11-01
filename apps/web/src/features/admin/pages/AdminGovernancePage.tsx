import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../../api/adminClient";
import { useAdminSessionStore } from "../adminSessionStore";
import {
  CheckCircle,
  AlertCircle,
  Layers,
  Percent,
} from "lucide-react";

export const AdminGovernancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const { adminUser } = useAdminSessionStore();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: revenue } = useQuery({
    queryKey: ["admin", "revenue"],
    queryFn: () => adminApi.analytics.getRevenue(),
  });

  const isSuperAdmin = adminUser?.role === "SUPER_ADMIN";

  const feeMutation = useMutation({
    mutationFn: ({
      optionCode,
      ppm,
      mode,
    }: {
      optionCode: "A" | "B";
      ppm: number;
      mode: "PROVIDER_PAYS" | "PASS_THROUGH";
    }) => adminApi.config.activateFeeConfig(optionCode, ppm, mode),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "revenue"] });
      setSuccessMsg(`Successfully activated Fee Option ${res.optionCode} (${res.ppm} PPM, ${res.mode})`);
      setErrorMsg(null);
    },
    onError: (err: unknown) => {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to update fee configuration");
      }
      setSuccessMsg(null);
    },
  });

  const activeOption = revenue?.activeFeeOption?.optionCode || "A";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Statutory Governance & Policy Management
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure national platform fee models (P8), discount schedules, and scoring parameters.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Fee Model Switcher Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Percent className="w-5 h-5 text-indigo-600" />
            <span>Platform Fee Policy (PRD 8.2 & Spec Patch P8)</span>
          </h2>
          <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded font-semibold">
            Separately Stated Fee
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          The VAI platform fee is strictly billed as a separate line item (Option A: 50 parts-per-million or Option B: 100 parts-per-million) and is NOT netted against the citizen's government-funded compliance discount.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Option A Card */}
          <div
            className={`p-4 rounded-xl border-2 transition ${
              activeOption === "A"
                ? "border-indigo-600 bg-indigo-50/40"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-slate-900">
                Option A: Baseline Standard
              </span>
              {activeOption === "A" && (
                <span className="text-[10px] font-bold uppercase bg-indigo-600 text-white px-2 py-0.5 rounded">
                  Active in Production
                </span>
              )}
            </div>
            <div className="text-2xl font-black text-indigo-700 my-1">
              50 PPM <span className="text-xs font-normal text-slate-500">(0.005%)</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Standard commercial partner rate. Absorbed by service providers (PROVIDER_PAYS).
            </p>
            {isSuperAdmin && activeOption !== "A" && (
              <button
                onClick={() =>
                  feeMutation.mutate({
                    optionCode: "A",
                    ppm: 50,
                    mode: "PROVIDER_PAYS",
                  })
                }
                disabled={feeMutation.isPending}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                Activate Option A (50 PPM)
              </button>
            )}
          </div>

          {/* Option B Card */}
          <div
            className={`p-4 rounded-xl border-2 transition ${
              activeOption === "B"
                ? "border-indigo-600 bg-indigo-50/40"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-slate-900">
                Option B: Expanded Surcharge
              </span>
              {activeOption === "B" && (
                <span className="text-[10px] font-bold uppercase bg-indigo-600 text-white px-2 py-0.5 rounded">
                  Active in Production
                </span>
              )}
            </div>
            <div className="text-2xl font-black text-purple-700 my-1">
              100 PPM <span className="text-xs font-normal text-slate-500">(0.010%)</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Expanded maintenance rate for high-volume automated clearing and cloud archival.
            </p>
            {isSuperAdmin && activeOption !== "B" && (
              <button
                onClick={() =>
                  feeMutation.mutate({
                    optionCode: "B",
                    ppm: 100,
                    mode: "PROVIDER_PAYS",
                  })
                }
                disabled={feeMutation.isPending}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                Activate Option B (100 PPM)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Statutory Discount Schedule Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          <span>Statutory Reward Discount Schedule (PRD 8.1)</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-4">Tier</th>
                <th className="py-2.5 px-4">Score Range</th>
                <th className="py-2.5 px-4">Motor Insurance</th>
                <th className="py-2.5 px-4">PUC Certificate</th>
                <th className="py-2.5 px-4">RC Renewal</th>
                <th className="py-2.5 px-4">DL Renewal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              <tr>
                <td className="py-3 px-4 font-bold text-emerald-700">VERY GOOD</td>
                <td className="py-3 px-4 font-mono">750 – 900</td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">2.00% (200 bps)</td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">2.00% (200 bps)</td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">2.00% (200 bps)</td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">2.00% (200 bps)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-blue-700">GOOD</td>
                <td className="py-3 px-4 font-mono">650 – 749</td>
                <td className="py-3 px-4 text-blue-600 font-semibold">1.00% (100 bps)</td>
                <td className="py-3 px-4 text-blue-600 font-semibold">1.00% (100 bps)</td>
                <td className="py-3 px-4 text-blue-600 font-semibold">1.00% (100 bps)</td>
                <td className="py-3 px-4 text-blue-600 font-semibold">1.00% (100 bps)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-amber-700">FAIR</td>
                <td className="py-3 px-4 font-mono">500 – 649</td>
                <td className="py-3 px-4 text-slate-400">0.00% (Advisory)</td>
                <td className="py-3 px-4 text-slate-400">0.00% (Advisory)</td>
                <td className="py-3 px-4 text-slate-400">0.00% (Advisory)</td>
                <td className="py-3 px-4 text-slate-400">0.00% (Advisory)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
