import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../../api/adminClient";
import { useAdminSessionStore } from "../adminSessionStore";
import {
  RotateCcw,
  Activity,
} from "lucide-react";

export const AdminTransactionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { adminUser } = useAdminSessionStore();
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null);
  const [refundAmountRupees, setRefundAmountRupees] = useState("");
  const [refundReason, setRefundReason] = useState("SERVICE_CANCELLATION");
  const [refundError, setRefundError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "transactions"],
    queryFn: () => adminApi.transactions.list({ limit: 50 }),
  });

  const refundMutation = useMutation({
    mutationFn: ({
      txnId,
      amountPaise,
      reasonCode,
    }: {
      txnId: string;
      amountPaise: number;
      reasonCode: string;
    }) => adminApi.transactions.refund(txnId, amountPaise, reasonCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "revenue"] });
      setSelectedTxn(null);
      setRefundAmountRupees("");
      setRefundError(null);
    },
    onError: (err: unknown) => {
      if (err instanceof Error) {
        setRefundError(err.message);
      } else {
        setRefundError("Failed to process refund");
      }
    },
  });

  const handleRefundSubmit = (e: React.FormEvent, maxPayablePaise: number) => {
    e.preventDefault();
    setRefundError(null);
    const amountRupees = parseFloat(refundAmountRupees);
    if (isNaN(amountRupees) || amountRupees <= 0) {
      setRefundError("Please enter a valid positive refund amount.");
      return;
    }
    const amountPaise = Math.round(amountRupees * 100);
    if (amountPaise > maxPayablePaise) {
      setRefundError(`Refund amount cannot exceed total payable ₹${(maxPayablePaise / 100).toFixed(2)}.`);
      return;
    }

    if (selectedTxn) {
      refundMutation.mutate({
        txnId: selectedTxn,
        amountPaise,
        reasonCode: refundReason,
      });
    }
  };

  const isSuperAdmin = adminUser?.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Transactions & Refunds Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Financial reconciliation with proportional platform fee clawbacks (Spec Patch P7).
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Activity className="w-5 h-5 animate-spin mr-2" />
          <span>Loading transactions ledger...</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Txn ID / Date</th>
                  <th className="py-3 px-4">Citizen</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">VAI Tier</th>
                  <th className="py-3 px-4">Gross Base</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Citizen Paid</th>
                  <th className="py-3 px-4">Platform Fee</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.transactions || []).map((t) => (
                  <tr key={t.txnId} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      <div>{t.txnId}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{t.citizenName}</div>
                      <div className="text-[10px] font-mono text-slate-500">{t.panMasked}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {t.serviceType}
                    </td>
                    <td className="py-3 px-4 font-semibold text-indigo-700">
                      {t.vaiCategory}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      ₹{(t.baseAmountPaise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-emerald-600 font-medium">
                      -₹{(t.discountPaise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹{(t.payablePaise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      ₹{(t.platformFeePaise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          t.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-800"
                            : t.status === "REFUNDED"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {t.status === "SUCCESS" && isSuperAdmin ? (
                        <button
                          onClick={() => setSelectedTxn(t.txnId)}
                          className="inline-flex items-center space-x-1 text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-1 rounded text-[11px] font-medium transition"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Refund</span>
                        </button>
                      ) : t.refunds.length > 0 ? (
                        <span className="text-[10px] text-purple-700 font-medium">
                          Refunded (₹{(t.refunds.reduce((acc, r) => acc + r.amountPaise, 0) / 100).toFixed(2)})
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Proportional Refund Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-2 text-purple-700 mb-4">
              <RotateCcw className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">
                Process Proportional Refund
              </h3>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Refunding transaction <code className="bg-slate-100 px-1 py-0.5 rounded">{selectedTxn}</code>. Per Spec Patch P7, platform fees will be automatically reversed in exact proportion to the refund amount.
            </p>

            {refundError && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-xs text-red-800 mb-4">
                {refundError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                const txn = data?.transactions.find((t) => t.txnId === selectedTxn);
                handleRefundSubmit(e, txn ? txn.payablePaise : 0);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Refund Amount (in ₹ INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 9800.00"
                  value={refundAmountRupees}
                  onChange={(e) => setRefundAmountRupees(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason Code
                </label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="SERVICE_CANCELLATION">Service Cancellation</option>
                  <option value="POLICY_OVERPAYMENT">Policy Overpayment</option>
                  <option value="SYSTEM_DUPLICATE">System Duplicate</option>
                  <option value="COURT_ORDER">Court Order / Statutory Order</option>
                </select>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTxn(null)}
                  className="flex-1 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refundMutation.isPending}
                  className="flex-1 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow transition disabled:opacity-50"
                >
                  {refundMutation.isPending ? "Refunding..." : "Confirm Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
