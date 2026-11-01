import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Gauge,
  Car,
  FileText,
  User,
} from "lucide-react";

const MOBILE_ITEMS = [
  { name: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { name: "Score", to: "/score", icon: Gauge },
  { name: "Vehicles", to: "/vehicles", icon: Car },
  { name: "Challans", to: "/challans", icon: FileText },
  { name: "Profile", to: "/profile", icon: User },
];

export const BottomNav: React.FC = () => {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-2 py-1 shadow-lg pb-[env(safe-area-inset-bottom,0.5rem)]"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="flex items-center justify-around">
        {MOBILE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-xs font-semibold min-w-[56px] min-h-[48px] transition-colors ${
                  isActive
                    ? "text-teal-700 bg-teal-50"
                    : "text-slate-600 hover:text-slate-900"
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" aria-hidden="true" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
