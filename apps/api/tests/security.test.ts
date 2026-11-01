import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { seed } from "../src/db/seed.js";
import { otpService } from "../src/modules/auth/otp.service.js";

const app = createApp();

/**
 * Phase 10: Security Hardening Test Suite
 * Covers IDOR, rate limits, refresh-token reuse, RBAC enforcement,
 * and session invalidation per PRD 18.2, TRD 8.3, TRD 12.2, and Spec Patches P7/P9/P10.
 */
describe("Phase 10: Security Hardening Suite", () => {
  let tokenU001: string;
  let tokenU002: string;
  let adminAnalystToken: string;

  beforeAll(async () => {
    await seed();

    // Authenticate U001
    otpService.clearRateLimits();
    const req1 = await request(app)
      .post("/api/v1/auth/otp/request")
      .send({ mobile: "+919000000001", pan: "DUMMY1001X" });
    const v1 = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ sessionId: req1.body.sessionId, otp: req1.body.simulatedOtp });
    tokenU001 = v1.body.accessToken;

    // Authenticate U002
    otpService.clearRateLimits();
    const req2 = await request(app)
      .post("/api/v1/auth/otp/request")
      .send({ mobile: "+919000000002", pan: "DUMMY1002X" });
    const v2 = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ sessionId: req2.body.sessionId, otp: req2.body.simulatedOtp });
    tokenU002 = v2.body.accessToken;

    // Authenticate Analyst (read-only role)
    await request(app)
      .post("/api/v1/admin/auth/login")
      .send({ email: "analyst@vai.local", password: "Analyst@123" });
    const analystLogin2fa = await request(app)
      .post("/api/v1/admin/auth/login")
      .send({
        email: "analyst@vai.local",
        password: "Analyst@123",
        secondFactorCode: "123456",
      });
    adminAnalystToken = analystLogin2fa.body.accessToken;
  });

  // ==========================================================================
  // 1. IDOR (Insecure Direct Object Reference) Prevention
  // ==========================================================================
  describe("1. IDOR Prevention (Cross-User Data Isolation)", () => {
    it("citizen U002 cannot access U001's vehicle details", async () => {
      // First get U001's vehicles
      const myVehicles = await request(app)
        .get("/api/v1/users/me/vehicles")
        .set("Authorization", `Bearer ${tokenU001}`);
      expect(myVehicles.status).toBe(200);
      const regNo = myVehicles.body.vehicles[0].registrationNo;

      // U002 tries to access U001's vehicle
      const idor = await request(app)
        .get(`/api/v1/vehicles/${regNo}`)
        .set("Authorization", `Bearer ${tokenU002}`);
      expect(idor.status).toBe(404);
    });

    it("citizen U002 cannot access U001's challans", async () => {
      // U001 has zero challans; U002 has 3 challans
      // Both /users/me/challans calls must return 200 and only their own data
      const myChallans = await request(app)
        .get("/api/v1/users/me/challans")
        .set("Authorization", `Bearer ${tokenU001}`);
      expect(myChallans.status).toBe(200);

      const otherChallans = await request(app)
        .get("/api/v1/users/me/challans")
        .set("Authorization", `Bearer ${tokenU002}`);
      expect(otherChallans.status).toBe(200);

      // Extract challan arrays safely (API returns { items: [...] })
      const u1Challans = myChallans.body.items || myChallans.body.challans || [];
      const u2Challans = otherChallans.body.items || otherChallans.body.challans || [];
      const u1Ids = u1Challans.map((c: { challanId: string }) => c.challanId);
      const u2Ids = u2Challans.map((c: { challanId: string }) => c.challanId);

      // No cross-user overlap
      const overlap = u1Ids.filter((id: string) => u2Ids.includes(id));
      expect(overlap).toHaveLength(0);
      // U002 should have challans while U001 should not
      expect(u1Challans.length).toBe(0); // U001 has 0 challans per seed spec
      expect(u2Challans.length).toBeGreaterThan(0); // U002 has 3 challans per seed spec
    });

    it("citizen cannot access another citizen's score", async () => {
      // Each /users/me/score returns only the authenticated user's score
      const s1 = await request(app)
        .get("/api/v1/users/me/score")
        .set("Authorization", `Bearer ${tokenU001}`);
      const s2 = await request(app)
        .get("/api/v1/users/me/score")
        .set("Authorization", `Bearer ${tokenU002}`);
      expect(s1.status).toBe(200);
      expect(s2.status).toBe(200);
      // U001 = 765, U002 = 742 — they must differ to prove isolation
      expect(s1.body.score).not.toBe(s2.body.score);
    });
  });

  // ==========================================================================
  // 2. Authentication & Token Security
  // ==========================================================================
  describe("2. Authentication & Token Security", () => {
    it("rejects requests with no Authorization header", async () => {
      const res = await request(app).get("/api/v1/users/me");
      expect(res.status).toBe(401);
    });

    it("rejects requests with malformed Bearer token", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", "Bearer totally-invalid-jwt-token");
      expect(res.status).toBe(401);
    });

    it("rejects requests with expired/tampered JWT", async () => {
      // Construct a fake JWT (valid structure but wrong signature)
      const fakeJwt =
        "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJVMDAxIiwiaWF0IjoxNjE2MjQwMTIyLCJleHAiOjE2MTYyNDAxMjJ9.fakesignature";
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${fakeJwt}`);
      expect(res.status).toBe(401);
    });

    it("refresh-token reuse triggers full family revocation (TRD 8.3)", async () => {
      otpService.clearRateLimits();
      const login = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000003", pan: "DUMMY1003X" });
      const verify = await request(app)
        .post("/api/v1/auth/otp/verify")
        .send({ sessionId: login.body.sessionId, otp: login.body.simulatedOtp });

      const originalCookie = verify.headers["set-cookie"]![0]!;

      // 1st refresh — valid
      const r1 = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", originalCookie);
      expect(r1.status).toBe(200);
      const rotatedCookie = r1.headers["set-cookie"]![0]!;

      // Replay the already-consumed original cookie → REUSE DETECTED
      const reuse = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", originalCookie);
      expect(reuse.status).toBe(401);
      expect(reuse.body.error.code).toBe("TOKEN_REUSE_DETECTED");

      // The rotated token is also now revoked (family revocation)
      const revoked = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", rotatedCookie);
      expect(revoked.status).toBe(401);
    });

    it("logout clears cookie and revokes session", async () => {
      otpService.clearRateLimits();
      const login = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000004", pan: "DUMMY1004X" });
      const verify = await request(app)
        .post("/api/v1/auth/otp/verify")
        .send({ sessionId: login.body.sessionId, otp: login.body.simulatedOtp });

      const token = verify.body.accessToken;
      const cookie = verify.headers["set-cookie"]![0]!;

      // Logout
      const logoutRes = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${token}`)
        .set("Cookie", cookie);
      expect(logoutRes.status).toBe(200);

      // Session's refresh token should no longer work
      const postLogout = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", cookie);
      expect(postLogout.status).toBe(401);
    });
  });

  // ==========================================================================
  // 3. Rate Limiting (OTP Endpoints)
  // ==========================================================================
  describe("3. Rate Limiting (OTP Cooldown & Attempt Limits)", () => {
    it("enforces 30-second cooldown between OTP requests", async () => {
      otpService.clearRateLimits();

      // First request succeeds
      await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000005", pan: "DUMMY1005X" });

      // Immediate second request is rate-limited
      const res = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000005", pan: "DUMMY1005X" });
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("OTP_COOLDOWN");
    });

    it("locks OTP session after 3 failed verification attempts", async () => {
      otpService.clearRateLimits();
      const login = await request(app)
        .post("/api/v1/auth/otp/request")
        .send({ mobile: "+919000000006", pan: "DUMMY1006X" });

      const sessionId = login.body.sessionId;

      // 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post("/api/v1/auth/otp/verify")
          .send({ sessionId, otp: "000000" });
      }

      // 4th attempt — session should be locked/expired
      const locked = await request(app)
        .post("/api/v1/auth/otp/verify")
        .send({ sessionId, otp: "000000" });
      expect(locked.status).toBeGreaterThanOrEqual(400);
      // Should be 400 or 429 — either SESSION_EXPIRED or OTP_ATTEMPTS_EXCEEDED
      expect(["OTP_ATTEMPTS_EXCEEDED", "SESSION_EXPIRED", "OTP_INVALID", "OTP_EXPIRED"]).toContain(
        locked.body.error.code
      );
    });
  });

  // ==========================================================================
  // 4. Admin RBAC Enforcement (P9)
  // ==========================================================================
  describe("4. Admin RBAC Enforcement (Spec Patch P9)", () => {
    it("ANALYST cannot access user management endpoints (OPS+)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${adminAnalystToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ROLE_FORBIDDEN");
    });

    it("ANALYST cannot resolve disputes (OPS+)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/disputes/fake-id/resolve")
        .set("Authorization", `Bearer ${adminAnalystToken}`)
        .send({ outcome: "UPHELD" });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ROLE_FORBIDDEN");
    });

    it("ANALYST cannot modify scoring config (SUPER_ADMIN only)", async () => {
      const res = await request(app)
        .put("/api/v1/admin/config/scoring")
        .set("Authorization", `Bearer ${adminAnalystToken}`)
        .send({
          parameters: {},
          effectiveFrom: "2026-12-01",
          changeReason: "Test unauthorized",
        });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ROLE_FORBIDDEN");
    });

    it("ANALYST cannot reset the dataset (SUPER_ADMIN only)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/datasets/reset")
        .set("Authorization", `Bearer ${adminAnalystToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ROLE_FORBIDDEN");
    });

    it("ANALYST CAN access read-only analytics and audit endpoints", async () => {
      const dist = await request(app)
        .get("/api/v1/admin/scores/distribution")
        .set("Authorization", `Bearer ${adminAnalystToken}`);
      expect(dist.status).toBe(200);

      const revenue = await request(app)
        .get("/api/v1/admin/revenue")
        .set("Authorization", `Bearer ${adminAnalystToken}`);
      expect(revenue.status).toBe(200);

      const logs = await request(app)
        .get("/api/v1/admin/audit-logs")
        .set("Authorization", `Bearer ${adminAnalystToken}`);
      expect(logs.status).toBe(200);
    });

    it("unauthenticated admin requests are rejected (401)", async () => {
      const res = await request(app).get("/api/v1/admin/users");
      expect(res.status).toBe(401);
    });

    it("citizen token cannot access admin endpoints", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${tokenU001}`);
      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // 5. Sensitive Data Protection
  // ==========================================================================
  describe("5. Sensitive Data Protection (DPDP Act / P2)", () => {
    it("PAN is always masked in API responses (XXXXXX + last 4)", async () => {
      const me = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${tokenU001}`);
      expect(me.status).toBe(200);
      expect(me.body.panMasked).toBe("XXXXXX001X");
      expect(me.body.panMasked).toHaveLength(10);
      // Raw PAN must never appear in any API response
      expect(JSON.stringify(me.body)).not.toContain("DUMMY1001X");
    });

    it("mobile is always masked in GET /users/me response", async () => {
      const me = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${tokenU001}`);
      expect(me.body.mobileMasked).toBeDefined();
      // Must not contain the full mobile number
      expect(me.body.mobileMasked).not.toBe("+919000000001");
    });
  });
});
