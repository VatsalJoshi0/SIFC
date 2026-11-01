import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { prisma } from "../src/db/client.js";
import { userRepository } from "../src/repositories/user.repository.js";
import { vehicleRepository } from "../src/repositories/vehicle.repository.js";

function randomFourDigits(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

describe("Database Triggers, Constraints & Portable Schema (Phase 2 Gate)", () => {
  beforeAll(async () => {
    // Explicitly verify PRAGMA foreign_keys is ON in SQLite
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON;");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("1. Append-Only Triggers (P1c)", () => {
    it("rejects UPDATE on score_ledger via trigger", async () => {
      const code = randomFourDigits();
      const user = await userRepository.create({
        mobileE164: `+919999${code}01`,
        pan: `DUMMY${code}A`,
        fullName: "Trigger Test User",
        city: "Mumbai",
        state: "Maharashtra",
        registrationDate: new Date()
      });

      const entry = await prisma.scoreLedger.create({
        data: {
          userId: user.userId,
          eventType: "INIT",
          component: "INIT",
          reasonCode: "ACCOUNT_START",
          deltaPoints: 0,
          balanceBefore: 700,
          balanceAfter: 700,
          configVersion: 1
        }
      });

      // Attempt to UPDATE the entry (must be rejected by trigger)
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE score_ledger SET delta_points = 50 WHERE entry_id = ${entry.entryId};`
        )
      ).rejects.toThrow(/score_ledger is append-only: UPDATE is prohibited/i);
    });

    it("rejects DELETE on score_ledger via trigger", async () => {
      const code = randomFourDigits();
      const user = await userRepository.create({
        mobileE164: `+919999${code}02`,
        pan: `DUMMY${code}B`,
        fullName: "Delete Trigger User",
        city: "Mumbai",
        state: "Maharashtra",
        registrationDate: new Date()
      });

      const entry = await prisma.scoreLedger.create({
        data: {
          userId: user.userId,
          eventType: "INIT",
          component: "INIT",
          reasonCode: "ACCOUNT_START",
          deltaPoints: 0,
          balanceBefore: 700,
          balanceAfter: 700,
          configVersion: 1
        }
      });

      // Attempt to DELETE the entry (must be rejected by trigger)
      await expect(
        prisma.$executeRawUnsafe(
          `DELETE FROM score_ledger WHERE entry_id = ${entry.entryId};`
        )
      ).rejects.toThrow(/score_ledger is append-only: DELETE is prohibited/i);
    });

    it("rejects UPDATE on audit_logs via trigger", async () => {
      const log = await prisma.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorId: "admin_test",
          action: "TEST_ACTION",
          entityType: "TEST",
          entityId: crypto.randomUUID()
        }
      });

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE audit_logs SET action = 'TAMPERED' WHERE log_id = ${log.logId};`
        )
      ).rejects.toThrow(/audit_logs is append-only: UPDATE is prohibited/i);
    });

    it("rejects DELETE on audit_logs via trigger", async () => {
      const log = await prisma.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorId: "admin_test",
          action: "TEST_ACTION_DELETE",
          entityType: "TEST",
          entityId: crypto.randomUUID()
        }
      });

      await expect(
        prisma.$executeRawUnsafe(
          `DELETE FROM audit_logs WHERE log_id = ${log.logId};`
        )
      ).rejects.toThrow(/audit_logs is append-only: DELETE is prohibited/i);
    });
  });

  describe("2. Single Active fee_config (Partial Unique Index P1c)", () => {
    it("enforces at most one active fee_config row at any time", async () => {
      const adminTag = `admin_${randomFourDigits()}`;

      // Deactivate any existing active fee config so we test isolated single-active constraint
      await prisma.feeConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      // 1. Create first active fee config
      const fee1 = await prisma.feeConfig.create({
        data: {
          optionCode: "A",
          ppm: 50,
          mode: "PROVIDER_PAYS",
          effectiveFrom: new Date(),
          isActive: true,
          createdBy: adminTag
        }
      });
      expect(fee1.isActive).toBe(true);

      // 2. Attempt to create a SECOND active fee config (must violate partial unique index)
      await expect(
        prisma.feeConfig.create({
          data: {
            optionCode: "B",
            ppm: 100,
            mode: "PASS_THROUGH",
            effectiveFrom: new Date(),
            isActive: true,
            createdBy: adminTag
          }
        })
      ).rejects.toThrow(/UNIQUE constraint failed/i);

      // 3. Creating inactive fee configs must succeed without collision
      const fee3 = await prisma.feeConfig.create({
        data: {
          optionCode: "B",
          ppm: 100,
          mode: "PASS_THROUGH",
          effectiveFrom: new Date(),
          isActive: false,
          createdBy: adminTag
        }
      });
      expect(fee3.isActive).toBe(false);

      const fee4 = await prisma.feeConfig.create({
        data: {
          optionCode: "A",
          ppm: 50,
          mode: "PROVIDER_PAYS",
          effectiveFrom: new Date(),
          isActive: false,
          createdBy: adminTag
        }
      });
      expect(fee4.isActive).toBe(false);

      // Clean up test fee configs
      await prisma.feeConfig.deleteMany({ where: { createdBy: adminTag } });
    });
  });

  describe("3. CHECK Constraints", () => {
    it("enforces score BETWEEN 500 AND 900 on vai_scores", async () => {
      const code = randomFourDigits();
      const user = await userRepository.create({
        mobileE164: `+919999${code}03`,
        pan: `DUMMY${code}C`,
        fullName: "Score Check User",
        city: "Delhi",
        state: "Delhi",
        registrationDate: new Date()
      });

      // Valid score 700: succeeds
      const validScore = await prisma.vaiScore.create({
        data: {
          userId: user.userId,
          score: 700,
          category: "GOOD",
          scoreBeforeCap: 700.0,
          scoringConfigVersion: 1
        }
      });
      expect(validScore.score).toBe(700);

      // Score < 500 (e.g. 499): violates CHECK constraint
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO vai_scores (user_id, score, category, score_before_cap, scoring_config_version, computed_at, updated_at) 
           VALUES ('${crypto.randomUUID()}', 499, 'FAIR', 499.0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`
        )
      ).rejects.toThrow(/CHECK constraint failed/i);

      // Score > 900 (e.g. 901): violates CHECK constraint
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO vai_scores (user_id, score, category, score_before_cap, scoring_config_version, computed_at, updated_at) 
           VALUES ('${crypto.randomUUID()}', 901, 'VERY_GOOD', 901.0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`
        )
      ).rejects.toThrow(/CHECK constraint failed/i);
    });

    it("enforces amount_paise > 0 on challans", async () => {
      const code = randomFourDigits();
      const user = await userRepository.create({
        mobileE164: `+919999${code}04`,
        pan: `DUMMY${code}D`,
        fullName: "Challan Check User",
        city: "Surat",
        state: "Gujarat",
        registrationDate: new Date()
      });

      const vehicle = await vehicleRepository.create({
        userId: user.userId,
        registrationNo: `GJ05DM${code}`,
        vehicleType: "FOUR_WHEELER",
        manufacturer: "Hyundai",
        model: "Creta",
        registrationDate: new Date(),
        rcValidityTill: new Date("2030-01-01")
      });

      // amount_paise = 0: violates CHECK constraint
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO challans (challan_id, user_id, vehicle_id, challan_date, challan_type, violation_code, violation_desc, severity, amount_paise, status, due_date, scoring_eligible, created_at, updated_at)
           VALUES ('CH-ZERO-${code}', '${user.userId}', '${vehicle.vehicleId}', CURRENT_TIMESTAMP, 'Speed', 'SPD', 'Over speed', 'LOW', 0, 'UNPAID', CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`
        )
      ).rejects.toThrow(/CHECK constraint failed/i);

      // amount_paise > 0: succeeds
      const validChallan = await prisma.challan.create({
        data: {
          challanId: `CH-VALID-${code}`,
          userId: user.userId,
          vehicleId: vehicle.vehicleId,
          challanDate: new Date(),
          challanType: "Speed",
          violationCode: "SPD",
          violationDesc: "Over speed",
          severity: "LOW",
          amountPaise: 100000n,
          status: "UNPAID",
          dueDate: new Date(),
          scoringEligible: true
        }
      });
      expect(validChallan.amountPaise).toBe(100000n);
    });

    it("enforces pan_masked length = 10 characters", async () => {
      const code = randomFourDigits();
      // 9 characters: fails
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO users (user_id, mobile_e164, pan_encrypted, pan_hash, pan_masked, full_name, city, state, registration_date, status, is_dummy, created_at, updated_at)
           VALUES ('${crypto.randomUUID()}', '+91888${code}01', 'enc', 'hash_${code}_9', 'XXXXX001X', 'Short PAN', 'City', 'State', CURRENT_TIMESTAMP, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`
        )
      ).rejects.toThrow(/CHECK constraint failed/i);

      // 11 characters (the TRD bug 'XXXXXX1001X'): fails
      await expect(
        prisma.$executeRawUnsafe(
          `INSERT INTO users (user_id, mobile_e164, pan_encrypted, pan_hash, pan_masked, full_name, city, state, registration_date, status, is_dummy, created_at, updated_at)
           VALUES ('${crypto.randomUUID()}', '+91888${code}02', 'enc', 'hash_${code}_11', 'XXXXXX1001X', 'Long PAN', 'City', 'State', CURRENT_TIMESTAMP, 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`
        )
      ).rejects.toThrow(/CHECK constraint failed/i);
    });
  });

  describe("4. Foreign Key RESTRICT", () => {
    it("prevents deleting a user who owns vehicles (RESTRICT)", async () => {
      const code = randomFourDigits();
      const user = await userRepository.create({
        mobileE164: `+919999${code}05`,
        pan: `DUMMY${code}E`,
        fullName: "FK Restrict User",
        city: "Bengaluru",
        state: "Karnataka",
        registrationDate: new Date()
      });

      const vehicle = await vehicleRepository.create({
        userId: user.userId,
        registrationNo: `KA01DM${code}`,
        vehicleType: "TWO_WHEELER",
        manufacturer: "Honda",
        model: "Activa",
        registrationDate: new Date(),
        rcValidityTill: new Date("2030-01-01")
      });

      // Attempting to delete user while vehicle exists MUST fail with foreign key constraint
      await expect(
        prisma.user.delete({ where: { userId: user.userId } })
      ).rejects.toThrow(/Foreign key constraint/i);

      // Clean up vehicle first, then delete user: succeeds
      await prisma.vehicle.delete({ where: { vehicleId: vehicle.vehicleId } });
      const deleted = await prisma.user.delete({ where: { userId: user.userId } });
      expect(deleted.userId).toBe(user.userId);
    });
  });

  describe("5. is_dummy Seed Guard", () => {
    it("refuses to delete any user record where is_dummy is false", async () => {
      const code = randomFourDigits();
      const realUser = await prisma.user.create({
        data: {
          mobileE164: `+919999${code}06`,
          panEncrypted: "enc",
          panHash: `hash_real_${code}`,
          panMasked: "XXXXXX006X",
          fullName: "Real Protected User",
          city: "Pune",
          state: "Maharashtra",
          registrationDate: new Date(),
          isDummy: false
        }
      });

      // Attempting to delete via deleteDummyUser throws a security alert
      await expect(
        userRepository.deleteDummyUser(realUser.userId)
      ).rejects.toThrow(/SECURITY ALERT: Attempted to delete non-dummy user/i);

      // Attempting resetAllDummyUsers also refuses to proceed when real user exists
      await expect(
        userRepository.resetAllDummyUsers()
      ).rejects.toThrow(/Cannot reset dataset: non-dummy \(real\) records exist/i);

      // Manual clean up of test fixture
      await prisma.user.delete({ where: { userId: realUser.userId } });
    });
  });
});
