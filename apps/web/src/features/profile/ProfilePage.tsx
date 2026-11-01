import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { api } from "../../api/client";
import { formatDate } from "../../lib/formatting";
import { useSessionStore } from "../auth/sessionStore";

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clearSession } = useSessionStore();

  const [savingConsent, setSavingConsent] = useState(false);
  const [consentSuccess, setConsentSuccess] = useState(false);

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.users.getMe(),
  });

  const { data: consentData } = useQuery({
    queryKey: ["consents"],
    queryFn: () => api.consents.getConsents(),
  });

  const handleTogglePartnerConsent = async () => {
    if (!consentData?.consents) return;
    const currentRecord = consentData.consents.find((c) => c.purpose === "REWARD_DISCOUNT");
    const currentVal = currentRecord ? currentRecord.granted : true;
    try {
      setSavingConsent(true);
      await api.consents.updateConsents([
        { purpose: "IDENTITY_VERIFICATION", granted: true },
        { purpose: "VAI_SCORING", granted: true },
        { purpose: "REWARD_DISCOUNT", granted: !currentVal },
      ]);
      queryClient.invalidateQueries({ queryKey: ["consents"] });
      setConsentSuccess(true);
      setTimeout(() => setConsentSuccess(false), 3000);
    } catch {
      alert("Failed to update consent preferences.");
    } finally {
      setSavingConsent(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    clearSession();
    navigate("/login");
  };

  if (userLoading || !userData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const partnerOffersGranted =
    consentData?.consents.find((c) => c.purpose === "REWARD_DISCOUNT")?.granted ?? true;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Citizen Profile & Privacy</h1>
        <p className="text-slate-600 text-base mt-1">
          Review your verified identity credentials, linked documents, and DPDP consent settings.
        </p>
      </div>

      {/* Citizen Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-2xl">
            {userData.fullName.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{userData.fullName}</h2>
            <p className="text-sm text-slate-500 font-mono">
              Account ID: {userData.userId} • Registered {formatDate(userData.registrationDate)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">
              Permanent Account Number (PAN)
            </span>
            <span className="text-base font-mono font-bold text-slate-900 block">
              {userData.panMasked}
            </span>
            <span className="text-xs text-slate-500 block">Masked per RBI and DPDP standards (P2)</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">
              Mobile Number
            </span>
            <span className="text-base font-mono font-bold text-slate-900 block">
              {userData.mobileMasked}
            </span>
            <span className="text-xs text-slate-500 block">Verified via simulated OTP</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">
              Jurisdiction / Residence
            </span>
            <span className="text-base font-bold text-slate-900 block">
              {userData.city}, {userData.state}
            </span>
            <span className="text-xs text-slate-500 block">Regional Transport Office (RTO) Zone</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">
              Driving Licence
            </span>
            <span className="text-base font-mono font-bold text-slate-900 block">
              {userData.licence?.licenceNoMasked || "GJ01-XXXX-4417"}
            </span>
            <span className="text-xs text-slate-500 block">
              Class: {userData.licence?.licenceClass || "LMV, MCWG"} • Valid till:{" "}
              {formatDate(userData.licence?.expiryDate || "2027-05-14")}
            </span>
          </div>
        </div>
      </div>

      {/* DPDP Act 2023 Consent Management */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">DPDP Act 2023 Consent Management</h2>
          </div>
          <span className="text-xs font-mono text-slate-400">Notice: DPDP-V1</span>
        </div>

        {consentSuccess && (
          <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span>Consent preferences updated successfully.</span>
          </div>
        )}

        <div className="space-y-4 text-sm">
          {/* Mandatory Purposes */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-900 block">Identity & Scoring Processing</span>
              <p className="text-xs text-slate-500 mt-0.5">
                Essential for computing your VAI score, transparent ledger tracking, and vehicle verification.
              </p>
            </div>
            <span className="text-xs font-bold uppercase text-slate-600 bg-slate-200 px-2.5 py-1 rounded">
              Active (Mandatory)
            </span>
          </div>

          {/* Optional Partner Offers Toggle */}
          <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/40 flex items-center justify-between">
            <div className="pr-4">
              <span className="font-bold text-slate-900 block">Partner Offers & Renewal Discounts</span>
              <p className="text-xs text-slate-600 mt-0.5">
                Allows certified insurers and testing centers to verify your Good/Very Good category to apply instant discounts.
              </p>
            </div>

            <button
              onClick={handleTogglePartnerConsent}
              disabled={savingConsent}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition min-h-[44px] ${
                partnerOffersGranted
                  ? "bg-teal-600 text-white hover:bg-teal-700"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              {savingConsent ? "Updating..." : partnerOffersGranted ? "Granted (Enabled)" : "Withdrawn (Disabled)"}
            </button>
          </div>
        </div>
      </section>

      {/* Sign Out Action */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold px-6 py-3 rounded-xl border border-red-200 transition min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Citizen Session</span>
        </button>
      </div>
    </div>
  );
};
