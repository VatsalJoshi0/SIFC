import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { DummyBanner } from "./DummyBanner";
import { useSessionStore } from "../features/auth/sessionStore";
import { api } from "../api/client";
import { LogOut, User, Shield } from "lucide-react";

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, clearSession } = useSessionStore();

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    clearSession();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <DummyBanner />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Mobile Brand */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">VAI</span>
          </Link>
        </div>

        {/* Desktop title / filler */}
        <div className="hidden lg:block">
          <span className="text-sm font-medium text-slate-500">
            Citizen Accountability & Compliance Dashboard
          </span>
        </div>

        {/* Right side user info & logout */}
        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 py-1.5 px-3 rounded-full text-sm">
              <User className="w-4 h-4 text-slate-600" aria-hidden="true" />
              <span className="font-semibold text-slate-800">{user.fullName}</span>
              <span className="font-mono text-xs text-slate-500 hidden sm:inline">
                ({user.panMasked})
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[44px]"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="text-sm font-bold text-teal-700 hover:text-teal-800 px-4 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 min-h-[44px] flex items-center"
          >
            Citizen Sign In
          </Link>
        )}
      </div>
    </header>
  );
};
