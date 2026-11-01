import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { prisma } from "../src/db/client.js";
import { tokenService } from "../src/modules/auth/token.service.js";
import { seed } from "../src/db/seed.js";

const app = createApp();

describe("Phase 7: Admin API & RBAC Integration Suite", () => {
  let superAdminToken: string;
  let opsToken: string;
  let analystToken: string;
  let citizenToken: string;

  beforeAll(async () => {
    await seed();

    // Create tokens for seeded admins
    const superAdmin = await prisma.admin.findUniqueOrThrow({
      where: { email: "superadmin@vai.local" }
    });
    superAdminToken = tokenService.generateAccessToken({
      userId: superAdmin.adminId,
      role: "SUPER_ADMIN"
    });

    const opsAdmin = await prisma.admin.findUniqueOrThrow({
      where: { email: "ops@vai.local" }
    });
    opsToken = tokenService.generateAccessToken({
      userId: opsAdmin.adminId,
      role: "OPS"
    });

    const analystAdmin = await prisma.admin.findUniqueOrThrow({
      where: { email: "analyst@vai.local" }
    });
    analystToken = tokenService.generateAccessToken({
      userId: analystAdmin.adminId,
      role: "ANALYST"
    });

    // Create citizen token
    citizenToken = tokenService.generateAccessToken({
      userId: "U001",
      role: "CITIZEN"
    });
  });

  describe("1. Admin Authentication & RBAC (P7, P9, TRD 12.2)", () => {
    it("rejects login with invalid email or password", async () => {
      const res = await request(app)
        .post("/api/v1/admin/auth/login")
        .send({
          email: "superadmin@vai.local",
          password: "WrongPassword@123"
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("prompts for simulated 2FA on correct credentials without 2FA code (P7)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/auth/login")
        .send({
          email: "superadmin@vai.local",
          password: "SuperAdmin@123"
        });

      expect(res.status).toBe(200);
      expect(res.body.requires2FA).toBe(true);
      expect(res.body.simulated2FACode).toBe("123456");
    });

    it("rejects login with incorrect 2FA code", async () => {
      const res = await request(app)
        .post("/api/v1/admin/auth/login")
        .send({
          email: "superadmin@vai.local",
          password: "SuperAdmin@123",
          secondFactorCode: "999999"
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("successfully logs in with valid credentials and 2FA code (P7)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/auth/login")
        .send({
          email: "superadmin@vai.local",
          password: "SuperAdmin@123",
          secondFactorCode: "123456"
        });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.admin.role).toBe("SUPER_ADMIN");
      expect(res.body.admin.email).toBe("superadmin@vai.local");
    });

    it("enforces RBAC: ANALYST cannot access OPS-only user administration (403)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ROLE_FORBIDDEN");
    });

    it("enforces RBAC: OPS cannot modify scoring configuration (SUPER_ADMIN only)", async () => {
      const res = await request(app)
        .put("/api/v1/admin/config/scoring")
        .set("Authorization", `Bearer ${opsToken}`)
        .send({
          parameters: { base: 700 },
          effectiveFrom: "2027-01-01T00:00:00.000Z",
          changeReason: "Test config modification"
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ROLE_FORBIDDEN");
    });

    it("enforces RBAC: CITIZEN cannot access any admin endpoint", async () => {
      const res = await request(app)
        .get("/api/v1/admin/scores/distribution")
        .set("Authorization", `Bearer ${citizenToken}`);

      expect(res.status).toBe(401); // Citizen token is not an admin account in admins table
    });
  });

  describe("2. User and Challan Management (FR-M1, TRD 12.1, 12.2)", () => {
    it("lists users with masked PAN and masked mobile (OPS+)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${opsToken}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(10);
      expect(res.body.users[0].panMasked).toMatch(/^XXXXXX\w{4}$/);
      expect(res.body.users[0].mobileMasked).toMatch(/^\+91 90000 XX\d{3}$/);
    });

    it("retrieves individual user details with vehicles and score (OPS+)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users/U001")
        .set("Authorization", `Bearer ${opsToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe("U001");
      expect(res.body.score).toBe(765);
      expect(res.body.category).toBe("VERY_GOOD");
      expect(res.body.vehicles.length).toBe(1);
    });

    it("lists challans across users with filters (OPS+)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/challans?status=PAID")
        .set("Authorization", `Bearer ${opsToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.challans)).toBe(true);
      expect(res.body.challans.every((c: { status: string }) => c.status === "PAID")).toBe(true);
    });
  });

  describe("3. Dispute Resolution Workflow (P7, FR-V4)", () => {
    let pendingChallanId: string;
    let disputeId: string;

    beforeAll(async () => {
      // Find U010 disputed challan
      const disputedChallan = await prisma.challan.findFirstOrThrow({
        where: { userId: "U010", status: "DISPUTED" },
        include: { disputes: true }
      });
      disputeId = disputedChallan.disputes[0].disputeId;

      // Find U010 pending challan to test citizen dispute creation
      const pendingChallan = await prisma.challan.findFirstOrThrow({
        where: { userId: "U010", status: "PENDING" }
      });
      pendingChallanId = pendingChallan.challanId;
    });

    it("resolves dispute as UPHELD: sets challan to WAIVED and scoring_eligible to false (P7)", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/disputes/${disputeId}/resolve`)
        .set("Authorization", `Bearer ${opsToken}`)
        .send({
          outcome: "UPHELD",
          note: "Traffic camera glare verified; challan waived."
        });

      expect(res.status).toBe(200);
      expect(res.body.challan.status).toBe("WAIVED");
      expect(res.body.challan.scoringEligible).toBe(false);
      expect(res.body.dispute.outcome).toBe("UPHELD");

      // Verify audit log was recorded
      const audit = await prisma.auditLog.findFirst({
        where: { action: "RESOLVE_DISPUTE", entityId: res.body.challan.challanId }
      });
      expect(audit).toBeDefined();
    });

    it("resolves dispute as REJECTED: reverts challan to UNPAID and scoring_eligible to true (P7)", async () => {
      // Create a dispute on the pending challan first
      const u10Token = tokenService.generateAccessToken({ userId: "U010", role: "CITIZEN" });
      await request(app)
        .post(`/api/v1/challans/${pendingChallanId}/dispute`)
        .set("Authorization", `Bearer ${u10Token}`)
        .send({ note: "I was not driving this car on that day." });

      const newDispute = await prisma.dispute.findFirstOrThrow({
        where: { challanId: pendingChallanId }
      });

      // OPS rejects the dispute
      const res = await request(app)
        .post(`/api/v1/admin/disputes/${newDispute.disputeId}/resolve`)
        .set("Authorization", `Bearer ${opsToken}`)
        .send({
          outcome: "REJECTED",
          note: "Photo evidence clearly shows vehicle registration number."
        });

      expect(res.status).toBe(200);
      expect(res.body.challan.status).toBe("UNPAID");
      expect(res.body.challan.scoringEligible).toBe(true);
      expect(res.body.dispute.outcome).toBe("REJECTED");
    });
  });

  describe("4. Analytics & Reports (FR-M4, TRD 7.1)", () => {
    it("returns score distribution metrics by category and score band (ANALYST+)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/scores/distribution")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalScoredUsers).toBe(10);
      expect(res.body.categories.VERY_GOOD).toBe(2); // U001, U006
      expect(res.body.categories.GOOD).toBe(5);      // U002, U007, U008, U009, U010
      expect(res.body.categories.FAIR).toBe(3);      // U003, U004, U005
      expect(res.body.averageScore).toBeGreaterThanOrEqual(500);
      expect(res.body.bands).toBeDefined();
    });

    it("returns platform revenue analytics by service and fee option (ANALYST+)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/revenue")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalTransactions).toBeDefined();
      expect(res.body.grossFeeRevenuePaise).toBeDefined();
      expect(res.body.byService.INSURANCE).toBeDefined();
      expect(res.body.byOption.A).toBeDefined();
    });
  });

  describe("5. Configuration Management (FR-M2, TRD 5.3)", () => {
    it("inserts new scoring configuration version and logs audit (SUPER_ADMIN)", async () => {
      const res = await request(app)
        .put("/api/v1/admin/config/scoring")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          parameters: { base: 700, decayHalfLifeDays: 365, cap: 50 },
          effectiveFrom: "2027-01-01T00:00:00.000Z",
          changeReason: "Scheduled 2027 annual parameter calibration"
        });

      expect(res.status).toBe(201);
      expect(res.body.version).toBe(2);

      // Verify audit log exists
      const audit = await prisma.auditLog.findFirst({
        where: { action: "INSERT_SCORING_CONFIG", entityId: "2" }
      });
      expect(audit).toBeDefined();
    });

    it("activates fee config option B (100 ppm) with audit log (SUPER_ADMIN)", async () => {
      const res = await request(app)
        .put("/api/v1/admin/config/fees")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          optionCode: "B",
          ppm: 100,
          mode: "PROVIDER_PAYS",
          effectiveFrom: "2026-11-01T00:00:00.000Z"
        });

      expect(res.status).toBe(200);
      expect(res.body.optionCode).toBe("B");
      expect(res.body.ppm).toBe(100);
      expect(res.body.isActive).toBe(true);

      // Verify only 1 fee config is active
      const activeCount = await prisma.feeConfig.count({
        where: { isActive: true }
      });
      expect(activeCount).toBe(1);
    });

    it("detects configuration conflict on duplicate reward effective period (422 CONFIG_CONFLICT)", async () => {
      // Attempt to insert reward config with identical category, service, and effective date as seeded
      const res = await request(app)
        .put("/api/v1/admin/config/rewards")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          configs: [
            {
              vaiCategory: "VERY_GOOD",
              serviceType: "INSURANCE",
              discountBps: 200,
              effectiveFrom: "2024-01-01T00:00:00.000Z" // identical to seeded date
            }
          ]
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("CONFIG_CONFLICT");
    });
  });

  describe("6. Audit Logs, CSV Export, and Dataset Reset (FR-M3, FR-M5, FR-M6)", () => {
    it("searches audit logs (ANALYST+)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/audit-logs?limit=10")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.logs)).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });

    it("exports users as CSV with masked PAN (ANALYST+)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/export/csv?type=users")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.text).toContain("User ID,Full Name,Masked PAN");
      expect(res.text).toContain("XXXXXX001X");
      expect(res.text).not.toContain("DUMMY1001X"); // Unmasked PAN never exported
    });

    it("exports transactions as CSV (ANALYST+)", async () => {
      const res = await request(app)
        .get("/api/v1/admin/export/csv?type=transactions")
        .set("Authorization", `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.text).toContain("Transaction ID,User ID,Service");
    });

    it("resets dataset to initial 10 dummy profiles (SUPER_ADMIN, FR-M5)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/datasets/reset")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify all 10 profiles exist
      const userCount = await prisma.user.count();
      expect(userCount).toBe(10);
    });

    it("blocks dataset reset if any non-dummy record exists (TRD 18)", async () => {
      // Temporarily mark a user as non-dummy
      await prisma.user.update({
        where: { userId: "U001" },
        data: { isDummy: false }
      });

      const res = await request(app)
        .post("/api/v1/admin/datasets/reset")
        .set("Authorization", `Bearer ${superAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ROLE_FORBIDDEN");
      expect(res.body.error.message).toContain("non-dummy records present");

      // Restore dummy state
      await prisma.user.update({
        where: { userId: "U001" },
        data: { isDummy: true }
      });
    });
  });
});
