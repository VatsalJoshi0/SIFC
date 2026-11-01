import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { BottomNav } from "../components/BottomNav";
import { IdleTimer } from "../components/IdleTimer";
import { useSessionStore } from "../features/auth/sessionStore";

export const CitizenLayout: React.FC = () => {
  const { accessToken } = useSessionStore();
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <IdleTimer />
      <div className="flex flex-1">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-24 lg:pb-8">
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};
