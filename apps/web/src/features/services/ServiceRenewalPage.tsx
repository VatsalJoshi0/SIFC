import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  FileText,
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
} from "lucide-react";
import { api, ApiError } from "../../api/client";
import { PriceBreakdown, QuoteData } from "../../components/PriceBreakdown";
import { formatCurrency, formatDate } from "../../lib/formatting";

// Standard base prices from config (P8)
const SERVICE_BASE_PRICES: Record<string, { basePaise: number; label: string; period: string }> = {
  insurance: { basePaise: 1000000, label: "Four-Wheeler Motor Insurance", period: "+12 Months" },
  puc: { basePaise: 15000, label: "Pollution Under Control (PUC) Certificate", period: "+6 Months" },
  rc: { basePaise: 60000, label: "Registration Certificate (RC) Renewal", period: "+5 Years" },
  licence: { basePaise: 40000, label: "Driving Licence Renewal", period: "+5 Years" },
};

export const ServiceRenewalPage: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const queryClient = useQueryClient();

  const serviceTypeKey = (type || "insurance").toLowerCase();
  const serviceConfig = SERVICE_BASE_PRICES[serviceTypeKey] || SERVICE_BASE_PRICES.insurance;
  const upperServiceType = (serviceTypeKey === "licence" ? "LICENCE" : serviceTypeKey.toUpperCase()) as
    | "INSURANCE"
    | "PUC"
    | "RC"
    | "LICENCE";

  // Data fetching
  const { data: userData } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.users.getMe(),
  });

  const { data: vehicleData } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => api.vehicles.getVehicles(),
    enabled: upperServiceType !== "LICENCE",
  });

  const vehicles = vehicleData?.vehicles || [];
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  // Select first vehicle automatically
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].vehicleId);
    }
  }, [vehicles, selectedVehicleId]);

  // Quote State
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteTimeLeft, setQuoteTimeLeft] = useState(900); // 15 mins

  // Payment Simulator Modal State (P11)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [simulatedOutcome, setSimulatedOutcome] = useState<"SUCCESS" | "FAILURE" | "TIMEOUT">("SUCCESS");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [successfulTxn, setSuccessfulTxn] = useState<{ txnId: string; receiptUrl: string } | null>(null);

  // Quote countdown timer
  useEffect(() => {
    if (!quote) return;
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(quote.quoteExpiresAt).getTime() - Date.now()) / 1000)
      );
      setQuoteTimeLeft(remaining);
      if (remaining === 0) {
        setQuote(null);
        setQuoteError("Quote expired after 15 minutes. Please generate a fresh quote.");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [quote]);

  // Fetch / Generate Quote
  const handleGetQuote = async () => {
    setQuoteError(null);
    setSuccessfulTxn(null);
    try {
      setQuoteLoading(true);

      const payload = {
        serviceType: upperServiceType,
        baseAmountPaise: serviceConfig.basePaise,
        vehicleId: upperServiceType === "LICENCE" ? undefined : selectedVehicleId,
        licenceId: upperServiceType === "LICENCE" ? "LIC-PRIMARY" : undefined,
      };

      const res = await api.services.createQuote(payload);

      setQuote({
        quoteId: res.quoteId,
        quoteExpiresAt: res.quoteExpiresAt,
        vaiCategory: res.vaiCategory,
        discountBps: res.discountBps,
        breakdown: {
          ...res.breakdown,
          discountBps: res.discountBps,
        },
        platformFee: res.platformFee,
      });

      const remaining = Math.max(
        0,
        Math.floor((new Date(res.quoteExpiresAt).getTime() - Date.now()) / 1000)
      );
      setQuoteTimeLeft(remaining);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setQuoteError(err.message);
      } else {
        setQuoteError("Failed to generate quote. Please check your inputs.");
      }
    } finally {
      setQuoteLoading(false);
    }
  };

  // Submit Payment
  const handleConfirmPayment = async () => {
    if (!quote) return;
    setPaymentError(null);
    try {
      setPaymentLoading(true);

      // Generate deterministic / unique Idempotency-Key per click (P11)
      const idempotencyKey = `IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const res = await api.transactions.confirm({
        quoteId: quote.quoteId,
        simulatedOutcome,
        idempotencyKey,
      });

      if (res.status === "SUCCESS") {
        setSuccessfulTxn({ txnId: res.txnId, receiptUrl: res.receiptUrl });
        setShowPaymentModal(false);
        // Invalidate vehicles, score, transactions
        queryClient.invalidateQueries({ queryKey: ["vehicles"] });
        queryClient.invalidateQueries({ queryKey: ["score"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
      } else if (res.status === "TIMED_OUT") {
        setPaymentError("Payment timed out. Transaction marked for administrative reconciliation.");
      } else {
        setPaymentError("Payment failed as requested in simulation.");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setPaymentError(err.message);
      } else {
        setPaymentError("Transaction failed to process.");
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
            Official Compliance Renewal
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-2">
            {serviceConfig.label}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Validity Extension: <strong>{serviceConfig.period}</strong> from current expiry or today.
          </p>
        </div>

        {/* Service Type Switcher */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl">
          {(["insurance", "puc", "rc", "licence"] as const).map((s) => (
            <Link
              key={s}
              to={`/services/${s}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                serviceTypeKey === s
                  ? "bg-white text-teal-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* Step 1: Target Item Selection */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900">1. Select Vehicle / Document</h2>

        {upperServiceType === "LICENCE" ? (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm block">
                  Driving Licence: {userData?.licence?.licenceNoMasked || "GJ01-XXXX-4417"}
                </span>
                <span className="text-xs text-slate-500">
                  Class: {userData?.licence?.licenceClass || "LMV, MCWG"} • Expiry:{" "}
                  {formatDate(userData?.licence?.expiryDate || "2027-05-14")}
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Linked Citizen Document
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <label htmlFor="vehicleSelect" className="block text-sm font-semibold text-slate-700">
              Select Vehicle from your garage:
            </label>
            <select
              id="vehicleSelect"
              value={selectedVehicleId}
              onChange={(e) => {
                setSelectedVehicleId(e.target.value);
                setQuote(null);
              }}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base font-semibold text-slate-900 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200 min-h-[44px]"
            >
              {vehicles.map((v) => (
                <option key={v.vehicleId} value={v.vehicleId}>
                  {v.registrationNo} - {v.manufacturer} {v.model} ({v.vehicleType.replace("_", " ")})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={handleGetQuote}
            disabled={quoteLoading || (upperServiceType !== "LICENCE" && !selectedVehicleId)}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition shadow-sm min-h-[44px]"
          >
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span>{quoteLoading ? "Generating Locked Quote..." : "Generate 15-Minute Locked Quote"}</span>
          </button>
        </div>
      </section>

      {quoteError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <span>{quoteError}</span>
        </div>
      )}

      {/* Step 2: Quote & 5-Line Price Breakdown */}
      {quote && (
        <section className="space-y-6 animate-fadeIn">
          {/* Quote Expiry Banner */}
          <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between text-xs text-teal-900">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-700" />
              <span>
                Quote Locked: <strong className="font-mono text-sm">{quote.quoteId}</strong>
              </span>
            </div>
            <span className="font-bold">
              Expires in {Math.floor(quoteTimeLeft / 60)}:
              {quoteTimeLeft % 60 < 10 ? `0${quoteTimeLeft % 60}` : quoteTimeLeft % 60}
            </span>
          </div>

          {/* 5-Line Price Breakdown Component */}
          <PriceBreakdown
            breakdown={quote.breakdown}
            platformFee={quote.platformFee}
            vaiCategory={quote.vaiCategory}
          />

          {/* Proceed to Payment CTA */}
          <div className="flex items-center justify-end gap-4">
            <button
              onClick={() => setShowPaymentModal(true)}
              className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-md transition min-h-[48px]"
            >
              <span>Confirm & Pay {formatCurrency(quote.breakdown.payablePaise)}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </section>
      )}

      {/* Step 3: Success Confirmation State */}
      {successfulTxn && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 sm:p-8 space-y-5 text-center shadow-md animate-fadeIn">
          <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900">Renewal Completed Successfully!</h2>
            <p className="text-slate-600 text-sm">
              Your vehicle compliance status and registry records have been updated in real time.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 max-w-md mx-auto text-xs space-y-1 text-slate-600 font-mono">
            <p>
              <strong>Transaction ID:</strong> {successfulTxn.txnId}
            </p>
            <p>
              <strong>Validity Extension:</strong> {serviceConfig.period}
            </p>
            <p>
              <strong>Status:</strong> SUCCESS
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={`/transactions/${successfulTxn.txnId}`}
              className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl transition min-h-[44px]"
            >
              <FileText className="w-4 h-4" />
              <span>View Official Deterministic Receipt</span>
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold px-6 py-3 rounded-xl transition min-h-[44px]"
            >
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      )}

      {/* Simulated Payment Modal (TRD 13.1, P11) */}
      {showPaymentModal && quote && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-600" />
                <h3 className="text-lg font-bold text-slate-900">Simulated Payment Gateway</h3>
              </div>
              <span className="text-xs font-mono font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                Prototype Mode
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-sm text-slate-700">
              <div className="flex justify-between">
                <span>Service:</span>
                <strong className="text-slate-900">{serviceConfig.label}</strong>
              </div>
              <div className="flex justify-between">
                <span>Amount:</span>
                <strong className="text-slate-900 font-mono text-base">
                  {formatCurrency(quote.breakdown.payablePaise)}
                </strong>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Quote ID:</span>
                <span className="font-mono">{quote.quoteId}</span>
              </div>
            </div>

            {paymentError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-800 text-xs border border-red-200 flex items-center gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                <span>{paymentError}</span>
              </div>
            )}

            {/* QA Outcome Selector (TRD 13.1) */}
            <div className="space-y-2">
              <label htmlFor="outcome" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Simulated Gateway Outcome:
              </label>
              <select
                id="outcome"
                value={simulatedOutcome}
                onChange={(e) => setSimulatedOutcome(e.target.value as "SUCCESS" | "FAILURE" | "TIMEOUT")}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white text-slate-900"
              >
                <option value="SUCCESS">SUCCESS (Complete renewal & issue policy)</option>
                <option value="FAILURE">FAILURE (Simulate card decline or gateway drop)</option>
                <option value="TIMEOUT">TIMEOUT (Simulate network timeout for reconciliation)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={paymentLoading}
                onClick={handleConfirmPayment}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm disabled:opacity-60 min-h-[44px]"
              >
                <span>{paymentLoading ? "Processing..." : "Submit Payment"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
