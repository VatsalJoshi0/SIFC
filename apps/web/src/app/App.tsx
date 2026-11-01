import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CitizenLayout } from "./CitizenLayout";
import { AdminLayout } from "./AdminLayout";

// Citizen Pages
import { LandingPage } from "../features/landing/LandingPage";
import { LoginPage } from "../features/auth/LoginPage";
import { VerifyOtpPage } from "../features/auth/VerifyOtpPage";
import { ConsentPage } from "../features/consent/ConsentPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { ScorePage } from "../features/score/ScorePage";
import { VehiclesPage } from "../features/vehicles/VehiclesPage";
import { VehicleDetailPage } from "../features/vehicles/VehicleDetailPage";
import { ChallansPage } from "../features/challans/ChallansPage";
import { RewardsPage } from "../features/rewards/RewardsPage";
import { ServiceRenewalPage } from "../features/services/ServiceRenewalPage";
import { TransactionsPage } from "../features/transactions/TransactionsPage";
import { ReceiptPage } from "../features/transactions/ReceiptPage";
import { ProfilePage } from "../features/profile/ProfilePage";

// Admin Pages
import { AdminLoginPage } from "../features/admin/pages/AdminLoginPage";
import { AdminDashboardPage } from "../features/admin/pages/AdminDashboardPage";
import { AdminDisputesPage } from "../features/admin/pages/AdminDisputesPage";
import { AdminCitizensPage } from "../features/admin/pages/AdminCitizensPage";
import { AdminTransactionsPage } from "../features/admin/pages/AdminTransactionsPage";
import { AdminGovernancePage } from "../features/admin/pages/AdminGovernancePage";
import { AdminAuditPage } from "../features/admin/pages/AdminAuditPage";
import { AdminSystemPage } from "../features/admin/pages/AdminSystemPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Citizen Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify" element={<VerifyOtpPage />} />
          <Route path="/consent" element={<ConsentPage />} />

          {/* Authenticated Citizen Routes */}
          <Route element={<CitizenLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/score" element={<ScorePage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/vehicles/:regNo" element={<VehicleDetailPage />} />
            <Route path="/challans" element={<ChallansPage />} />
            <Route path="/rewards" element={<RewardsPage />} />
            <Route path="/services/:type" element={<ServiceRenewalPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/transactions/:txnId" element={<ReceiptPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="disputes" element={<AdminDisputesPage />} />
            <Route path="citizens" element={<AdminCitizensPage />} />
            <Route path="transactions" element={<AdminTransactionsPage />} />
            <Route path="governance" element={<AdminGovernancePage />} />
            <Route path="audit" element={<AdminAuditPage />} />
            <Route path="system" element={<AdminSystemPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
