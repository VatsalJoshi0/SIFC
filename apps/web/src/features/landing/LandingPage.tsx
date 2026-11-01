import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Award, FileCheck, ArrowRight, Zap, CheckCircle2 } from "lucide-react";
import { DummyBanner } from "../../components/DummyBanner";
import { useSessionStore } from "../auth/sessionStore";

// The 10 seed target profiles from PRD 18.2 / P4
const DEMO_PROFILES = [
  { id: "U001", name: "Priya Sharma", mobile: "+91 90000 00001", pan: "DUMMY1001X", tag: "765 Very Good (0 challans, full compliance)" },
  { id: "U002", name: "Rajesh Patel", mobile: "+91 90000 00002", pan: "DUMMY1002X", tag: "742 Good (3 paid LOW challans)" },
  { id: "U003", name: "Vikram Singh", mobile: "+91 90000 00003", pan: "DUMMY1003X", tag: "591 Fair (frequent repeat violations)" },
  { id: "U004", name: "Ananya Iyer", mobile: "+91 90000 00004", pan: "DUMMY1004X", tag: "634 Fair (2 HIGH challans, expired docs)" },
  { id: "U005", name: "Mohammed Khan", mobile: "+91 90000 00005", pan: "DUMMY1005X", tag: "630 Fair (4 unpaid past-due challans)" },
  { id: "U006", name: "Sunita Verma", mobile: "+91 90000 00006", pan: "DUMMY1006X", tag: "765 Very Good (clean 180-day streak)" },
  { id: "U007", name: "Gurpreet Singh", mobile: "+91 90000 00007", pan: "DUMMY1007X", tag: "726 Good (commercial fleet, 1 expired PUC)" },
  { id: "U008", name: "Deepak Joshi", mobile: "+91 90000 00008", pan: "DUMMY1008X", tag: "715 Good (new account starts at 700)" },
  { id: "U009", name: "Kavita Reddy", mobile: "+91 90000 00009", pan: "DUMMY1009X", tag: "669 Good (expired insurance & PUC)" },
  { id: "U010", name: "Amitabh Das", mobile: "+91 90000 00010", pan: "DUMMY1010X", tag: "725 Good (2 disputed, 1 pending challan)" },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const setPendingOtp = useSessionStore((s) => s.setPendingOtp);

  const handleQuickDemoSelect = (p: typeof DEMO_PROFILES[0]) => {
    const cleanMobile = p.mobile.replace(/\s+/g, "");
    setPendingOtp({
      sessionId: "",
      mobile: cleanMobile,
      pan: p.pan,
      expiresAt: "",
    });
    navigate(`/login?mobile=${encodeURIComponent(cleanMobile)}&pan=${encodeURIComponent(p.pan)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <DummyBanner />

      {/* Hero Section */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-black text-slate-900 tracking-tight">VAI</span>
              <span className="text-xs text-slate-500 block">Vehicle Accountability Index</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin/login"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition"
            >
              Admin Portal
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm min-h-[44px]"
            >
              <span>Citizen Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-16 sm:py-24 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold bg-teal-50 text-teal-800 border border-teal-200">
              <Zap className="w-4 h-4 text-teal-600" />
              National Driving Accountability Platform
            </span>

            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Fair Driving. Real Accountability. Transparent Rewards.
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              VAI transforms your traffic compliance, payment timeliness, and vehicle document status
              into an objective score from <strong>500 to 900 (base 700)</strong>, unlocking direct discounts
              on insurance, PUC, RC, and licence renewals.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-lg font-bold px-8 py-3.5 rounded-xl shadow-md transition-colors min-h-[48px]"
              >
                <span>Check Your VAI Score</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* 3 Core Pillars */}
        <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-center text-slate-900 mb-12">
            The Three Pillars of Vehicle Accountability
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Immutable Ledger</h3>
              <p className="text-slate-600 text-base leading-relaxed">
                Every single point change is explained in plain language in an append-only ledger. No hidden algorithms.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Direct Renewal Savings</h3>
              <p className="text-slate-600 text-base leading-relaxed">
                Maintain a Good (650+) or Very Good (750+) score to receive up to 2.00% off insurance and mandatory vehicle renewals.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Clear Fee Transparency</h3>
              <p className="text-slate-600 text-base leading-relaxed">
                Platform fees (50 ppm / 100 ppm) are stated openly as a separate line item. Never buried in fine print.
              </p>
            </div>
          </div>
        </section>

        {/* Quick Demo Personas Selector */}
        <section className="py-12 bg-slate-100/70 border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Prototype Demo Personas</h2>
              <p className="text-slate-600 text-sm mt-1">
                Select any seeded dummy profile to auto-fill login details and explore end-to-end functionality.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DEMO_PROFILES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleQuickDemoSelect(p)}
                  className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-500 hover:shadow-sm text-left transition-all group min-h-[44px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 group-hover:text-teal-700">
                      {p.name}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {p.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-1">{p.tag}</p>
                  <div className="text-xs font-mono text-slate-500 mt-2 flex justify-between">
                    <span>{p.mobile}</span>
                    <span>{p.pan}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-6 text-center text-sm border-t border-slate-800">
        <p>VAI Prototype – Designed for Government, Insurer, and Citizen Transparency (DPDP Act 2023 Compliant).</p>
      </footer>
    </div>
  );
};
