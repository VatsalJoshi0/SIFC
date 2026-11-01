import { create } from "zustand";

export interface UserSummary {
  userId: string;
  fullName: string;
  panMasked: string;
  vehicleCount: number;
}

export interface PendingOtpSession {
  sessionId: string;
  mobile: string;
  pan: string;
  expiresAt: string;
  simulatedOtp?: string;
}

interface SessionState {
  accessToken: string | null;
  user: UserSummary | null;
  pendingOtp: PendingOtpSession | null;
  lastActivity: number;
  simulatedOtpBanner: string | null;
  
  setAccessToken: (token: string | null) => void;
  setUser: (user: UserSummary | null) => void;
  setPendingOtp: (pending: PendingOtpSession | null) => void;
  setSimulatedOtpBanner: (otp: string | null) => void;
  updateActivity: () => void;
  clearSession: () => void;
}

const getInitialToken = (): string | null => {
  try {
    return localStorage.getItem("vai_citizen_token");
  } catch {
    return null;
  }
};

const getInitialUser = (): UserSummary | null => {
  try {
    const raw = localStorage.getItem("vai_citizen_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: getInitialToken(),
  user: getInitialUser(),
  pendingOtp: null,
  lastActivity: Date.now(),
  simulatedOtpBanner: null,

  setAccessToken: (token) => {
    try {
      if (token) {
        localStorage.setItem("vai_citizen_token", token);
      } else {
        localStorage.removeItem("vai_citizen_token");
      }
    } catch {}
    set({ accessToken: token, lastActivity: Date.now() });
  },
  setUser: (user) => {
    try {
      if (user) {
        localStorage.setItem("vai_citizen_user", JSON.stringify(user));
      } else {
        localStorage.removeItem("vai_citizen_user");
      }
    } catch {}
    set({ user, lastActivity: Date.now() });
  },
  setPendingOtp: (pending) => set({ pendingOtp: pending }),
  setSimulatedOtpBanner: (otp) => set({ simulatedOtpBanner: otp }),
  updateActivity: () => set({ lastActivity: Date.now() }),
  clearSession: () => {
    try {
      localStorage.removeItem("vai_citizen_token");
      localStorage.removeItem("vai_citizen_user");
    } catch {}
    set({ accessToken: null, user: null, pendingOtp: null, simulatedOtpBanner: null });
  },
}));
