import React from "react";
import { Outlet, NavLink, useNavigate, Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  CreditCard,
  Sliders,
  FileText,
  Database,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAdminSessionStore } from "../features/admin/adminSessionStore";
import { DummyBanner } from "../components/DummyBanner";

export const AdminLayout: React.FC = () => {
  const { adminUser, isAuthenticated, clearAdminSession } = useAdminSessionStore();
  const navigate = useNavigate();

  if (!isAuthenticated || !adminUser) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = () => {
    clearAdminSession();
    navigate("/admin/login");
  };

  const navItems = [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/disputes", label: "Disputes Queue", icon: AlertTriangle },
    { to: "/admin/citizens", label: "Citizens & Fleet", icon: Users },
    { to: "/admin/transactions", label: "Transactions & Refunds", icon: CreditCard },
    { to: "/admin/governance", label: "Governance & Policies", icon: Sliders },
    { to: "/admin/audit", label: "Audit Logs & Export", icon: FileText },
    { to: "/admin/system", label: "System Maintenance", icon: Database },
  ];

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: "bg-purple-100 text-purple-800 border-purple-300",
    OPS: "bg-blue-100 text-blue-800 border-blue-300",
    ANALYST: "bg-emerald-100 text-emerald-800 border-emerald-300",
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <DummyBanner />

      {/* Top Admin Navbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">VAI Admin Governance</span>
              <span className="hidden sm:inline-block ml-2 text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                Portal v1.0
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-slate-400">{adminUser.email}</div>
              <span
                className={`inline-block text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${
                  roleColors[adminUser.role] || "bg-gray-100 text-gray-800"
                }`}
              >
                {adminUser.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition"
              title="Sign out of Admin Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Sub-header Navigation Links */}
        <div className="bg-slate-800 border-t border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 overflow-x-auto py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition ${
                      isActive
                        ? "bg-slate-900 text-indigo-400 font-semibold shadow-inner"
                        : "text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* Admin Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-4 border-t border-slate-800 text-center">
        Vehicle Accountability Index (VAI) • Ministry of Road Transport and Highways (MoRTH) Prototype
      </footer>
    </div>
  );
};
