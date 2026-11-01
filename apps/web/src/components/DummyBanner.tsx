import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, Key, ShieldCheck, User } from "lucide-react";
import { useSessionStore } from "../features/auth/sessionStore";

export const DummyBanner: React.FC = () => {
  const simulatedOtp = useSessionStore((state) => state.simulatedOtpBanner);
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <div
      role="banner"
      className="bg-amber-500 text-amber-950 px-4 py-1.5 text-xs sm:text-sm font-medium flex flex-wrap items-center justify-between gap-2 border-b border-amber-600 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-950" aria-hidden="true" />
        <span>
          <strong>Prototype Mode:</strong> Simulated OTP & datasets active.
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {simulatedOtp && (
          <div className="flex items-center gap-1.5 bg-amber-100/90 text-amber-950 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-amber-400">
            <Key className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Demo OTP: <strong className="font-mono text-xs tracking-wider">{simulatedOtp}</strong></span>
          </div>
        )}

        {isAdmin ? (
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 font-bold text-amber-950 hover:underline bg-amber-400/80 hover:bg-amber-400 px-2.5 py-0.5 rounded border border-amber-600/40 text-xs transition"
          >
            <User className="w-3 h-3" />
            <span>Citizen Portal</span>
          </Link>
        ) : (
          <Link
            to="/admin/dashboard"
            className="inline-flex items-center gap-1 font-bold text-amber-950 hover:underline bg-amber-400/80 hover:bg-amber-400 px-2.5 py-0.5 rounded border border-amber-600/40 text-xs transition"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Admin Portal</span>
          </Link>
        )}
      </div>
    </div>
  );
};
