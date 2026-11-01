import { hash } from "@node-rs/argon2";
import crypto from "node:crypto";
import { prisma } from "./client.js";
import { encryptPan, hashPan } from "../lib/crypto.js";
import { maskPan, maskLicence } from "@vai/shared";
import { DEFAULT_SCORING_CONFIG_V1 } from "../modules/scoring/config.js";
import { scoringService } from "../modules/scoring/service.js";
import { logger } from "../lib/logger.js";

export const SEED_DATE = new Date("2026-10-30T00:00:00.000Z");

export function daysBeforeSeed(days: number): Date {
  return new Date(SEED_DATE.getTime() - days * 86_400_000);
}

export function hashString(val: string): string {
  return crypto.createHash("sha256").update(val).digest("hex");
}

export async function resetDatabase(): Promise<void> {
  // Drop append-only triggers temporarily to allow clean reset
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "score_ledger_no_delete";`);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "score_ledger_no_update";`);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "audit_logs_no_delete";`);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "audit_logs_no_update";`);

  // Delete all records in child-to-parent order
  await prisma.refund.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.scoreJob.deleteMany();
  await prisma.scoreSnapshot.deleteMany();
  await prisma.scoreLedger.deleteMany();
  await prisma.vaiScore.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.challan.deleteMany();
  await prisma.licence.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.rewardConfig.deleteMany();
  await prisma.feeConfig.deleteMany();
  await prisma.scoringConfig.deleteMany();
  await prisma.serviceProvider.deleteMany();
  await prisma.otpSession.deleteMany();

  // Re-create the append-only triggers
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER "score_ledger_no_update"
    BEFORE UPDATE ON "score_ledger"
    BEGIN
        SELECT RAISE(ABORT, 'score_ledger is append-only: UPDATE is prohibited');
    END;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER "score_ledger_no_delete"
    BEFORE DELETE ON "score_ledger"
    BEGIN
        SELECT RAISE(ABORT, 'score_ledger is append-only: DELETE is prohibited');
    END;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER "audit_logs_no_update"
    BEFORE UPDATE ON "audit_logs"
    BEGIN
        SELECT RAISE(ABORT, 'audit_logs is append-only: UPDATE is prohibited');
    END;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER "audit_logs_no_delete"
    BEFORE DELETE ON "audit_logs"
    BEGIN
        SELECT RAISE(ABORT, 'audit_logs is append-only: DELETE is prohibited');
    END;
  `);
}

export async function seedSystemConfigs(): Promise<void> {
  // 1. Scoring Config v1 (TRD 5.3)
  await prisma.scoringConfig.create({
    data: {
      version: 1,
      parameters: JSON.stringify(DEFAULT_SCORING_CONFIG_V1),
      effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
      createdBy: "SYSTEM",
      changeReason: "Initial VAI v1.0 baseline parameters"
    }
  });

  // 2. Reward Config (PRD 8.1 values)
  // FAIR = 0 bps, GOOD = 100 bps (1%), VERY_GOOD = 200 bps (2%)
  const rewardMatrix = [
    { cat: "FAIR", bps: 0 },
    { cat: "GOOD", bps: 100 },
    { cat: "VERY_GOOD", bps: 200 }
  ];
  const serviceTypes = ["INSURANCE", "PUC", "RC", "LICENCE"];

  for (const r of rewardMatrix) {
    for (const st of serviceTypes) {
      await prisma.rewardConfig.create({
        data: {
          vaiCategory: r.cat,
          serviceType: st,
          discountBps: r.bps,
          effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
          createdBy: "SYSTEM"
        }
      });
    }
  }

  // 3. Fee Config: Option A (50 ppm, PROVIDER_PAYS, active by default) and Option B (100 ppm, inactive)
  await prisma.feeConfig.create({
    data: {
      optionCode: "A",
      ppm: 50,
      mode: "PROVIDER_PAYS",
      isActive: true,
      effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
      createdBy: "SYSTEM"
    }
  });

  await prisma.feeConfig.create({
    data: {
      optionCode: "B",
      ppm: 100,
      mode: "PROVIDER_PAYS",
      isActive: false,
      effectiveFrom: new Date("2024-01-01T00:00:00.000Z"),
      createdBy: "SYSTEM"
    }
  });

  // 4. Service Providers
  await prisma.serviceProvider.createMany({
    data: [
      {
        providerId: "PROV-HDFC-001",
        name: "HDFC ERGO General Insurance",
        serviceType: "INSURANCE",
        apiMode: "SIMULATED",
        settlementAccountRef: "ACC-HDFC-9921",
        feeMode: "PROVIDER_PAYS",
        isActive: true
      },
      {
        providerId: "PROV-CLEAN-001",
        name: "CleanAir PUC Center",
        serviceType: "PUC",
        apiMode: "SIMULATED",
        settlementAccountRef: "ACC-CLEAN-4432",
        feeMode: "PROVIDER_PAYS",
        isActive: true
      },
      {
        providerId: "PROV-PARI-001",
        name: "Parivahan RTO Portal",
        serviceType: "RC",
        apiMode: "SIMULATED",
        settlementAccountRef: "ACC-PARI-1109",
        feeMode: "PROVIDER_PAYS",
        isActive: true
      },
      {
        providerId: "PROV-PARI-002",
        name: "Parivahan Sarathi Licence",
        serviceType: "LICENCE",
        apiMode: "SIMULATED",
        settlementAccountRef: "ACC-PARI-1109",
        feeMode: "PROVIDER_PAYS",
        isActive: true
      }
    ]
  });

  // 5. Admins per P9 (SUPER_ADMIN, OPS, ANALYST)
  const passwordHashSuperAdmin = await hash("SuperAdmin@123");
  const passwordHashOps = await hash("OpsAdmin@123");
  const passwordHashAnalyst = await hash("Analyst@123");

  await prisma.admin.createMany({
    data: [
      {
        adminId: "admin-superadmin",
        email: "superadmin@vai.local",
        passwordHash: passwordHashSuperAdmin,
        role: "SUPER_ADMIN",
        isActive: true
      },
      {
        adminId: "admin-ops",
        email: "ops@vai.local",
        passwordHash: passwordHashOps,
        role: "OPS",
        isActive: true
      },
      {
        adminId: "admin-analyst",
        email: "analyst@vai.local",
        passwordHash: passwordHashAnalyst,
        role: "ANALYST",
        isActive: true
      }
    ]
  });
}

export interface SeedUserProfile {
  id: string;
  fullName: string;
  mobile: string;
  pan: string;
  city: string;
  state: string;
  registrationDate: Date;
  targetScore: number;
  targetCategory: string;
  vehicles: Array<{
    vehicleId: string;
    registrationNo: string;
    vehicleType: string;
    manufacturer: string;
    model: string;
    registrationDate: Date;
    insuranceExpiry: Date | null;
    pucExpiry: Date | null;
    rcValidityTill: Date;
  }>;
  licence: {
    licenceId: string;
    licenceNo: string;
    licenceClass: string;
    expiryDate: Date;
  };
  challans: Array<{
    challanId: string;
    vehicleId: string;
    challanDate: Date;
    challanType: string;
    violationCode: string;
    violationDesc: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    amountPaise: bigint;
    status: string;
    dueDate: Date;
    paymentDate: Date | null;
    scoringEligible: boolean;
  }>;
}

export function buildSeedProfiles(): SeedUserProfile[] {
  return [
    // U001: 1 two-wheeler, all docs valid, licence valid, 0 challans, reg 2024-03-14 -> 765 VERY_GOOD
    {
      id: "U001",
      fullName: "Priya Sharma",
      mobile: "+919000000001",
      pan: "DUMMY1001X",
      city: "Bengaluru",
      state: "Karnataka",
      registrationDate: new Date("2024-03-14T00:00:00.000Z"),
      targetScore: 765,
      targetCategory: "VERY_GOOD",
      vehicles: [
        {
          vehicleId: "VEH-U001-01",
          registrationNo: "KA01AB1001",
          vehicleType: "TWO_WHEELER",
          manufacturer: "Honda",
          model: "Activa 6G",
          registrationDate: new Date("2024-03-14T00:00:00.000Z"),
          insuranceExpiry: new Date("2027-03-14T00:00:00.000Z"),
          pucExpiry: new Date("2027-03-14T00:00:00.000Z"),
          rcValidityTill: new Date("2039-03-14T00:00:00.000Z")
        }
      ],
      licence: {
        licenceId: "LIC-U001-01",
        licenceNo: "KA0120240001001",
        licenceClass: "MCWG",
        expiryDate: new Date("2034-03-14T00:00:00.000Z")
      },
      challans: []
    },

    // U002: 1 four-wheeler, 3 LOW distinct codes PAID on time (ages 700, 400, 150) -> 742 GOOD
    {
      id: "U002",
      fullName: "Vikram Malhotra",
      mobile: "+919000000002",
      pan: "DUMMY1002X",
      city: "Mumbai",
      state: "Maharashtra",
      registrationDate: new Date("2024-01-01T00:00:00.000Z"),
      targetScore: 742,
      targetCategory: "GOOD",
      vehicles: [
        {
          vehicleId: "VEH-U002-01",
          registrationNo: "MH02CD2002",
          vehicleType: "FOUR_WHEELER",
          manufacturer: "Tata",
          model: "Nexon",
          registrationDate: new Date("2024-01-01T00:00:00.000Z"),
          insuranceExpiry: new Date("2027-01-01T00:00:00.000Z"),
          pucExpiry: new Date("2027-01-01T00:00:00.000Z"),
          rcValidityTill: new Date("2039-01-01T00:00:00.000Z")
        }
      ],
      licence: {
        licenceId: "LIC-U002-01",
        licenceNo: "MH0220240002002",
        licenceClass: "LMV",
        expiryDate: new Date("2034-01-01T00:00:00.000Z")
      },
      challans: [
        {
          challanId: "CH-U002-01",
          vehicleId: "VEH-U002-01",
          challanDate: daysBeforeSeed(700),
          challanType: "TRAFFIC",
          violationCode: "SPD",
          violationDesc: "Speeding over limit",
          severity: "LOW",
          amountPaise: 100000n,
          status: "PAID",
          dueDate: daysBeforeSeed(640),
          paymentDate: daysBeforeSeed(660),
          scoringEligible: true
        },
        {
          challanId: "CH-U002-02",
          vehicleId: "VEH-U002-01",
          challanDate: daysBeforeSeed(400),
          challanType: "TRAFFIC",
          violationCode: "PARK",
          violationDesc: "Improper parking",
          severity: "LOW",
          amountPaise: 50000n,
          status: "PAID",
          dueDate: daysBeforeSeed(340),
          paymentDate: daysBeforeSeed(360),
          scoringEligible: true
        },
        {
          challanId: "CH-U002-03",
          vehicleId: "VEH-U002-01",
          challanDate: daysBeforeSeed(150),
          challanType: "TRAFFIC",
          violationCode: "HELM",
          violationDesc: "Pillion without helmet",
          severity: "LOW",
          amountPaise: 50000n,
          status: "PAID",
          dueDate: daysBeforeSeed(90),
          paymentDate: daysBeforeSeed(110),
          scoringEligible: true
        }
      ]
    },

    // U003: 2 valid vehicles, 9 challans (ages 10, 40, 75, 110, 150, 200, 250, 300, 340).
    // MEDIUM at 40, 75, 150. LOW at rest. Codes: RLVD x3, HELM x3, SPD x2, PARK x1.
    // 4 newest UNPAID; 5 older PAID on time -> 591 FAIR
    {
      id: "U003",
      fullName: "Amit Patel",
      mobile: "+919000000003",
      pan: "DUMMY1003X",
      city: "Ahmedabad",
      state: "Gujarat",
      registrationDate: new Date("2024-01-01T00:00:00.000Z"),
      targetScore: 591,
      targetCategory: "FAIR",
      vehicles: [
        {
          vehicleId: "VEH-U003-01",
          registrationNo: "GJ01EF3003",
          vehicleType: "FOUR_WHEELER",
          manufacturer: "Hyundai",
          model: "Creta",
          registrationDate: new Date("2024-01-01T00:00:00.000Z"),
          insuranceExpiry: new Date("2027-01-01T00:00:00.000Z"),
          pucExpiry: new Date("2027-01-01T00:00:00.000Z"),
          rcValidityTill: new Date("2039-01-01T00:00:00.000Z")
        },
        {
          vehicleId: "VEH-U003-02",
          registrationNo: "GJ01GH3004",
          vehicleType: "TWO_WHEELER",
          manufacturer: "TVS",
          model: "Jupiter",
          registrationDate: new Date("2024-01-01T00:00:00.000Z"),
          insuranceExpiry: new Date("2027-01-01T00:00:00.000Z"),
          pucExpiry: new Date("2027-01-01T00:00:00.000Z"),
          rcValidityTill: new Date("2039-01-01T00:00:00.000Z")
        }
      ],
      licence: {
        licenceId: "LIC-U003-01",
        licenceNo: "GJ0120240003003",
        licenceClass: "LMV",
        expiryDate: new Date("2034-01-01T00:00:00.000Z")
      },
      challans: [
        {
          challanId: "CH-U003-01",
          vehicleId: "VEH-U003-01",
          challanDate: daysBeforeSeed(10),
          challanType: "TRAFFIC",
          violationCode: "RLVD",
          violationDesc: "Red light violation",
          severity: "LOW",
          amountPaise: 100000n,
          status: "UNPAID",
          dueDate: daysBeforeSeed(10 - 60), // future
          paymentDate: null,
          scoringEligible: true
        },
        {
          challanId: "CH-U003-02",
          vehicleId: "VEH-U003-01",
          challanDate: daysBeforeSeed(40),
          challanType: "TRAFFIC",
          violationCode: "HELM",
          violationDesc: "Helmet violation",
          severity: "MEDIUM",
          amountPaise: 150000n,
          status: "UNPAID",
          dueDate: daysBeforeSeed(40 - 60), // future
          paymentDate: null,
          scoringEligible: true
        },
        {
          challanId: "CH-U003-03",
          vehicleId: "VEH-U003-01",
          challanDate: daysBeforeSeed(75),
          challanType: "TRAFFIC",
          violationCode: "RLVD",
          violationDesc: "Red light violation",
          severity: "MEDIUM",
          amountPaise: 200000n,
          status: "UNPAID",
          dueDate: daysBeforeSeed(75 - 60), // 15 days overdue
          paymentDate: null,
          scoringEligible: true
        },
        {
          challanId: "CH-U003-04",
          vehicleId: "VEH-U003-02",
          challanDate: daysBeforeSeed(110),
          challanType: "TRAFFIC",
          violationCode: "HELM",
          violationDesc: "Helmet violation",
          severity: "LOW",
          amountPaise: 50000n,
          status: "UNPAID",
          dueDate: daysBeforeSeed(110 - 60), // 50 days overdue
          paymentDate: null,
          scoringEligible: true
        },
        {
          challanId: "CH-U003-05",
          vehicleId: "VEH-U003-01",
          challanDate: daysBeforeSeed(150),
          challanType: "TRAFFIC",
          violationCode: "SPD",
          violationDesc: "Speed violation",
          severity: "MEDIUM",
          amountPaise: 200000n,
          status: "PAID",
          dueDate: daysBeforeSeed(90),
          paymentDate: daysBeforeSeed(120),
          scoringEligible: true
        },
        {
          challanId: "CH-U003-06",
          vehicleId: "VEH-U003-01",
          challanDate: daysBeforeSeed(200),
          challanType: "TRAFFIC",
          violationCode: "RLVD",
          violationDesc: "Red light violation",
          severity: "LOW",
          amountPaise: 100000n,
          status: "PAID",
          dueDate: daysBeforeSeed(140),
          paymentDate: daysBeforeSeed(160),
          scoringEligible: true
        },
        {
          challanId: "CH-U003-07",
          vehicleId: "VEH-U003-02",
          challanDate: daysBeforeSeed(250),
          challanType: "TRAFFIC",
          violationCode: "HELM",
          violationDesc: "Helmet violation",
          severity: "LOW",
          amountPaise: 50000n,
          status: "PAID",
          dueDate: daysBeforeSeed(190),
          paymentDate: daysBeforeSeed(210),
          scoringEligible: true
        },
        {
          challanId: "CH-U003-08",
          vehicleId: "VEH-U003-01",
          challanDate: daysBeforeSeed(300),
          challanType: "TRAFFIC",
          violationCode: "SPD",
          violationDesc: "Speed violation",
          severity: "LOW",
          amountPaise: 100000n,
          status: "PAID",
          dueDate: daysBeforeSeed(240),
          paymentDate: daysBeforeSeed(260),
          scoringEligible: true
        },
        {
          challanId: "CH-U003-09",
          vehicleId: "VEH-U003-01",
          challanDate: daysBeforeSeed(340),
          challanType: "TRAFFIC",
          violationCode: "PARK",
          violationDesc: "Parking violation",
          severity: "LOW",
          amountPaise: 50000n,
          status: "PAID",
          dueDate: daysBeforeSeed(280),
          paymentDate: daysBeforeSeed(300),
          scoringEligible: true
        }
      ]
    },

    // U004: 1 four-wheeler (insurance & PUC expired, RC valid); 2 HIGH same code (SPD), ages 62 & 100, both PAID late -> 634 FAIR
    {
      id: "U004",
      fullName: "Rajesh Kumar",
      mobile: "+919000000004",
      pan: "DUMMY1004X",
      city: "Delhi",
      state: "Delhi",
      registrationDate: new Date("2024-01-01T00:00:00.000Z"),
      targetScore: 634,
      targetCategory: "FAIR",
      vehicles: [
        {
          vehicleId: "VEH-U004-01",
          registrationNo: "DL01IJ4005",
          vehicleType: "FOUR_WHEELER",
          manufacturer: "Maruti Suzuki",
          model: "Swift",
          registrationDate: new Date("2024-01-01T00:00:00.000Z"),
          insuranceExpiry: new Date("2026-09-01T00:00:00.000Z"), // expired 59d ago
          pucExpiry: new Date("2026-08-01T00:00:00.000Z"), // expired 90d ago
          rcValidityTill: new Date("2035-01-01T00:00:00.000Z") // valid
        }
      ],
      licence: {
        licenceId: "LIC-U004-01",
        licenceNo: "DL0120240004004",
        licenceClass: "LMV",
        expiryDate: new Date("2034-01-01T00:00:00.000Z")
      },
      challans: [
        {
          challanId: "CH-U004-01",
          vehicleId: "VEH-U004-01",
          challanDate: daysBeforeSeed(62),
          challanType: "TRAFFIC",
          violationCode: "SPD",
          violationDesc: "Dangerous overspeeding",
          severity: "HIGH",
          amountPaise: 250000n,
          status: "PAID",
          dueDate: daysBeforeSeed(2),
          paymentDate: daysBeforeSeed(1), // paid 1 day after due date (late)
          scoringEligible: true
        },
        {
          challanId: "CH-U004-02",
          vehicleId: "VEH-U004-01",
          challanDate: daysBeforeSeed(100),
          challanType: "TRAFFIC",
          violationCode: "SPD",
          violationDesc: "Dangerous overspeeding",
          severity: "HIGH",
          amountPaise: 250000n,
          status: "PAID",
          dueDate: daysBeforeSeed(40),
          paymentDate: daysBeforeSeed(20), // paid 20 days after due date (late)
          scoringEligible: true
        }
      ]
    },

    // U005: 1 two-wheeler, valid; 4 UNPAID (LOW, MED, LOW, LOW; distinct codes), ages 20/75/120/200 (3 past due) -> 630 FAIR
    {
      id: "U005",
      fullName: "Suresh Nair",
      mobile: "+919000000005",
      pan: "DUMMY1005X",
      city: "Kochi",
      state: "Kerala",
      registrationDate: new Date("2024-01-01T00:00:00.000Z"),
      targetScore: 630,
      targetCategory: "FAIR",
      vehicles: [
        {
          vehicleId: "VEH-U005-01",
          registrationNo: "KL07KL5006",
          vehicleType: "TWO_WHEELER",
          manufacturer: "Hero",
          model: "Splendor Plus",
          registrationDate: new Date("2024-01-01T00:00:00.000Z"),
          insuranceExpiry: new Date("2027-01-01T00:00:00.000Z"),
          pucExpiry: new Date("2027-01-01T00:00:00.000Z"),
          rcValidityTill: new Date("2039-01-01T00:00:00.000Z")
        }
      ],
      licence: {
        licenceId: "LIC-U005-01",
        licenceNo: "KL0720240005005",
        licenceClass: "MCWG",
        expiryDate: new Date("2034-01-01T00:00:00.000Z")
      },
      challans: [
        {
          challanId: "CH-U005-01",
          vehicleId: "VEH-U005-01",
          challanDate: daysBeforeSeed(20),
          challanType: "TRAFFIC",
          violationCode: "SPD",
          violationDesc: "Speed violation",
          severity: "LOW",
          amountPaise: 100000n,
          status: "UNPAID",
          dueDate: daysBeforeSeed(20 - 60), // not overdue
          paymentDate: null,
          scoringEligible: true
        },
        {
          challanId: "CH-U005-02",
          vehicleId: "VEH-U005-01",
          challanDate: daysBeforeSeed(75),
          challanType: "TRAFFIC",
          violationCode: "PARK",
          violationDesc: "Obstruction parking",
          severity: "MEDIUM",
          amountPaise: 150000n,
          status: "UNPAID",
          dueDate: daysBeforeSeed(15), // 15 days overdue
          paymentDate: null,
          scoringEligible: true
        },
        {
          challanId: "CH-U005-03",
          vehicleId: "VEH-U005-01",
          challanDate: daysBeforeSeed(120),
          challanType: "TRAFFIC",
          violationCode: "HELM",
          violationDesc: "Riding without helmet",
          severity: "LOW",
          amountPaise: 50000n,
          status: "UNPAID",
          dueDate: daysBeforeSeed(60), // 60 days overdue
          paymentDate: null,
          scoringEligible: true
        },
        {
          challanId: "CH-U005-04",
          vehicleId: "VEH-U005-01",
          challanDate: daysBeforeSeed(200),
          challanType: "TRAFFIC",
          violationCode: "SEAT",
          violationDesc: "Seatbelt violation",
          severity: "LOW",
          amountPaise: 100000n,
          status: "UNPAID",
          dueDate: daysBeforeSeed(140), // 140 days overdue
          paymentDate: null,
          scoringEligible: true
        }
      ]
    },

    // U006: 1 four-wheeler, valid; 2 LOW PAID on time, ages 200 & 300 -> 765 VERY_GOOD
    {
      id: "U006",
      fullName: "Deepa Srinivasan",
      mobile: "+919000000006",
      pan: "DUMMY1006X",
      city: "Chennai",
      state: "Tamil Nadu",
      registrationDate: new Date("2024-01-01T00:00:00.000Z"),
      targetScore: 765,
      targetCategory: "VERY_GOOD",
      vehicles: [
        {
          vehicleId: "VEH-U006-01",
          registrationNo: "TN09MN6007",
          vehicleType: "FOUR_WHEELER",
          manufacturer: "Honda",
          model: "City",
          registrationDate: new Date("2024-01-01T00:00:00.000Z"),
          insuranceExpiry: new Date("2027-01-01T00:00:00.000Z"),
          pucExpiry: new Date("2027-01-01T00:00:00.000Z"),
          rcValidityTill: new Date("2039-01-01T00:00:00.000Z")
        }
      ],
      licence: {
        licenceId: "LIC-U006-01",
        licenceNo: "TN0920240006006",
        licenceClass: "LMV",
        expiryDate: new Date("2034-01-01T00:00:00.000Z")
      },
      challans: [
        {
          challanId: "CH-U006-01",
          vehicleId: "VEH-U006-01",
          challanDate: daysBeforeSeed(200),
          challanType: "TRAFFIC",
          violationCode: "SPD",
          violationDesc: "Speed violation",
          severity: "LOW",
          amountPaise: 100000n,
          status: "PAID",
          dueDate: daysBeforeSeed(140),
          paymentDate: daysBeforeSeed(170),
          scoringEligible: true
        },
        {
          challanId: "CH-U006-02",
          vehicleId: "VEH-U006-01",
          challanDate: daysBeforeSeed(300),
          challanType: "TRAFFIC",
          violationCode: "PARK",
          violationDesc: "Parking violation",
          severity: "LOW",
          amountPaise: 50000n,
          status: "PAID",
          dueDate: daysBeforeSeed(240),
          paymentDate: daysBeforeSeed(270),
          scoringEligible: true
        }
      ]
    },

    // U007: 3 commercial vehicles, 1 with expired PUC; LOW age 90, MED age 150, both PAID on time -> 726 GOOD
    {
      id: "U007",
      fullName: "Rahul Singh",
      mobile: "+919000000007",
      pan: "DUMMY1007X",
      city: "Gurugram",
      state: "Haryana",
      registrationDate: new Date("2024-01-01T00:00:00.000Z"),
      targetScore: 726,
      targetCategory: "GOOD",
      vehicles: [
        {
          vehicleId: "VEH-U007-01",
          registrationNo: "HR55OP7008",
          vehicleType: "COMMERCIAL",
          manufacturer: "Tata",
          model: "Ace",
          registrationDate: new Date("2024-01-01T00:00:00.000Z"),
          insuranceExpiry: new Date("2027-01-01T00:00:00.000Z"),
          pucExpiry: new Date("2027-01-01T00:00:00.000Z"),
          rcValidityTill: new Date("2034-01-01T00:00:00.000Z")
        },
        {
          vehicleId: "VEH-U007-02",
          registrationNo: "HR55QR7009",
          vehicleType: "COMMERCIAL",
          manufacturer: "Mahindra",
          model: "Bolero Maxi Truck",
          registrationDate: new Date("2024-01-01T00:00:00.000Z"),
          insuranceExpiry: new Date("2027-01-01T00:00:00.000Z"),
          pucExpiry: new Date("2027-01-01T00:00:00.000Z"),
          rcValidityTill: new Date("2034-01-01T00:00:00.000Z")
        },
        {
          vehicleId: "VEH-U007-03",
          registrationNo: "HR55ST7010",
          vehicleType: "COMMERCIAL",
          manufacturer: "Ashok Leyland",
          model: "Dost",
          registrationDate: new Date("2024-01-01T00:00:00.000Z"),
          insuranceExpiry: new Date("2027-01-01T00:00:00.000Z"),
          pucExpiry: new Date("2026-08-01T00:00:00.000Z"), // expired 90d ago
          rcValidityTill: new Date("2034-01-01T00:00:00.000Z")
        }
      ],
      licence: {
        licenceId: "LIC-U007-01",
        licenceNo: "HR5520240007007",
        licenceClass: "TRANS",
        expiryDate: new Date("2034-01-01T00:00:00.000Z")
      },
      challans: [
        {
          challanId: "CH-U007-01",
          vehicleId: "VEH-U007-01",
          challanDate: daysBeforeSeed(90),
          challanType: "TRAFFIC",
          violationCode: "SPD",
          violationDesc: "Speed violation",
          severity: "LOW",
          amountPaise: 100000n,
          status: "PAID",
          dueDate: daysBeforeSeed(30),
          paymentDate: daysBeforeSeed(60),
          scoringEligible: true
        },
        {
          challanId: "CH-U007-02",
          vehicleId: "VEH-U007-01",
          challanDate: daysBeforeSeed(150),
          challanType: "TRAFFIC",
          violationCode: "OVERLOAD",
          violationDesc: "Commercial overload",
          severity: "MEDIUM",
          amountPaise: 300000n,
          status: "PAID",
          dueDate: daysBeforeSeed(90),
          paymentDate: daysBeforeSeed(120),
          scoringEligible: true
        }
      ]
    },

    // U008: 1 two-wheeler, valid, registered 2 days ago, no challans -> 715 GOOD
    {
      id: "U008",
      fullName: "Ananya Iyer",
      mobile: "+919000000008",
      pan: "DUMMY1008X",
      city: "Pune",
      state: "Maharashtra",
      registrationDate: daysBeforeSeed(2),
      targetScore: 715,
      targetCategory: "GOOD",
      vehicles: [
        {
          vehicleId: "VEH-U008-01",
          registrationNo: "MH12UV8011",
          vehicleType: "TWO_WHEELER",
          manufacturer: "Bajaj",
          model: "Pulsar 150",
          registrationDate: daysBeforeSeed(2),
          insuranceExpiry: new Date("2027-10-28T00:00:00.000Z"),
          pucExpiry: new Date("2027-10-28T00:00:00.000Z"),
          rcValidityTill: new Date("2039-10-28T00:00:00.000Z")
        }
      ],
      licence: {
        licenceId: "LIC-U008-01",
        licenceNo: "MH1220260008008",
        licenceClass: "MCWG",
        expiryDate: new Date("2036-10-28T00:00:00.000Z")
      },
      challans: []
    },

    // U009: 2 vehicles with insurance & PUC expired, licence expired; 1 MED age 40 PAID on time -> 669 GOOD
    {
      id: "U009",
      fullName: "Manoj Verma",
      mobile: "+919000000009",
      pan: "DUMMY1009X",
      city: "Jaipur",
      state: "Rajasthan",
      registrationDate: new Date("2024-01-01T00:00:00.000Z"),
      targetScore: 669,
      targetCategory: "GOOD",
      vehicles: [
        {
          vehicleId: "VEH-U009-01",
          registrationNo: "RJ14WX9012",
          vehicleType: "FOUR_WHEELER",
          manufacturer: "Toyota",
          model: "Innova",
          registrationDate: new Date("2024-01-01T00:00:00.000Z"),
          insuranceExpiry: new Date("2026-07-01T00:00:00.000Z"), // expired
          pucExpiry: new Date("2026-06-01T00:00:00.000Z"), // expired
          rcValidityTill: new Date("2034-01-01T00:00:00.000Z") // valid
        },
        {
          vehicleId: "VEH-U009-02",
          registrationNo: "RJ14YZ9013",
          vehicleType: "TWO_WHEELER",
          manufacturer: "Hero",
          model: "Pleasure",
          registrationDate: new Date("2024-01-01T00:00:00.000Z"),
          insuranceExpiry: new Date("2026-07-01T00:00:00.000Z"), // expired
          pucExpiry: new Date("2026-06-01T00:00:00.000Z"), // expired
          rcValidityTill: new Date("2034-01-01T00:00:00.000Z") // valid
        }
      ],
      licence: {
        licenceId: "LIC-U009-01",
        licenceNo: "RJ1420240009009",
        licenceClass: "LMV",
        expiryDate: new Date("2026-05-01T00:00:00.000Z") // EXPIRED!
      },
      challans: [
        {
          challanId: "CH-U009-01",
          vehicleId: "VEH-U009-01",
          challanDate: daysBeforeSeed(40),
          challanType: "TRAFFIC",
          violationCode: "SPD",
          violationDesc: "Speed violation",
          severity: "MEDIUM",
          amountPaise: 200000n,
          status: "PAID",
          dueDate: daysBeforeSeed(40 - 60),
          paymentDate: daysBeforeSeed(20), // paid on time
          scoringEligible: true
        }
      ]
    },

    // U010: 1 four-wheeler valid, reg 45 days ago; 2 DISPUTED and 1 PENDING challans -> 725 GOOD
    {
      id: "U010",
      fullName: "Anita Desai",
      mobile: "+919000000010",
      pan: "DUMMY1010X",
      city: "Kolkata",
      state: "West Bengal",
      registrationDate: daysBeforeSeed(45),
      targetScore: 725,
      targetCategory: "GOOD",
      vehicles: [
        {
          vehicleId: "VEH-U010-01",
          registrationNo: "WB02ZA0014",
          vehicleType: "FOUR_WHEELER",
          manufacturer: "Hyundai",
          model: "i20",
          registrationDate: daysBeforeSeed(45),
          insuranceExpiry: new Date("2027-09-15T00:00:00.000Z"),
          pucExpiry: new Date("2027-09-15T00:00:00.000Z"),
          rcValidityTill: new Date("2039-09-15T00:00:00.000Z")
        }
      ],
      licence: {
        licenceId: "LIC-U010-01",
        licenceNo: "WB0220260010010",
        licenceClass: "LMV",
        expiryDate: new Date("2036-09-15T00:00:00.000Z")
      },
      challans: [
        {
          challanId: "CH-U010-01",
          vehicleId: "VEH-U010-01",
          challanDate: daysBeforeSeed(15),
          challanType: "TRAFFIC",
          violationCode: "SPD",
          violationDesc: "Pending camera detection",
          severity: "LOW",
          amountPaise: 100000n,
          status: "PENDING",
          dueDate: daysBeforeSeed(15 - 60),
          paymentDate: null,
          scoringEligible: false
        },
        {
          challanId: "CH-U010-02",
          vehicleId: "VEH-U010-01",
          challanDate: daysBeforeSeed(25),
          challanType: "TRAFFIC",
          violationCode: "RLVD",
          violationDesc: "Disputed signal jump",
          severity: "MEDIUM",
          amountPaise: 200000n,
          status: "DISPUTED",
          dueDate: daysBeforeSeed(25 - 60),
          paymentDate: null,
          scoringEligible: false
        },
        {
          challanId: "CH-U010-03",
          vehicleId: "VEH-U010-01",
          challanDate: daysBeforeSeed(35),
          challanType: "TRAFFIC",
          violationCode: "PARK",
          violationDesc: "Disputed no-parking sign",
          severity: "LOW",
          amountPaise: 50000n,
          status: "DISPUTED",
          dueDate: daysBeforeSeed(35 - 60),
          paymentDate: null,
          scoringEligible: false
        }
      ]
    }
  ];
}

export async function seedUsersAndChallans(profiles: SeedUserProfile[]): Promise<void> {
  const consentPurposes = ["IDENTITY_VERIFICATION", "VAI_SCORING", "REWARD_DISCOUNT"];
  const consentHash = hashString("VAI Citizen Consent v1.0 - DPDP Act 2023 Compliant");

  for (const p of profiles) {
    const panEnc = encryptPan(p.pan);
    const panH = hashPan(p.pan);
    const panM = maskPan(p.pan);

    // 1. Create User
    const user = await prisma.user.create({
      data: {
        userId: p.id,
        fullName: p.fullName,
        mobileE164: p.mobile,
        panEncrypted: panEnc,
        panHash: panH,
        panMasked: panM,
        city: p.city,
        state: p.state,
        registrationDate: p.registrationDate,
        status: "ACTIVE",
        isDummy: true
      }
    });

    // 2. Consents
    for (const purpose of consentPurposes) {
      await prisma.consentRecord.create({
        data: {
          userId: user.userId,
          purpose,
          granted: true,
          versionTextHash: consentHash,
          capturedAt: user.registrationDate
        }
      });
    }

    // 3. Vehicles
    for (const v of p.vehicles) {
      await prisma.vehicle.create({
        data: {
          vehicleId: v.vehicleId,
          userId: user.userId,
          registrationNo: v.registrationNo,
          vehicleType: v.vehicleType,
          manufacturer: v.manufacturer,
          model: v.model,
          registrationDate: v.registrationDate,
          insuranceExpiry: v.insuranceExpiry,
          pucExpiry: v.pucExpiry,
          rcValidityTill: v.rcValidityTill
        }
      });
    }

    // 4. Licence
    await prisma.licence.create({
      data: {
        licenceId: p.licence.licenceId,
        userId: user.userId,
        licenceNoMasked: maskLicence(p.licence.licenceNo),
        licenceClass: p.licence.licenceClass,
        expiryDate: p.licence.expiryDate
      }
    });

    // 5. Challans
    for (const c of p.challans) {
      await prisma.challan.create({
        data: {
          challanId: c.challanId,
          userId: user.userId,
          vehicleId: c.vehicleId,
          challanDate: c.challanDate,
          challanType: c.challanType,
          violationCode: c.violationCode,
          violationDesc: c.violationDesc,
          severity: c.severity,
          amountPaise: c.amountPaise,
          status: c.status,
          dueDate: c.dueDate,
          paymentDate: c.paymentDate,
          scoringEligible: c.scoringEligible
        }
      });

      // If DISPUTED, create dispute row
      if (c.status === "DISPUTED") {
        await prisma.dispute.create({
          data: {
            challanId: c.challanId,
            userId: user.userId,
            openedAt: c.challanDate,
            note: `Dispute opened by citizen for challan ${c.challanId}: incorrect violation capture.`
          }
        });
      }
    }
  }
}

/**
 * Backfills 12 monthly snapshots for mature users with disableCap = true (P6).
 */
export async function backfillSnapshots(profiles: SeedUserProfile[]): Promise<void> {
  const snapshotDates = [
    new Date("2025-11-01T00:00:00.000Z"),
    new Date("2025-12-01T00:00:00.000Z"),
    new Date("2026-01-01T00:00:00.000Z"),
    new Date("2026-02-01T00:00:00.000Z"),
    new Date("2026-03-01T00:00:00.000Z"),
    new Date("2026-04-01T00:00:00.000Z"),
    new Date("2026-05-01T00:00:00.000Z"),
    new Date("2026-06-01T00:00:00.000Z"),
    new Date("2026-07-01T00:00:00.000Z"),
    new Date("2026-08-01T00:00:00.000Z"),
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-10-01T00:00:00.000Z")
  ];

  for (const p of profiles) {
    for (const snapDate of snapshotDates) {
      if (p.registrationDate <= snapDate) {
        const year = snapDate.getUTCFullYear();
        const month = String(snapDate.getUTCMonth() + 1).padStart(2, "0");
        const period = `${year}-${month}-01`;

        const calc = await scoringService.recalculateUserScore(p.id, {
          asOfDate: snapDate,
          disableCap: true,
          writeLedger: false
        });

        await prisma.scoreSnapshot.create({
          data: {
            userId: p.id,
            period,
            score: calc.score,
            category: calc.category,
            createdAt: snapDate
          }
        });
      }
    }
  }
}

/**
 * Evaluates the final score and generates ledger records as of SEED_DATE (2026-10-30).
 */
export async function computeFinalSeedScores(
  profiles: SeedUserProfile[]
): Promise<Array<{ id: string; target: number; actual: number; category: string; match: boolean }>> {
  const results = [];

  for (const p of profiles) {
    const calc = await scoringService.recalculateUserScore(p.id, {
      asOfDate: SEED_DATE,
      disableCap: true,
      writeLedger: true
    });

    const diff = Math.abs(calc.score - p.targetScore);
    const match = diff <= 1;

    results.push({
      id: p.id,
      target: p.targetScore,
      actual: calc.score,
      category: calc.category,
      match
    });
  }

  return results;
}

/**
 * TRD 18.3 Referential Integrity and Invariant Validation.
 */
export async function validateReferentialIntegrity(): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // 1. Every challan references one user and one vehicle, and vehicle must belong to the same user
  const challans = await prisma.challan.findMany({
    include: { user: true, vehicle: true }
  });
  for (const c of challans) {
    if (!c.user) errors.push(`Challan ${c.challanId} has missing user`);
    if (!c.vehicle) errors.push(`Challan ${c.challanId} has missing vehicle`);
    if (c.vehicle && c.vehicle.userId !== c.userId) {
      errors.push(`Challan ${c.challanId} vehicle userId (${c.vehicle.userId}) mismatch with challan userId (${c.userId})`);
    }
  }

  // 2. All masked PANs are exactly 10 characters (P2)
  const users = await prisma.user.findMany();
  for (const u of users) {
    if (u.panMasked.length !== 10) {
      errors.push(`User ${u.userId} has panMasked length ${u.panMasked.length} !== 10 (${u.panMasked})`);
    }
    if (!u.isDummy) {
      errors.push(`User ${u.userId} has isDummy = false in seeded prototype dataset`);
    }
  }

  // 3. Every score is between 500 and 900
  const scores = await prisma.vaiScore.findMany();
  for (const s of scores) {
    if (s.score < 500 || s.score > 900) {
      errors.push(`Score for user ${s.userId} is ${s.score}, outside [500, 900]`);
    }
  }

  // 4. Exactly one fee_config is active (P1c)
  const activeFeeConfigs = await prisma.feeConfig.count({
    where: { isActive: true }
  });
  if (activeFeeConfigs !== 1) {
    errors.push(`Expected exactly 1 active fee_config, found ${activeFeeConfigs}`);
  }

  // 5. Config versions in ledger exist
  const configs = await prisma.scoringConfig.findMany({ select: { version: true } });
  const validVersions = new Set(configs.map((c) => c.version));
  const ledgerEntries = await prisma.scoreLedger.findMany({ select: { configVersion: true, entryId: true } });
  for (const entry of ledgerEntries) {
    if (!validVersions.has(entry.configVersion)) {
      errors.push(`Ledger entry ${entry.entryId} references non-existent configVersion ${entry.configVersion}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Main seed executor.
 */
export async function seed(): Promise<void> {
  logger.info("Starting deterministic database seeding (Seed date: 2026-10-30)...");

  await resetDatabase();
  logger.info("Database reset complete.");

  await seedSystemConfigs();
  logger.info("System configs, providers, and admins seeded.");

  const profiles = buildSeedProfiles();
  await seedUsersAndChallans(profiles);
  logger.info("10 dummy user profiles, vehicles, licences, consents, and challans seeded.");

  await backfillSnapshots(profiles);
  logger.info("Backfilled 12 monthly snapshots for mature profiles.");

  const scoreResults = await computeFinalSeedScores(profiles);
  logger.info("Final seed scores computed and ledger generated.");

  const validation = await validateReferentialIntegrity();
  if (!validation.valid) {
    logger.error({ errors: validation.errors }, "Referential integrity validation failed!");
    throw new Error(`Referential integrity failure:\n${validation.errors.join("\n")}`);
  }
  logger.info("Referential integrity validation (TRD 18.3) passed cleanly.");

  console.log("\n==========================================================================");
  console.log("  VAI PROTOCOL DETERMINISTIC SEED TARGETS (SEED DATE: 2026-10-30)");
  console.log("==========================================================================");
  console.log("User ID | Target Score | Actual Score | Category   | Status");
  console.log("--------------------------------------------------------------------------");
  for (const r of scoreResults) {
    console.log(
      `${r.id.padEnd(8)}| ${String(r.target).padEnd(13)}| ${String(r.actual).padEnd(13)}| ${r.category.padEnd(11)}| ${r.match ? "PASSED" : "FAILED"}`
    );
  }
  console.log("==========================================================================\n");

  const allPassed = scoreResults.every((r) => r.match);
  if (!allPassed) {
    throw new Error("One or more seed score targets failed verification!");
  }
}

// Execute directly if run as CLI script
if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seed()
    .then(() => {
      logger.info("Seeding completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, "Seeding failed.");
      process.exit(1);
    });
}
