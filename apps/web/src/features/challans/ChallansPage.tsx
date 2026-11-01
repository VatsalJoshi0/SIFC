import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Filter,
  AlertTriangle,
  ChevronRight,
  Send,
  X,
} from "lucide-react";
import { api, ChallanItem, ApiError } from "../../api/client";
import { formatDate, formatCurrency } from "../../lib/formatting";

export const ChallansPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // Dispute modal state
  const [disputingChallan, setDisputingChallan] = useState<ChallanItem | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["challans", statusFilter, severityFilter, cursor],
    queryFn: () =>
      api.challans.getChallans({
        status: statusFilter,
        severity: severityFilter,
        cursor,
        limit: 15,
      }),
    staleTime: 60000,
  });

  const disputeMutation = useMutation({
    mutationFn: ({ challanId, reason }: { challanId: string; reason: string }) =>
      api.challans.disputeChallan(challanId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challans"] });
      setDisputingChallan(null);
      setDisputeReason("");
      setDisputeError(null);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setDisputeError(err.message);
      } else {
        setDisputeError("Failed to submit dispute. Please try again.");
      }
    },
  });

  const handleOpenDispute = (c: ChallanItem) => {
    setDisputingChallan(c);
    setDisputeReason("");
    setDisputeError(null);
  };

  const handleDisputeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputingChallan || !disputeReason.trim()) return;
    disputeMutation.mutate({
      challanId: disputingChallan.challanId,
      reason: disputeReason.trim(),
    });
  };

  const challans = data?.challans || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Traffic Challans & Disputes</h1>
        <p className="text-slate-600 text-base mt-1">
          Review traffic notices, track payment due dates, and submit formal disputes for incorrect violations.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500 font-semibold text-sm">
          <Filter className="w-4 h-4 text-teal-600" />
          <span>Filters:</span>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="statusFilter" className="text-xs font-semibold text-slate-600">
            Status:
          </label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCursor(undefined);
            }}
            className="text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-800 focus:ring-2 focus:ring-teal-200"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending (Notice)</option>
            <option value="DISPUTED">Disputed</option>
            <option value="WAIVED">Waived</option>
          </select>
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="severityFilter" className="text-xs font-semibold text-slate-600">
            Severity:
          </label>
          <select
            id="severityFilter"
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setCursor(undefined);
            }}
            className="text-sm bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-800 focus:ring-2 focus:ring-teal-200"
          >
            <option value="ALL">All Severities</option>
            <option value="LOW">Low (5 pts)</option>
            <option value="MEDIUM">Medium (15 pts)</option>
            <option value="HIGH">High (30 pts)</option>
          </select>
        </div>
      </div>

      {/* Challans List */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading challan records...
          </div>
        ) : challans.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-base font-semibold text-slate-700">No challans found</p>
            <p className="text-sm text-slate-500 mt-0.5">Try adjusting your filters above.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Challan ID / Date</th>
                    <th scope="col" className="px-5 py-3.5">Violation</th>
                    <th scope="col" className="px-5 py-3.5">Severity</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Amount</th>
                    <th scope="col" className="px-5 py-3.5">Status</th>
                    <th scope="col" className="px-5 py-3.5">Due Date</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {challans.map((c) => {
                    const isOverdue = c.status === "UNPAID" && new Date(c.dueDate) < new Date("2026-10-30");
                    const canDispute = c.status === "PENDING" || c.status === "UNPAID";

                    return (
                      <tr key={c.challanId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-slate-900 block">
                            {c.challanId}
                          </span>
                          <span className="text-xs text-slate-500">{formatDate(c.challanDate)}</span>
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-900 block">{c.violationDesc}</span>
                          <span className="text-xs text-slate-400 font-mono">Code: {c.violationCode}</span>
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              c.severity === "HIGH"
                                ? "bg-red-100 text-red-800 border border-red-200"
                                : c.severity === "MEDIUM"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-blue-100 text-blue-800 border border-blue-200"
                            }`}
                          >
                            {c.severity}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(c.amountPaise)}
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              c.status === "PAID"
                                ? "bg-green-100 text-green-800"
                                : c.status === "UNPAID"
                                ? "bg-red-100 text-red-800"
                                : c.status === "DISPUTED"
                                ? "bg-purple-100 text-purple-800"
                                : c.status === "WAIVED"
                                ? "bg-slate-100 text-slate-600 line-through"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap text-xs">
                          <span className={isOverdue ? "text-red-700 font-bold" : "text-slate-600"}>
                            {formatDate(c.dueDate)}
                          </span>
                          {isOverdue && <span className="block text-[11px] text-red-600 font-semibold">Overdue</span>}
                          {c.paymentDate && (
                            <span className="block text-[11px] text-emerald-700">
                              Paid {formatDate(c.paymentDate)}
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          {canDispute ? (
                            <button
                              onClick={() => handleOpenDispute(c)}
                              className="text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-200 transition min-h-[36px]"
                            >
                              Dispute
                            </button>
                          ) : c.status === "DISPUTED" ? (
                            <span className="text-xs text-purple-700 font-medium">Under Review</span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (< 768px per TRD 4.5) */}
            <div className="md:hidden divide-y divide-slate-100">
              {challans.map((c) => {
                const isOverdue = c.status === "UNPAID" && new Date(c.dueDate) < new Date("2026-10-30");
                const canDispute = c.status === "PENDING" || c.status === "UNPAID";

                return (
                  <div key={c.challanId} className="p-4 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900 block">
                          {c.challanId}
                        </span>
                        <span className="text-xs text-slate-500">{formatDate(c.challanDate)}</span>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          c.status === "PAID"
                            ? "bg-green-100 text-green-800"
                            : c.status === "UNPAID"
                            ? "bg-red-100 text-red-800"
                            : c.status === "DISPUTED"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div className="text-sm font-semibold text-slate-900">{c.violationDesc}</div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">
                        Severity: <strong>{c.severity}</strong> • Due: {formatDate(c.dueDate)}
                        {isOverdue && <span className="text-red-600 font-bold ml-1">(Overdue)</span>}
                      </span>
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {formatCurrency(c.amountPaise)}
                      </span>
                    </div>

                    {canDispute && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleOpenDispute(c)}
                          className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 min-h-[44px]"
                        >
                          Dispute Challan
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {data?.pagination.hasMore && (
              <div className="p-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setCursor(data.pagination.nextCursor || undefined)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm min-h-[44px]"
                >
                  <span>Load more challans</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Citizen Dispute Modal (P7) */}
      {disputingChallan && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-bold text-slate-900">Dispute Traffic Challan</h3>
              </div>
              <button
                onClick={() => setDisputingChallan(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-1 text-slate-600">
              <p>
                <strong>Challan ID:</strong> <span className="font-mono">{disputingChallan.challanId}</span>
              </p>
              <p>
                <strong>Violation:</strong> {disputingChallan.violationDesc} ({disputingChallan.violationCode})
              </p>
              <p>
                <strong>Fine Amount:</strong> {formatCurrency(disputingChallan.amountPaise)}
              </p>
            </div>

            {disputeError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-800 text-xs border border-red-200">
                {disputeError}
              </div>
            )}

            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div>
                <label htmlFor="reason" className="block text-sm font-semibold text-slate-700 mb-1">
                  Reason for Dispute
                </label>
                <textarea
                  id="reason"
                  required
                  rows={4}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Provide concrete reasons (e.g. incorrect number plate captured, emergency vehicle clearance, already paid receipt)..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputingChallan(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeMutation.isPending || !disputeReason.trim()}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm disabled:opacity-60 min-h-[44px]"
                >
                  <Send className="w-4 h-4" />
                  <span>{disputeMutation.isPending ? "Submitting..." : "Submit Dispute"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
