import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { prisma } from "../src/db/client.js";
import { tokenService } from "../src/modules/auth/token.service.js";
import { transactionsService } from "../src/modules/transactions/transactions.service.js";
import { quoteStore } from "../src/modules/rewards/quote.store.js";
import { seed } from "../src/db/seed.js";

const app = createApp();

describe("Phase 6: Rewards & Transactions Integration Tests", () => {
  let user1Token: string; // U001 (VERY_GOOD, score 765)
  let user1VehicleId: string;

  let user2Token: string; // U002 (GOOD, score 742)
  let user2VehicleId: string;

  let user3Token: string; // U003 (FAIR, score 591)
  let user3VehicleId: string;

  beforeAll(async () => {
    // Ensure database is in fresh seeded state
    await seed();
    quoteStore.clear();

    // Fetch U001
    const u1 = await prisma.user.findUnique({
      where: { userId: "U001" },
      include: { vehicles: true, licences: true }
    });
    if (!u1 || !u1.vehicles[0]) throw new Error("Seed user U001 not found");
    user1VehicleId = u1.vehicles[0].vehicleId;
    user1Token = tokenService.generateAccessToken({
      userId: u1.userId,
      role: "CITIZEN",
      fullName: u1.fullName
    });

    // Fetch U002
    const u2 = await prisma.user.findUnique({
      where: { userId: "U002" },
      include: { vehicles: true }
    });
    if (!u2 || !u2.vehicles[0]) throw new Error("Seed user U002 not found");
    user2VehicleId = u2.vehicles[0].vehicleId;
    user2Token = tokenService.generateAccessToken({
      userId: u2.userId,
      role: "CITIZEN",
      fullName: u2.fullName
    });

    // Fetch U003
    const u3 = await prisma.user.findUnique({
      where: { userId: "U003" },
      include: { vehicles: true }
    });
    if (!u3 || !u3.vehicles[0]) throw new Error("Seed user U003 not found");
    user3VehicleId = u3.vehicles[0].vehicleId;
    user3Token = tokenService.generateAccessToken({
      userId: u3.userId,
      role: "CITIZEN",
      fullName: u3.fullName
    });
  });

  describe("1. Quotes & Reward Eligibility", () => {
    it("generates quote for VERY_GOOD user (U001) with 200 bps discount (G2)", async () => {
      const res = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user1VehicleId,
          baseAmountPaise: 1_000_000
        });

      expect(res.status).toBe(200);
      expect(res.body.vaiCategory).toBe("VERY_GOOD");
      expect(res.body.discountBps).toBe(200);
      expect(res.body.breakdown).toEqual({
        originalAmountPaise: 1_000_000,
        discountPaise: 20_000,
        govtFundedPaise: 20_000,
        payablePaise: 980_000
      });
      expect(res.body.platformFee).toEqual({
        optionCode: "A",
        ppm: 50,
        feePaise: 50,
        chargedTo: "PROVIDER"
      });
      expect(res.body.quoteId).toMatch(/^Q-[A-F0-9]{6}$/);
      expect(res.body.quoteExpiresAt).toBeDefined();
    });

    it("generates quote for GOOD user (U002) with 100 bps discount (G2)", async () => {
      const res = await request(app)
        .post("/api/v1/services/quotes")
        .set("Authorization", `Bearer ${user2Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user2VehicleId,
          baseAmountPaise: 1_000_000
        });

      expect(res.status).toBe(200);
      expect(res.body.vaiCategory).toBe("GOOD");
      expect(res.body.discountBps).toBe(100);
      expect(res.body.breakdown).toEqual({
        originalAmountPaise: 1_000_000,
        discountPaise: 10_000,
        govtFundedPaise: 10_000,
        payablePaise: 990_000
      });
    });

    it("generates quote for FAIR user (U003) with 0 bps discount (G2)", async () => {
      const res = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user3Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user3VehicleId,
          baseAmountPaise: 1_000_000
        });

      expect(res.status).toBe(200);
      expect(res.body.vaiCategory).toBe("FAIR");
      expect(res.body.discountBps).toBe(0);
      expect(res.body.breakdown).toEqual({
        originalAmountPaise: 1_000_000,
        discountPaise: 0,
        govtFundedPaise: 0,
        payablePaise: 1_000_000
      });
    });

    it("prevents IDOR: returns 404 when citizen requests quote for someone else's vehicle", async () => {
      const res = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user2VehicleId, // belongs to U002
          baseAmountPaise: 1_000_000
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("2. Transactions, State Machine, and Idempotency", () => {
    it("rejects transaction confirmation if Idempotency-Key header is missing", async () => {
      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          quoteId: "Q-ANY123",
          simulatedOutcome: "SUCCESS"
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
      expect(res.body.error.message).toContain("Idempotency-Key");
    });

    it("rejects confirmation if quote is unknown or not owned", async () => {
      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .set("Idempotency-Key", "idemp-001")
        .send({
          quoteId: "Q-NONEXIST",
          simulatedOutcome: "SUCCESS"
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("rejects confirmation with 409 QUOTE_STALE if quote has expired", async () => {
      // Create quote
      const quoteRes = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user1VehicleId,
          baseAmountPaise: 1_000_000
        });

      const quoteId = quoteRes.body.quoteId;

      // Manually set expiry to the past
      const stored = quoteStore.getQuote(quoteId);
      if (stored.quote) {
        stored.quote.quoteExpiresAt = new Date(Date.now() - 1000);
      }

      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .set("Idempotency-Key", "idemp-expired-quote")
        .send({
          quoteId,
          simulatedOutcome: "SUCCESS"
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("QUOTE_STALE");
    });

    it("processes SUCCESS transaction, extends vehicle document, and generates receiptUrl (P8)", async () => {
      // 1. Get initial insurance expiry
      const initialVehicle = await prisma.vehicle.findUniqueOrThrow({
        where: { vehicleId: user1VehicleId }
      });
      const oldExpiry = initialVehicle.insuranceExpiry;

      // 2. Generate quote
      const quoteRes = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user1VehicleId,
          baseAmountPaise: 1_000_000
        });

      const quoteId = quoteRes.body.quoteId;

      // 3. Confirm transaction
      const txnRes = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .set("Idempotency-Key", "idemp-success-test-01")
        .send({
          quoteId,
          simulatedOutcome: "SUCCESS"
        });

      expect(txnRes.status).toBe(201);
      expect(txnRes.body.status).toBe("SUCCESS");
      expect(txnRes.body.payablePaise).toBe(980_000);
      expect(txnRes.body.receiptUrl).toMatch(/^\/api\/v1\/transactions\/TXN-\d{8}-\d{6}\/receipt$/);

      // 4. Verify vehicle expiry was extended by 12 months (P8)
      const updatedVehicle = await prisma.vehicle.findUniqueOrThrow({
        where: { vehicleId: user1VehicleId }
      });
      expect(updatedVehicle.insuranceExpiry).toBeDefined();
      if (oldExpiry) {
        const expectedDate = new Date(oldExpiry > new Date() ? oldExpiry : new Date());
        expectedDate.setUTCMonth(expectedDate.getUTCMonth() + 12);
        expect(updatedVehicle.insuranceExpiry?.toISOString().slice(0, 10)).toBe(
          expectedDate.toISOString().slice(0, 10)
        );
      }
    });

    it("enforces idempotency: repeated request with same key returns identical transaction without double processing", async () => {
      const quoteRes = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user1VehicleId,
          baseAmountPaise: 1_000_000
        });

      const quoteId = quoteRes.body.quoteId;
      const idempotencyKey = "idemp-double-submit-key";

      // First submit
      const res1 = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .set("Idempotency-Key", idempotencyKey)
        .send({ quoteId, simulatedOutcome: "SUCCESS" });

      expect(res1.status).toBe(201);
      const txnId1 = res1.body.txnId;

      // Second submit with same idempotency key
      const res2 = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .set("Idempotency-Key", idempotencyKey)
        .send({ quoteId, simulatedOutcome: "SUCCESS" });

      expect(res2.status).toBe(201);
      expect(res2.body.txnId).toBe(txnId1);
      expect(res2.body.payablePaise).toBe(res1.body.payablePaise);

      // Verify in DB that only 1 transaction exists for this key
      const count = await prisma.transaction.count({
        where: { idempotencyKey }
      });
      expect(count).toBe(1);
    });

    it("handles simulated FAILURE: transaction is marked FAILED without applying renewals", async () => {
      const initialVehicle = await prisma.vehicle.findUniqueOrThrow({
        where: { vehicleId: user1VehicleId }
      });
      const oldExpiry = initialVehicle.insuranceExpiry;

      const quoteRes = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user1VehicleId,
          baseAmountPaise: 1_000_000
        });

      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .set("Idempotency-Key", "idemp-failure-key")
        .send({
          quoteId: quoteRes.body.quoteId,
          simulatedOutcome: "FAILURE"
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("FAILED");
      expect(res.body.receiptUrl).toBeUndefined();

      // Expiry must not have changed
      const vehicleAfter = await prisma.vehicle.findUniqueOrThrow({
        where: { vehicleId: user1VehicleId }
      });
      expect(vehicleAfter.insuranceExpiry).toEqual(oldExpiry);
    });

    it("handles simulated TIMEOUT: transaction is marked TIMED_OUT", async () => {
      const quoteRes = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user1VehicleId,
          baseAmountPaise: 1_000_000
        });

      const res = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .set("Idempotency-Key", "idemp-timeout-key")
        .send({
          quoteId: quoteRes.body.quoteId,
          simulatedOutcome: "TIMEOUT"
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("TIMED_OUT");
    });
  });

  describe("3. Deterministic Receipts & Transaction History", () => {
    let completedTxnId: string;

    beforeEach(async () => {
      const quoteRes = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user1VehicleId,
          baseAmountPaise: 1_000_000
        });

      const txnRes = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .set("Idempotency-Key", `idemp-receipt-test-${Date.now()}`)
        .send({
          quoteId: quoteRes.body.quoteId,
          simulatedOutcome: "SUCCESS"
        });

      completedTxnId = txnRes.body.txnId;
    });

    it("returns deterministic JSON receipt with full breakdown", async () => {
      const res = await request(app)
        .get(`/api/v1/transactions/${completedTxnId}/receipt`)
        .set("Authorization", `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.receiptNumber).toBe(`REC-${completedTxnId}`);
      expect(res.body.transactionId).toBe(completedTxnId);
      expect(res.body.citizen.fullName).toBe("Priya Sharma");
      expect(res.body.citizen.panMasked).toBe("XXXXXX001X");
      expect(res.body.item.type).toBe("VEHICLE");
      expect(res.body.pricing.baseAmountPaise).toBe(1_000_000);
      expect(res.body.pricing.discountPaise).toBe(20_000);
      expect(res.body.pricing.payablePaise).toBe(980_000);
      expect(res.body.pricing.platformFeePaise).toBe(50);
      expect(res.body.pricing.display.baseAmount).toBe("₹10,000.00");
      expect(res.body.pricing.display.payableAmount).toBe("₹9,800.00");
      expect(res.body.payment.status).toBe("SUCCESS");
    });

    it("returns deterministic PDF receipt with valid PDF 1.4 header", async () => {
      const res = await request(app)
        .get(`/api/v1/transactions/${completedTxnId}/receipt?format=pdf`)
        .set("Authorization", `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      const pdfText = res.body.toString("utf-8");
      expect(pdfText.startsWith("%PDF-1.4")).toBe(true);
      expect(pdfText).toContain(completedTxnId);
    });

    it("receipt regeneration produces byte-for-byte identical output (P11)", async () => {
      const res1 = await request(app)
        .get(`/api/v1/transactions/${completedTxnId}/receipt?format=pdf`)
        .set("Authorization", `Bearer ${user1Token}`);

      const res2 = await request(app)
        .get(`/api/v1/transactions/${completedTxnId}/receipt?format=pdf`)
        .set("Authorization", `Bearer ${user1Token}`);

      expect(Buffer.compare(res1.body, res2.body)).toBe(0);
    });

    it("lists user transactions in GET /api/v1/transactions", async () => {
      const res = await request(app)
        .get("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.transactions)).toBe(true);
      expect(res.body.transactions.length).toBeGreaterThanOrEqual(1);
      expect(res.body.transactions[0].txnId).toBe(completedTxnId);
    });
  });

  describe("4. Refunds and Admin Reconciliation (P7, G7)", () => {
    it("processes partial refund and computes proportional fee reversal (G7)", async () => {
      // Create a 1,000,000 paise base transaction with 50 paise fee
      const quoteRes = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user1VehicleId,
          baseAmountPaise: 1_000_000
        });

      const txnRes = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .set("Idempotency-Key", `idemp-refund-test-${Date.now()}`)
        .send({
          quoteId: quoteRes.body.quoteId,
          simulatedOutcome: "SUCCESS"
        });

      const txnId = txnRes.body.txnId;

      // Partial refund of 400,000 paise
      const refundResult = await transactionsService.processRefund(
        txnId,
        400_000n,
        "CUSTOMER_CANCELLATION",
        "admin-ops-001"
      );

      // Fee reversal must be: round_half_up(50 * 400,000 / 1,000,000) = 20 paise (G7)
      expect(refundResult.refund.amountPaise).toBe(400_000n);
      expect(refundResult.refund.feeReversedPaise).toBe(20n);
      expect(refundResult.transaction.status).toBe("SUCCESS"); // Txn stays SUCCESS on partial refund
    });

    it("marks transaction as REFUNDED on full refund (P7)", async () => {
      const quoteRes = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user1VehicleId,
          baseAmountPaise: 1_000_000
        });

      const txnRes = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .set("Idempotency-Key", `idemp-full-refund-${Date.now()}`)
        .send({
          quoteId: quoteRes.body.quoteId,
          simulatedOutcome: "SUCCESS"
        });

      const txnId = txnRes.body.txnId;

      // Full refund of 1,000,000 paise
      const refundResult = await transactionsService.processRefund(
        txnId,
        1_000_000n,
        "POLICY_CANCELLED",
        "admin-super-001"
      );

      expect(refundResult.refund.amountPaise).toBe(1_000_000n);
      expect(refundResult.refund.feeReversedPaise).toBe(50n); // Full fee reversed
      expect(refundResult.transaction.status).toBe("REFUNDED");
    });

    it("reconciles TIMED_OUT transaction to SUCCESS (P7)", async () => {
      const quoteRes = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user1VehicleId,
          baseAmountPaise: 1_000_000
        });

      const txnRes = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .set("Idempotency-Key", `idemp-reconcile-test-${Date.now()}`)
        .send({
          quoteId: quoteRes.body.quoteId,
          simulatedOutcome: "TIMEOUT"
        });

      const txnId = txnRes.body.txnId;

      // Reconcile to SUCCESS
      const reconciled = await transactionsService.reconcileTransaction(
        txnId,
        "SUCCESS",
        "admin-ops-001",
        "Payment verified manually via banking gateway"
      );

      expect(reconciled.status).toBe("SUCCESS");
      expect(reconciled.receiptUrl).toBe(`/api/v1/transactions/${txnId}/receipt`);
    });

    it("rejects reconciliation with 409 TXN_STATE_INVALID if status is not TIMED_OUT", async () => {
      const quoteRes = await request(app)
        .post("/api/v1/rewards/eligibility")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({
          serviceType: "INSURANCE",
          vehicleId: user1VehicleId,
          baseAmountPaise: 1_000_000
        });

      const txnRes = await request(app)
        .post("/api/v1/transactions")
        .set("Authorization", `Bearer ${user1Token}`)
        .set("Idempotency-Key", `idemp-reconcile-err-${Date.now()}`)
        .send({
          quoteId: quoteRes.body.quoteId,
          simulatedOutcome: "SUCCESS" // already SUCCESS
        });

      const txnId = txnRes.body.txnId;

      await expect(
        transactionsService.reconcileTransaction(txnId, "SUCCESS", "admin-ops-001")
      ).rejects.toThrow("Only TIMED_OUT transactions can be reconciled");
    });
  });
});
