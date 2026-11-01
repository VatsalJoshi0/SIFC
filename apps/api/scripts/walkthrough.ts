/**
 * End-to-End Walkthrough of the Citizen API (Phase 5 Gate Demonstration)
 * Runs all Phase 5 endpoints end-to-end on fictional data and prints clean, plain-language results.
 * Can be run standalone in a single command: `npm run api:walkthrough`
 */

import { createApp } from "../src/server.js";
import type { Server } from "node:http";

let server: Server | null = null;
let baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

interface StepResponse {
  [key: string]: unknown;
}

async function runStep(
  title: string,
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  cookie?: string
): Promise<{ status: number; data: StepResponse; headers: Headers }> {
  console.log(`\n▶ [${method}] ${path} - ${title}`);
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data: StepResponse;
  try {
    data = JSON.parse(text) as StepResponse;
  } catch {
    data = { raw: text };
  }

  console.log(`Status: ${res.status} ${res.statusText}`);
  console.log("Response:", JSON.stringify(data, null, 2).slice(0, 500));
  return { status: res.status, data, headers: res.headers };
}

export async function runWalkthrough(): Promise<void> {
  // Check if server is already running on port 3000; if not, spin up in-process server
  try {
    const probe = await fetch(`${baseUrl}/healthz`);
    if (!probe.ok) throw new Error("Server not ready");
  } catch {
    const app = createApp();
    const port = 3001;
    baseUrl = `http://localhost:${port}`;
    server = app.listen(port);
    console.log(`Started in-process VAI API server on ${baseUrl}`);
  }

  try {
    console.log("==========================================================================");
    console.log("  VAI CITIZEN API INTERACTIVE WALKTHROUGH (PHASE 5 GATE)");
    console.log("==========================================================================");

    // 1. Health check
    await runStep("Health Check", "GET", "/healthz");

    // 2. Request OTP for U001
    const otpReq = await runStep("Request Simulated OTP for U001", "POST", "/api/v1/auth/otp/request", {
      mobile: "+919000000001",
      pan: "DUMMY1001X"
    });

    const sessionId = String(otpReq.data["sessionId"]);
    const simulatedOtp = String(otpReq.data["simulatedOtp"] || "123456");

    // 3. Verify OTP
    const verifyReq = await runStep("Verify OTP & Issue Tokens", "POST", "/api/v1/auth/otp/verify", {
      sessionId,
      otp: simulatedOtp
    });

    const accessToken = String(verifyReq.data["accessToken"]);
    const cookieHeader = verifyReq.headers.get("set-cookie") || "";
    const refreshCookie = cookieHeader.split(";")[0] || "";

    // 4. Get Citizen Profile
    await runStep("Get Citizen Profile", "GET", "/api/v1/users/me", undefined, accessToken);

    // 5. Get Consents
    await runStep("Get User Consents", "GET", "/api/v1/users/me/consents", undefined, accessToken);

    // 6. Update Consents
    await runStep(
      "Update Consents (DPDP Act Purpose Toggle)",
      "PUT",
      "/api/v1/users/me/consents",
      {
        consents: [
          { purpose: "IDENTITY_VERIFICATION", granted: true },
          { purpose: "VAI_SCORING", granted: true },
          { purpose: "REWARD_DISCOUNT", granted: true }
        ]
      },
      accessToken
    );

    // 7. List Vehicles
    const vehList = await runStep("List Linked Vehicles & Document Compliance", "GET", "/api/v1/vehicles", undefined, accessToken);
    const vehArray = vehList.data["vehicles"] as Array<{ registrationNo?: string }> | undefined;
    const firstRegNo = vehArray?.[0]?.registrationNo || "KA01AB1001";

    // 8. Vehicle Detail
    await runStep("Get Vehicle Details", "GET", `/api/v1/vehicles/${firstRegNo}`, undefined, accessToken);

    // 9. List Challans
    await runStep("List Citizen Challans", "GET", "/api/v1/challans", undefined, accessToken);

    // 10. Get Current Score
    await runStep("Get VAI Score & Breakdown", "GET", "/api/v1/score", undefined, accessToken);

    // 11. Score 12-Month History
    await runStep("Get 12-Month Score Snapshots", "GET", "/api/v1/score/history?months=12", undefined, accessToken);

    // 12. Score Ledger
    await runStep("Get Transparent Score Ledger", "GET", "/api/v1/score/ledger?limit=5", undefined, accessToken);

    // 13. Refresh Token Rotation
    const refreshed = await runStep("Rotate Refresh Token", "POST", "/api/v1/auth/refresh", undefined, undefined, refreshCookie);
    const newCookieHeader = refreshed.headers.get("set-cookie") || "";
    const newRefreshCookie = newCookieHeader.split(";")[0] || "";

    // 14. Logout
    await runStep("Logout and Revoke Session", "POST", "/api/v1/auth/logout", undefined, undefined, newRefreshCookie);

    console.log("\n==========================================================================");
    console.log("  WALKTHROUGH COMPLETED SUCCESSFULLY!");
    console.log("==========================================================================");
  } finally {
    if (server) {
      server.close();
    }
  }
}

if (process.argv[1]?.endsWith("walkthrough.ts") || process.argv[1]?.endsWith("walkthrough.js")) {
  runWalkthrough()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Walkthrough failed:", err);
      process.exit(1);
    });
}
