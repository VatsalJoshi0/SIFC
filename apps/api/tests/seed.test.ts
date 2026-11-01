import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../src/db/client.js";
import { seed, validateReferentialIntegrity } from "../src/db/seed.js";
import { verify } from "@node-rs/argon2";

describe("Phase 4: Deterministic Database Seed (TRD 18.2, 18.3)", () => {
  beforeAll(async () => {
    // Seed database deterministically
    await seed();
  });

  it("passes TRD 18.3 referential integrity validation", async () => {
    const validation = await validateReferentialIntegrity();
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("seeds all 10 profiles with exact target scores (within +/-1)", async () => {
    const expected = [
      { id: "U001", target: 765, cat: "VERY_GOOD" },
      { id: "U002", target: 742, cat: "GOOD" },
      { id: "U003", target: 591, cat: "FAIR" },
      { id: "U004", target: 634, cat: "FAIR" },
      { id: "U005", target: 630, cat: "FAIR" },
      { id: "U006", target: 765, cat: "VERY_GOOD" },
      { id: "U007", target: 726, cat: "GOOD" },
      { id: "U008", target: 715, cat: "GOOD" },
      { id: "U009", target: 669, cat: "GOOD" },
      { id: "U010", target: 725, cat: "GOOD" }
    ];

    for (const exp of expected) {
      const scoreRow = await prisma.vaiScore.findUnique({
        where: { userId: exp.id }
      });
      expect(scoreRow).not.toBeNull();
      expect(scoreRow!.score).toBe(exp.target);
      expect(scoreRow!.category).toBe(exp.cat);
    }
  });

  it("enforces PAN masking strictly to 10 characters (P2)", async () => {
    const users = await prisma.user.findMany();
    expect(users).toHaveLength(10);
    for (const u of users) {
      expect(u.panMasked).toHaveLength(10);
      expect(u.panMasked.startsWith("XXXXXX")).toBe(true);
      expect(u.isDummy).toBe(true);
    }
  });

  it("creates 12 monthly snapshots for mature users (P6)", async () => {
    // Mature user U001 registered in March 2024
    const snapshotsU001 = await prisma.scoreSnapshot.findMany({
      where: { userId: "U001" },
      orderBy: { period: "asc" }
    });
    expect(snapshotsU001).toHaveLength(12);
    expect(snapshotsU001[0]?.period).toBe("2025-11-01");
    expect(snapshotsU001[11]?.period).toBe("2026-10-01");

    // Brand new user U008 registered 2 days before 2026-10-30 has no historical monthly snapshots
    const snapshotsU008 = await prisma.scoreSnapshot.findMany({
      where: { userId: "U008" }
    });
    expect(snapshotsU008).toHaveLength(0);

    // User U010 registered 45 days before seed date (September 2026) has 1 snapshot (2026-10-01)
    const snapshotsU010 = await prisma.scoreSnapshot.findMany({
      where: { userId: "U010" }
    });
    expect(snapshotsU010).toHaveLength(1);
    expect(snapshotsU010[0]?.period).toBe("2026-10-01");
  });

  it("seeds system configurations, service providers, and fee config", async () => {
    // Scoring config version 1 exists
    const scoringCfg = await prisma.scoringConfig.findUnique({ where: { version: 1 } });
    expect(scoringCfg).not.toBeNull();

    // Fee config: Option A (50 ppm) is active, Option B (100 ppm) is inactive
    const activeFee = await prisma.feeConfig.findFirst({ where: { isActive: true } });
    expect(activeFee).not.toBeNull();
    expect(activeFee!.optionCode).toBe("A");
    expect(activeFee!.ppm).toBe(50);
    expect(activeFee!.mode).toBe("PROVIDER_PAYS");

    const inactiveFee = await prisma.feeConfig.findFirst({ where: { isActive: false } });
    expect(inactiveFee).not.toBeNull();
    expect(inactiveFee!.optionCode).toBe("B");
    expect(inactiveFee!.ppm).toBe(100);

    // Reward config has 12 entries
    const rewardCount = await prisma.rewardConfig.count();
    expect(rewardCount).toBe(12);

    // Providers exist
    const providerCount = await prisma.serviceProvider.count();
    expect(providerCount).toBe(4);
  });

  it("seeds 3 admin users with valid Argon2 password hashes (P9)", async () => {
    const superAdmin = await prisma.admin.findUnique({ where: { email: "superadmin@vai.local" } });
    expect(superAdmin).not.toBeNull();
    expect(superAdmin!.role).toBe("SUPER_ADMIN");
    expect(await verify(superAdmin!.passwordHash, "SuperAdmin@123")).toBe(true);

    const opsAdmin = await prisma.admin.findUnique({ where: { email: "ops@vai.local" } });
    expect(opsAdmin).not.toBeNull();
    expect(opsAdmin!.role).toBe("OPS");
    expect(await verify(opsAdmin!.passwordHash, "OpsAdmin@123")).toBe(true);

    const analyst = await prisma.admin.findUnique({ where: { email: "analyst@vai.local" } });
    expect(analyst).not.toBeNull();
    expect(analyst!.role).toBe("ANALYST");
    expect(await verify(analyst!.passwordHash, "Analyst@123")).toBe(true);
  });

  it("maintains append-only trigger integrity on score_ledger (P1c)", async () => {
    const firstLedger = await prisma.scoreLedger.findFirst();
    expect(firstLedger).not.toBeNull();

    // Attempting to delete from score_ledger must abort via trigger
    await expect(
      prisma.$executeRawUnsafe(
        `DELETE FROM score_ledger WHERE entry_id = ${firstLedger!.entryId};`
      )
    ).rejects.toThrow(/score_ledger is append-only/i);
  });
});
