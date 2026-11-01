import { create } from "zustand";

export interface AdminUser {
  adminId: string;
  email: string;
  name?: string;
  role: "SUPER_ADMIN" | "OPS" | "ANALYST";
}

interface AdminSessionState {
  adminToken: string | null;
  adminUser: AdminUser | null;
  setAdminSession: (token: string, user: AdminUser) => void;
  clearAdminSession: () => void;
  isAuthenticated: boolean;
}

export const useAdminSessionStore = create<AdminSessionState>((set) => ({
  adminToken: localStorage.getItem("vai_admin_token"),
  adminUser: localStorage.getItem("vai_admin_user")
    ? JSON.parse(localStorage.getItem("vai_admin_user")!)
    : null,
  isAuthenticated: !!localStorage.getItem("vai_admin_token"),
  setAdminSession: (token, user) => {
    localStorage.setItem("vai_admin_token", token);
    localStorage.setItem("vai_admin_user", JSON.stringify(user));
    set({ adminToken: token, adminUser: user, isAuthenticated: true });
  },
  clearAdminSession: () => {
    localStorage.removeItem("vai_admin_token");
    localStorage.removeItem("vai_admin_user");
    set({ adminToken: null, adminUser: null, isAuthenticated: false });
  },
}));
