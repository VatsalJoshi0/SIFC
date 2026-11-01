import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../../api/adminClient";
import {
  CheckCircle,
  XCircle,
  Activity,
} from "lucide-react";

export const AdminDisputesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("ALL");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "challans", "disputes"],
    queryFn: () => adminApi.challans.list({ limit: 100 }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({
      disputeId,
      outcome,
      note,
    }: {
      disputeId: string;
      outcome: "UPHELD" | "REJECTED";
      note?: string;
    }) => adminApi.challans.resolveDispute(disputeId, outcome, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "challans"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "score-distribution"] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError("Failed to resolve dispute");
      }
    },
  });

  const disputedChallans = (data?.challans || []).filter((c) => {
    if (filter === "PENDING") return c.status === "DISPUTED";
    if (filter === "WAIVED") return c.status === "WAIVED";
    return c.dispute !== null;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Citizen Dispute Adjudication Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review citizen claims against traffic violations per Section 136A of the Motor Vehicles Act.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-slate-600">Filter:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Disputes</option>
            <option value="PENDING">Pending Adjudication</option>
            <option value="WAIVED">Upheld / Waived</option>
          </select>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-xs text-red-800">
          {actionError}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Activity className="w-5 h-5 animate-spin mr-2" />
          <span>Loading dispute queue...</span>
        </div>
      ) : disputedChallans.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
          <CheckCircle className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
          <p className="font-semibold text-slate-700">No active disputes found in this filter</p>
          <p className="text-xs text-slate-400 mt-1">All citizen disputes are up to date.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Challan / Date</th>
                  <th className="py-3 px-4">Citizen</th>
                  <th className="py-3 px-4">Violation</th>
                  <th className="py-3 px-4">Fine</th>
                  <th className="py-3 px-4">Citizen Dispute Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Adjudication Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {disputedChallans.map((item) => (
                  <tr key={item.challanId} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      <div>{item.challanId.slice(0, 12)}...</div>
                      <div className="text-[10px] text-slate-400">Due: {item.dueDate}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{item.citizenName}</div>
                      <div className="text-[10px] font-mono text-slate-500">{item.registrationNo}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{item.violationDesc}</div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase bg-amber-100 text-amber-800">
                        {item.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      ₹{(item.amountPaise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="text-slate-700 italic bg-slate-50 p-2 rounded border border-slate-200 text-[11px]">
                        "{item.dispute?.reason || "Citizen contested violation"}"
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          item.status === "DISPUTED"
                            ? "bg-amber-100 text-amber-800"
                            : item.status === "WAIVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.status === "DISPUTED" && item.dispute ? (
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => {
                              resolveMutation.mutate({
                                disputeId: item.dispute!.disputeId,
                                outcome: "UPHELD",
                                note: "Approved upon admin verification",
                              });
                            }}
                            disabled={resolveMutation.isPending}
                            className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-[11px] font-medium shadow-sm transition disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Uphold</span>
                          </button>
                          <button
                            onClick={() => {
                              resolveMutation.mutate({
                                disputeId: item.dispute!.disputeId,
                                outcome: "REJECTED",
                                note: "Rejected: violation confirmed by speed cam audit",
                              });
                            }}
                            disabled={resolveMutation.isPending}
                            className="inline-flex items-center space-x-1 bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 rounded text-[11px] font-medium shadow-sm transition disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Adjudicated</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
