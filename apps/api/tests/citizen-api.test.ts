import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { seed } from "../src/db/seed.js";
import { otpService } from "../src/modules/auth/otp.service.js";

const app = createApp();

describe("Phase 5: Citizen API Integration Suite", () => {
  beforeAll(async () => {
    await seed();
  });

  describe("1. Authentication Endpoints (TRD 8.1 - 8.3)", () => {
    it("validates mobile and PAN format on OTP request", async () => {
      // Invalid mobile
      const res1 = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "12345", pan: "DUMMY1001X" });
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe("INVALID_MOBILE");

      // Invalid PAN format
      const res2 = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000001", pan: "INVALID_PAN_123" });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe("INVALID_PAN");
    });

    it("generates 6-digit OTP and returns sessionId and cooldown (TRD 8.1)", async () => {
      otpService.clearRateLimits();

      const res = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000001", pan: "DUMMY1001X" });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.expiresIn).toBe(300);
      expect(res.body.cooldownSeconds).toBe(30);
      expect(res.body.simulatedOtp).toBeDefined();
      expect(res.body.simulatedOtp).toMatch(/^\d{6}$/);
    });

    it("enforces 30-second cooldown between OTP requests (TRD 8.1)", async () => {
      // Immediate second request without cooldown
      const res = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000001", pan: "DUMMY1001X" });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("OTP_COOLDOWN");
    });

    it("returns identical success response for unknown user (TRD 8.1 privacy)", async () => {
      otpService.clearRateLimits();

      const res = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919876543210", pan: "ABCDE1234F" });

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBeDefined();
    });

    it("fails verification on incorrect OTP and tracks attempts", async () => {
      otpService.clearRateLimits();
      const reqRes = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000001", pan: "DUMMY1001X" });

      const sessionId = reqRes.body.sessionId;

      const verifyRes = await request(app)
        .post("/api/v1/auth/otp/verify")
        .send({ sessionId, otp: "000000" });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.error.code).toBe("OTP_INVALID");
      expect(verifyRes.body.error.details.remainingAttempts).toBe(2);
    });

    it("verifies OTP, issues access token and sets HttpOnly refresh cookie (TRD 8.3)", async () => {
      otpService.clearRateLimits();
      const reqRes = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000001", pan: "DUMMY1001X" });

      const { sessionId, simulatedOtp } = reqRes.body;

      const verifyRes = await request(app)
        .post("/api/v1/auth/otp/verify")
        .send({ sessionId, otp: simulatedOtp });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.accessToken).toBeDefined();
      expect(verifyRes.body.expiresIn).toBe(900);
      expect(verifyRes.body.user.userId).toBe("U001");
      expect(verifyRes.body.user.panMasked).toBe("XXXXXX001X");
      expect(verifyRes.body.user.vehicleCount).toBe(1);

      // Verify HttpOnly cookie header
      const cookies = verifyRes.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/vai_refresh_token=[a-f0-9]+;.*HttpOnly;.*SameSite=Strict/i);
    });

    it("rotates refresh token and detects token reuse (TRD 8.3)", async () => {
      otpService.clearRateLimits();
      const loginRes = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000002", pan: "DUMMY1002X" });

      const verifyRes = await request(app)
        .post("/api/v1/auth/otp/verify")
        .send({ sessionId: loginRes.body.sessionId, otp: loginRes.body.simulatedOtp });

      const initialCookie = verifyRes.headers["set-cookie"]![0]!;

      // 1. Valid rotation
      const refreshRes1 = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", initialCookie);

      expect(refreshRes1.status).toBe(200);
      expect(refreshRes1.body.accessToken).toBeDefined();
      const rotatedCookie = refreshRes1.headers["set-cookie"]![0]!;
      expect(rotatedCookie).toBeDefined();

      // 2. Token Reuse Attack: Replaying the initial consumed refresh token MUST trigger family revocation
      const reuseRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", initialCookie);

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe("TOKEN_REUSE_DETECTED");

      // 3. The rotated token is now also revoked due to family revocation
      const postRevokeRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", rotatedCookie);

      expect(postRevokeRes.status).toBe(401);
      expect(postRevokeRes.body.error.code).toBe("SESSION_EXPIRED");
    });

    it("clears cookie and revokes session on logout", async () => {
      otpService.clearRateLimits();
      const loginRes = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000003", pan: "DUMMY1003X" });

      const verifyRes = await request(app)
        .post("/api/v1/auth/otp/verify")
        .send({ sessionId: loginRes.body.sessionId, otp: loginRes.body.simulatedOtp });

      const cookie = verifyRes.headers["set-cookie"]![0]!;

      const logoutRes = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", cookie);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
    });
  });

  describe("2. User Profile and Consent Endpoints (P7, TRD 12.4)", () => {
    let u001Token: string;

    beforeAll(async () => {
      otpService.clearRateLimits();
      const loginRes = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000001", pan: "DUMMY1001X" });

      const verifyRes = await request(app)
        .post("/api/v1/auth/otp/verify")
        .send({ sessionId: loginRes.body.sessionId, otp: loginRes.body.simulatedOtp });

      u001Token = verifyRes.body.accessToken;
    });

    it("rejects unauthorized access to /users/me without Bearer token", async () => {
      const res = await request(app).get("/api/v1/users/me");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns masked citizen profile for authenticated user", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${u001Token}`);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe("U001");
      expect(res.body.fullName).toBe("Priya Sharma");
      expect(res.body.panMasked).toBe("XXXXXX001X");
      expect(res.body.mobileMasked).toBe("+91 90000 XX001");
      expect(res.body.vehicleCount).toBe(1);
    });

    it("retrieves and updates consents (P7, TRD 12.4)", async () => {
      // 1. Get initial consents
      const getRes = await request(app)
        .get("/api/v1/users/me/consents")
        .set("Authorization", `Bearer ${u001Token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.consents).toHaveLength(3);

      // 2. Update consent
      const putRes = await request(app)
        .put("/api/v1/users/me/consents")
        .set("Authorization", `Bearer ${u001Token}`)
        .send({
          consents: [
            { purpose: "IDENTITY_VERIFICATION", granted: true },
            { purpose: "VAI_SCORING", granted: true },
            { purpose: "REWARD_DISCOUNT", granted: false }
          ]
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);

      // 3. Verify updated state
      const reGetRes = await request(app)
        .get("/api/v1/users/me/consents")
        .set("Authorization", `Bearer ${u001Token}`);

      const rewardConsent = reGetRes.body.consents.find((c: { purpose: string; granted: boolean; withdrawnAt: string | null }) => c.purpose === "REWARD_DISCOUNT");
      expect(rewardConsent.granted).toBe(false);
      expect(rewardConsent.withdrawnAt).not.toBeNull();
    });
  });

  describe("3. Vehicles Endpoints (IDOR Prevention & Document Compliance)", () => {
    let u001Token: string;
    let u002Token: string;

    beforeAll(async () => {
      otpService.clearRateLimits();
      const r1 = await request(app).post("/api/v1/auth/otp/request").send({ mobile: "+919000000001", pan: "DUMMY1001X" });
      const v1 = await request(app).post("/api/v1/auth/otp/verify").send({ sessionId: r1.body.sessionId, otp: r1.body.simulatedOtp });
      u001Token = v1.body.accessToken;

      otpService.clearRateLimits();
      const r2 = await request(app).post("/api/v1/auth/otp/request").send({ mobile: "+919000000002", pan: "DUMMY1002X" });
      const v2 = await request(app).post("/api/v1/auth/otp/verify").send({ sessionId: r2.body.sessionId, otp: r2.body.simulatedOtp });
      u002Token = v2.body.accessToken;
    });

    it("lists vehicles linked to authenticated citizen with compliance badges", async () => {
      const res = await request(app)
        .get("/api/v1/vehicles")
        .set("Authorization", `Bearer ${u001Token}`);

      expect(res.status).toBe(200);
      expect(res.body.vehicles).toHaveLength(1);
      const veh = res.body.vehicles[0];
      expect(veh.registrationNo).toBe("KA01AB1001");
      expect(veh.insuranceStatus).toBe("VALID");
      expect(veh.pucStatus).toBe("VALID");
      expect(veh.rcStatus).toBe("VALID");
      expect(veh.complianceScore).toBe(15);
    });

    it("supports direct alias /api/v1/users/me/vehicles", async () => {
      const res = await request(app)
        .get("/api/v1/users/me/vehicles")
        .set("Authorization", `Bearer ${u001Token}`);

      expect(res.status).toBe(200);
      expect(res.body.vehicles).toHaveLength(1);
    });

    it("returns vehicle detail by vehicleId or registration number", async () => {
      const res = await request(app)
        .get("/api/v1/vehicles/KA01AB1001")
        .set("Authorization", `Bearer ${u001Token}`);

      expect(res.status).toBe(200);
      expect(res.body.vehicleId).toBe("VEH-U001-01");
      expect(res.body.manufacturer).toBe("Honda");
    });

    it("prevents IDOR: Citizen B cannot view Citizen A's vehicle", async () => {
      // User 2 attempts to fetch User 1's vehicle
      const res = await request(app)
        .get("/api/v1/vehicles/VEH-U001-01")
        .set("Authorization", `Bearer ${u002Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("VEHICLE_NOT_FOUND");
    });

    it("lists vehicle challans with filters and paging", async () => {
      const res = await request(app)
        .get("/api/v1/vehicles/MH02CD2002/challans")
        .set("Authorization", `Bearer ${u002Token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(3);
    });
  });

  describe("4. Challans & Disputes Endpoints (P7)", () => {
    let u010Token: string;
    let u002Token: string;

    beforeAll(async () => {
      otpService.clearRateLimits();
      const r1 = await request(app).post("/api/v1/auth/otp/request").send({ mobile: "+919000000010", pan: "DUMMY1010X" });
      const v1 = await request(app).post("/api/v1/auth/otp/verify").send({ sessionId: r1.body.sessionId, otp: r1.body.simulatedOtp });
      u010Token = v1.body.accessToken;

      otpService.clearRateLimits();
      const r2 = await request(app).post("/api/v1/auth/otp/request").send({ mobile: "+919000000002", pan: "DUMMY1002X" });
      const v2 = await request(app).post("/api/v1/auth/otp/verify").send({ sessionId: r2.body.sessionId, otp: r2.body.simulatedOtp });
      u002Token = v2.body.accessToken;
    });

    it("lists user challans with status filter and pagination", async () => {
      const res = await request(app)
        .get("/api/v1/challans?status=DISPUTED")
        .set("Authorization", `Bearer ${u010Token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].status).toBe("DISPUTED");
    });

    it("supports direct alias /api/v1/users/me/challans", async () => {
      const res = await request(app)
        .get("/api/v1/users/me/challans")
        .set("Authorization", `Bearer ${u010Token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(3);
    });

    it("rejects dispute on non-pending challan (P7 invariant)", async () => {
      // CH-U002-01 is status PAID
      const res = await request(app)
        .post("/api/v1/challans/CH-U002-01/dispute")
        .set("Authorization", `Bearer ${u002Token}`)
        .send({ reason: "I was not driving that day." });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("CHALLAN_NOT_DISPUTABLE");
    });

    it("successfully files dispute on PENDING challan (P7)", async () => {
      // U010 has CH-U010-01 in status PENDING
      const res = await request(app)
        .post("/api/v1/challans/CH-U010-01/dispute")
        .set("Authorization", `Bearer ${u010Token}`)
        .send({ reason: "Camera captured vehicle plate incorrectly under heavy fog." });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("DISPUTED");
      expect(res.body.disputeId).toBeDefined();

      // Verify challan is now DISPUTED and scoringEligible = false
      const listRes = await request(app)
        .get("/api/v1/challans?status=DISPUTED")
        .set("Authorization", `Bearer ${u010Token}`);

      const disputedChallan = listRes.body.items.find((c: { challanId: string; scoringEligible: boolean }) => c.challanId === "CH-U010-01");
      expect(disputedChallan).toBeDefined();
      expect(disputedChallan.scoringEligible).toBe(false);
    });
  });

  describe("5. Score, Ledger & History Endpoints (TRD 7.3, P6)", () => {
    let u001Token: string;
    let u008Token: string;

    beforeAll(async () => {
      otpService.clearRateLimits();
      const r1 = await request(app).post("/api/v1/auth/otp/request").send({ mobile: "+919000000001", pan: "DUMMY1001X" });
      const v1 = await request(app).post("/api/v1/auth/otp/verify").send({ sessionId: r1.body.sessionId, otp: r1.body.simulatedOtp });
      u001Token = v1.body.accessToken;

      otpService.clearRateLimits();
      const r2 = await request(app).post("/api/v1/auth/otp/request").send({ mobile: "+919000000008", pan: "DUMMY1008X" });
      const v2 = await request(app).post("/api/v1/auth/otp/verify").send({ sessionId: r2.body.sessionId, otp: r2.body.simulatedOtp });
      u008Token = v2.body.accessToken;
    });

    it("returns score summary with monthly delta, milestone and top reasons for U001", async () => {
      const res = await request(app)
        .get("/api/v1/score")
        .set("Authorization", `Bearer ${u001Token}`);

      expect(res.status).toBe(200);
      expect(res.body.score).toBe(765);
      expect(res.body.category).toBe("VERY_GOOD");
      expect(res.body.previousMonthScore).toBe(765);
      expect(res.body.changeSincePreviousMonth).toBe(0);
      expect(res.body.nextMilestone).toBeNull(); // Already top tier
      expect(res.body.topReasons.length).toBeGreaterThan(0);
    });

    it("supports direct alias /api/v1/users/me/score", async () => {
      const res = await request(app)
        .get("/api/v1/users/me/score")
        .set("Authorization", `Bearer ${u001Token}`);

      expect(res.status).toBe(200);
      expect(res.body.score).toBe(765);
    });

    it("correctly returns null previousMonthScore for brand new account U008 (P6)", async () => {
      const res = await request(app)
        .get("/api/v1/score")
        .set("Authorization", `Bearer ${u008Token}`);

      expect(res.status).toBe(200);
      expect(res.body.score).toBe(715);
      expect(res.body.category).toBe("GOOD");
      expect(res.body.previousMonthScore).toBeNull();
      expect(res.body.changeSincePreviousMonth).toBe(15); // 715 - 700 base
      expect(res.body.nextMilestone).toEqual({
        score: 750,
        category: "VERY_GOOD",
        pointsNeeded: 35
      });
    });

    it("returns 12 monthly snapshots for U001 history", async () => {
      const res = await request(app)
        .get("/api/v1/score/history?months=12")
        .set("Authorization", `Bearer ${u001Token}`);

      expect(res.status).toBe(200);
      expect(res.body.snapshots).toHaveLength(12);
      expect(res.body.snapshots[0].period).toBe("2025-11-01");
      expect(res.body.snapshots[11].period).toBe("2026-10-01");
    });

    it("returns transparent ledger entries with plain language labels", async () => {
      const res = await request(app)
        .get("/api/v1/score/ledger?limit=10")
        .set("Authorization", `Bearer ${u001Token}`);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      const first = res.body.items[0];
      expect(first.label).toBeDefined();
      expect(first.plainDescription).toBeDefined();
      expect(first.deltaPoints).toBeDefined();
      expect(first.balanceBefore).toBeDefined();
      expect(first.balanceAfter).toBeDefined();
    });
  });
});
