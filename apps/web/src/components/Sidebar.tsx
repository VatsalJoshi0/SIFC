import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Gauge,
  Car,
  FileText,
  Gift,
  Receipt,
  User,
  Shield,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { name: "VAI Score", to: "/score", icon: Gauge },
  { name: "My Vehicles", to: "/vehicles", icon: Car },
  { name: "Challans", to: "/challans", icon: FileText },
  { name: "Rewards", to: "/rewards", icon: Gift },
  { name: "Transactions", to: "/transactions", icon: Receipt },
  { name: "Profile", to: "/profile", icon: User },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-white flex-shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-md">
          <Shield className="w-6 h-6 text-slate-950" />
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight block">VAI</span>
          <span className="text-xs text-slate-400 block -mt-1">Vehicle Accountability Index</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5" aria-label="Citizen Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-base transition-colors min-h-[44px] ${
                  isActive
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
        <p className="font-semibold text-slate-300">National Compliance Portal</p>
        <p className="mt-0.5">DPDP Act 2023 Compliant</p>
        <p className="mt-0.5 text-slate-500">v1.0.0 (Prototype)</p>
      </div>
    </aside>
  );
};
