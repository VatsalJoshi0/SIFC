import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { api, ReceiptItem } from "../../api/client";
import { formatCurrency, formatDateTime, formatBps, formatPpm } from "../../lib/formatting";

export const ReceiptPage: React.FC = () => {
  const { txnId } = useParams<{ txnId: string }>();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data: receipt, isLoading } = useQuery({
    queryKey: ["receipt", txnId],
    queryFn: () => api.transactions.getReceipt(txnId || "", "json") as Promise<ReceiptItem>,
    enabled: !!txnId,
  });

  if (isLoading || !receipt) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(receipt, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `receipt-${receipt.transactionId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDownloadPdf = async () => {
    if (!txnId) return;
    try {
      setDownloadingPdf(true);
      const blob = (await api.transactions.getReceipt(txnId, "pdf")) as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${txnId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download PDF receipt.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Top back button & download actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/transactions"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Transactions</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition min-h-[40px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition min-h-[40px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadingPdf ? "Generating..." : "Download PDF"}</span>
          </button>
        </div>
      </div>

      {/* Official Receipt Paper Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-10 space-y-6">
        {/* Receipt Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold">
                VAI
              </div>
              <span className="text-xl font-black text-slate-900 tracking-tight">
                National Compliance Receipt
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Vehicle Accountability Index • Ministry of Road Transport</p>
          </div>

          <div className="text-left sm:text-right text-xs text-slate-500 space-y-0.5">
            <p>
              <strong>Receipt No:</strong> <span className="font-mono text-slate-900">{receipt.receiptNumber}</span>
            </p>
            <p>
              <strong>Txn ID:</strong> <span className="font-mono text-slate-900">{receipt.transactionId}</span>
            </p>
            <p>
              <strong>Issued:</strong> {formatDateTime(receipt.issuedAt)}
            </p>
          </div>
        </div>

        {/* Citizen & Service Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Citizen Details</span>
            <span className="font-bold text-slate-900 block mt-1">{receipt.citizen.fullName}</span>
            <span className="font-mono text-xs text-slate-600 block">PAN: {receipt.citizen.panMasked}</span>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Service Details</span>
            <span className="font-bold text-slate-900 block mt-1">{receipt.service.serviceType} Renewal</span>
            <span className="text-xs text-slate-600 block">{receipt.service.description}</span>
          </div>
        </div>

        {/* Price Breakdown Details */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Financial Breakdown</h3>

          <div className="divide-y divide-slate-100 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600">Base Service Price</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatCurrency(receipt.breakdown.baseAmountPaise)}
              </span>
            </div>

            <div className="py-2.5 flex justify-between text-teal-700">
              <span>VAI Accountability Discount ({formatBps(receipt.breakdown.discountBps)})</span>
              <span className="font-mono font-bold">
                {receipt.breakdown.discountPaise > 0
                  ? `- ${formatCurrency(receipt.breakdown.discountPaise)}`
                  : "₹0.00"}
              </span>
            </div>

            <div className="py-2.5 flex justify-between text-emerald-700">
              <span>Government-Funded Incentive</span>
              <span className="font-mono font-semibold">
                {formatCurrency(receipt.breakdown.govtFundedPaise)}
              </span>
            </div>

            <div className="py-2.5 flex justify-between text-slate-600 text-xs">
              <span>Platform Service Fee ({formatPpm(receipt.breakdown.platformFeePpm)})</span>
              <span className="font-mono font-medium">
                {formatCurrency(receipt.breakdown.platformFeePaise)}
              </span>
            </div>

            <div className="py-3 flex justify-between items-center text-base font-black text-slate-900 border-t-2 border-slate-900 mt-2">
              <span>Net Amount Paid</span>
              <span className="text-xl font-mono">
                {formatCurrency(receipt.breakdown.totalPaidPaise)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Confirmation Footer */}
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <span className="font-bold block">Payment Confirmed ({receipt.payment.status})</span>
              <span className="text-[11px] text-emerald-800 font-mono">Ref: {receipt.payment.paymentRef}</span>
            </div>
          </div>

          <div className="text-left sm:text-right text-[11px] text-slate-500">
            Completed: {formatDateTime(receipt.payment.completedAt)}
          </div>
        </div>
      </div>
    </div>
  );
};
