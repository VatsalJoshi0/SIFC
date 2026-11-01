import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../../api/adminClient";
import { useAdminSessionStore } from "../adminSessionStore";
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  ShieldAlert,
} from "lucide-react";

export const AdminSystemPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { adminUser } = useAdminSessionStore();
  const [confirmText, setConfirmText] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSuperAdmin = adminUser?.role === "SUPER_ADMIN";

  const resetMutation = useMutation({
    mutationFn: () => adminApi.system.resetDataset(),
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      setSuccessMsg(`Database reset successful: ${data.message} (${data.reseededCount} profiles restored).`);
      setErrorMsg(null);
      setConfirmText("");
    },
    onError: (err: unknown) => {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Failed to reset dataset");
      }
      setSuccessMsg(null);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          System Maintenance & Dataset Controls
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          TRD 18 & FR-M5 safety-guarded database reset with prototype dummy data enforcement.
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
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Safety Guard Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center space-x-3 text-amber-700">
          <ShieldAlert className="w-6 h-6 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Prototype Environment Safety Safeguards
            </h2>
            <p className="text-xs text-slate-500">
              Spec Patches P1–P12 & PRD 18.2 compliance verification.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-800 block mb-1">Dummy Data Flag</span>
            <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold font-mono">
              is_dummy = true
            </span>
            <p className="text-[11px] text-slate-500 mt-1">
              Guaranteed no production citizen or vehicle records exist.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-800 block mb-1">Simulated OTP & Payment</span>
            <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold font-mono">
              mode = SIMULATED
            </span>
            <p className="text-[11px] text-slate-500 mt-1">
              Zero live payment gateway or SMS gateway integrations.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-800 block mb-1">Database Engine</span>
            <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold font-mono">
              SQLite (Dev) / Postgres (Prod)
            </span>
            <p className="text-[11px] text-slate-500 mt-1">
              Strictly portable schema with native append-only triggers.
            </p>
          </div>
        </div>
      </div>

      {/* Dataset Reset Card */}
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center space-x-2 text-rose-700">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h2 className="text-base font-bold text-slate-900">
            Reset Prototype Dataset (Super Admin Only)
          </h2>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Resetting the database permanently wipes all newly created quotes, simulated transactions, receipts, and challan disputes, and re-seeds the pristine baseline of 10 citizen profiles (U001 to U010) with exact historical snapshots.
        </p>

        {!isSuperAdmin ? (
          <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-500">
            This action requires <strong>SUPER_ADMIN</strong> permissions. You are logged in as {adminUser?.role}.
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Type <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600">RESET-PROTOTYPE</code> to confirm:
              </label>
              <input
                type="text"
                placeholder="RESET-PROTOTYPE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full sm:w-72 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <button
              onClick={() => resetMutation.mutate()}
              disabled={confirmText !== "RESET-PROTOTYPE" || resetMutation.isPending}
              className="py-2 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center space-x-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>
                {resetMutation.isPending ? "Resetting Database..." : "Execute Dataset Reset"}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
