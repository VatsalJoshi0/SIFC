import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Shield, ArrowRight, AlertCircle, Clock, RotateCw, CheckCircle2 } from "lucide-react";
import { DummyBanner } from "../../components/DummyBanner";
import { api, ApiError } from "../../api/client";
import { useSessionStore } from "./sessionStore";

export const VerifyOtpPage: React.FC = () => {
  const navigate = useNavigate();
  const { pendingOtp, setAccessToken, setUser, setSimulatedOtpBanner } = useSessionStore();

  const [otp, setOtp] = useState(pendingOtp?.simulatedOtp || "482913");
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [resendCooldown, setResendCooldown] = useState(30); // 30s
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If no pending OTP session, redirect back to login
  useEffect(() => {
    if (!pendingOtp?.sessionId) {
      navigate("/login");
    }
  }, [pendingOtp, navigate]);

  // Expiry countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Resend cooldown countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingOtp?.sessionId) return;
    setError(null);

    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }

    try {
      setLoading(true);
      const res = await api.auth.verifyOtp(pendingOtp.sessionId, otp);

      // Store access token in memory
      setAccessToken(res.accessToken);
      setUser(res.user);

      // Check if consent has already been granted
      try {
        const consentRes = await api.consents.getConsents();
        if (consentRes.consents && consentRes.consents.length >= 2) {
          navigate("/dashboard");
        } else {
          navigate("/consent");
        }
      } catch {
        navigate("/consent");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Invalid OTP or verification failure");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !pendingOtp) return;
    setError(null);
    try {
      setResending(true);
      const res = await api.auth.requestOtp(pendingOtp.mobile, pendingOtp.pan);
      setResendCooldown(30);
      setTimeLeft(300);
      setSimulatedOtpBanner(res.simulatedOtp || "482913");
      setOtp(res.simulatedOtp || "482913");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to resend OTP");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <DummyBanner />

      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">VAI</span>
          </Link>
          <span className="text-sm text-slate-500 font-medium">Authentication</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-black text-slate-900">Enter Verification Code</h1>
            <p className="text-sm text-slate-500">
              Sent to <strong className="font-mono text-slate-700">{pendingOtp?.mobile}</strong>
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Demo Helper Box */}
          <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
              <span>Demo OTP ready: <strong className="font-mono text-sm tracking-widest">{pendingOtp?.simulatedOtp || "482913"}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => setOtp(pendingOtp?.simulatedOtp || "482913")}
              className="font-bold underline text-teal-700 hover:text-teal-900 text-xs ml-2"
            >
              Auto-fill
            </button>
          </div>

          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <label htmlFor="otp" className="block text-sm font-semibold text-slate-700 mb-2">
                6-Digit OTP
              </label>
              <input
                id="otp"
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="482913"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-center text-3xl font-mono tracking-[0.5em] text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition min-h-[56px]"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Expires in {formatTimer(timeLeft)}
              </span>

              <button
                type="button"
                disabled={resendCooldown > 0 || resending}
                onClick={handleResend}
                className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 disabled:text-slate-400 font-semibold"
              >
                <RotateCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                <span>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                </span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || timeLeft === 0}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-60 text-white text-base font-bold py-3.5 px-4 rounded-xl shadow-sm transition min-h-[48px]"
            >
              <span>{loading ? "Verifying..." : "Verify & Sign In"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
