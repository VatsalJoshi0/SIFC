import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Check, ArrowRight, AlertCircle, FileText } from "lucide-react";
import { DummyBanner } from "../../components/DummyBanner";
import { api, ApiError } from "../../api/client";

export const ConsentPage: React.FC = () => {
  const navigate = useNavigate();

  // DPDP Act 2023 Consent purposes
  const [partnerOffers, setPartnerOffers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGrantConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      await api.consents.updateConsents([
        { purpose: "IDENTITY_VERIFICATION", granted: true },
        { purpose: "VAI_SCORING", granted: true },
        { purpose: "REWARD_DISCOUNT", granted: partnerOffers },
      ]);

      navigate("/dashboard");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to record consent. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <DummyBanner />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Citizen Data Consent Notice</h1>
              <p className="text-sm text-slate-500">Digital Personal Data Protection (DPDP) Act, 2023</p>
            </div>
          </div>

          <p className="text-slate-600 text-base leading-relaxed">
            Before proceeding to your dashboard, please review and confirm the purposes for which your data is processed.
            VAI is built on principles of minimal data collection, strict masking, and zero data resale.
          </p>

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Purpose 1 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-base">Identity & Driving Records Verification</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase bg-slate-200 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Cross-referencing your masked PAN with official vehicle ownership and driving licence validity.
                </p>
              </div>
            </div>

            {/* Purpose 2 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-base">Challan History & Document Compliance</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase bg-slate-200 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Querying traffic violation history and expiration dates for Insurance, PUC, and RC from registry sources.
                </p>
              </div>
            </div>

            {/* Purpose 3 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-base">Transparent VAI Scoring & Public Ledger</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase bg-slate-200 px-2 py-0.5 rounded">
                    Mandatory
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Computing your 500–900 index and recording all point adjustments in an append-only, auditable ledger.
                </p>
              </div>
            </div>

            {/* Purpose 4 - Optional */}
            <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/40 flex items-start gap-3">
              <input
                id="partner-offers"
                type="checkbox"
                checked={partnerOffers}
                onChange={(e) => setPartnerOffers(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
              />
              <label htmlFor="partner-offers" className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-base">Partner Discounts & Renewal Notifications</span>
                  <span className="text-xs font-semibold text-teal-800 uppercase bg-teal-100 px-2 py-0.5 rounded">
                    Optional
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Permit certified insurers and PUC centers to apply Good Driver discount tiers to your renewal quotes. You can withdraw this at any time in Profile.
                </p>
              </label>
            </div>
          </div>

          <form onSubmit={handleGrantConsent} className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-400" />
              Notice Version: DPDP-V1-20261030
            </span>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-60 text-white text-base font-bold px-8 py-3.5 rounded-xl shadow-sm transition min-h-[48px]"
            >
              <span>{loading ? "Recording..." : "I Consent & Proceed"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
