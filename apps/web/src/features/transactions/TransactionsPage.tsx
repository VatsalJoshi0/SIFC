import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Receipt, FileText, ChevronRight } from "lucide-react";
import { api } from "../../api/client";
import { formatCurrency, formatDateTime } from "../../lib/formatting";

export const TransactionsPage: React.FC = () => {
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", cursor],
    queryFn: () => api.transactions.getTransactions({ cursor, limit: 15 }),
    staleTime: 60000,
  });

  const transactions = data?.transactions || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Transaction History</h1>
        <p className="text-slate-600 text-base mt-1">
          Complete record of renewals, applied accountability discounts, and deterministic official receipts.
        </p>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-base font-semibold text-slate-700">No transactions recorded</p>
            <p className="text-sm text-slate-500 mt-0.5">
              Renewals completed on the platform will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Transaction ID / Date</th>
                    <th scope="col" className="px-5 py-3.5">Service</th>
                    <th scope="col" className="px-5 py-3.5">VAI Tier</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Base Amount</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Discount</th>
                    <th scope="col" className="px-5 py-3.5 text-right">User Paid</th>
                    <th scope="col" className="px-5 py-3.5">Status</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((t) => (
                    <tr key={t.txnId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-900 block">
                          {t.txnId}
                        </span>
                        <span className="text-xs text-slate-500">{formatDateTime(t.createdAt)}</span>
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-900 whitespace-nowrap">
                        {t.serviceType}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            t.vaiCategoryAtTxn === "VERY_GOOD"
                              ? "bg-green-100 text-green-800"
                              : t.vaiCategoryAtTxn === "GOOD"
                              ? "bg-teal-100 text-teal-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {t.vaiCategoryAtTxn.replace("_", " ")}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right font-mono text-slate-600 whitespace-nowrap">
                        {formatCurrency(t.baseAmountPaise)}
                      </td>

                      <td className="px-5 py-4 text-right font-mono font-bold text-teal-700 whitespace-nowrap">
                        {t.discountPaise > 0 ? `-${formatCurrency(t.discountPaise)}` : "₹0.00"}
                      </td>

                      <td className="px-5 py-4 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                        {formatCurrency(t.payablePaise)}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            t.status === "SUCCESS"
                              ? "bg-green-100 text-green-800"
                              : t.status === "FAILED"
                              ? "bg-red-100 text-red-800"
                              : t.status === "TIMED_OUT"
                              ? "bg-amber-100 text-amber-800"
                              : t.status === "REFUNDED"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {t.status === "SUCCESS" ? (
                          <Link
                            to={`/transactions/${t.txnId}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-200 transition min-h-[36px]"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards (< 768px per TRD 4.5) */}
            <div className="md:hidden divide-y divide-slate-100">
              {transactions.map((t) => (
                <div key={t.txnId} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900 block">{t.txnId}</span>
                      <span className="text-xs text-slate-500">{formatDateTime(t.createdAt)}</span>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        t.status === "SUCCESS"
                          ? "bg-green-100 text-green-800"
                          : t.status === "FAILED"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm font-semibold text-slate-900">
                    <span>{t.serviceType}</span>
                    <span className="text-base font-bold font-mono">{formatCurrency(t.payablePaise)}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>
                      Base: {formatCurrency(t.baseAmountPaise)} • Save: {formatCurrency(t.discountPaise)}
                    </span>
                    {t.status === "SUCCESS" && (
                      <Link
                        to={`/transactions/${t.txnId}`}
                        className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 min-h-[44px] flex items-center"
                      >
                        Receipt
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {data?.pagination.hasMore && (
              <div className="p-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setCursor(data.pagination.nextCursor || undefined)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm min-h-[44px]"
                >
                  <span>Load more transactions</span>
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
