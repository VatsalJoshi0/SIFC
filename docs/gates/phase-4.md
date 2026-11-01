# Phase 4 Gate Report: Seed & Worker

> **Phase Status**: COMPLETED  
> **Verification Command**: `npm run verify` (Typecheck, Lint, Test across workspaces)  
> **All Tests Passing**: 58 / 58 tests across 11 test suites (0 errors, 0 warnings)  
> **Gate Objective**: Table of U001–U010 scores within $\pm 1$ of target with TRD 18.3 referential validation passed.

---

## 1. Verified Table of Seed Targets (Seed Date: 2026-10-30)

| User ID | Scenario / Profile Description | Target Score | Actual Score | Category | Status |
|:-------:|--------------------------------|:------------:|:------------:|:--------:|:------:|
| **U001** | Zero challans, registered 2024-03-14, 1 valid 2-wheeler, valid licence | 765 | **765** | VERY_GOOD | **PASSED** ($\Delta = 0$) |
| **U002** | 3 LOW (SPD, PARK, HELM) PAID on time, ages 700/400/150, 1 valid 4-wheeler | 742 | **742** | GOOD | **PASSED** ($\Delta = 0$) |
| **U003** | 2 valid vehicles; 9 challans (codes RLVD x3, HELM x3, SPD x2, PARK x1), 4 newest UNPAID (2 overdue) | 591 | **591** | FAIR | **PASSED** ($\Delta = 0$) |
| **U004** | 1 4-wheeler with insurance & PUC expired; 2 HIGH same code (SPD), ages 62 & 100, both PAID late | 634 | **634** | FAIR | **PASSED** ($\Delta = 0$) |
| **U005** | 1 2-wheeler valid; 4 UNPAID (LOW, MED, LOW, LOW; distinct codes), ages 20/75/120/200 (3 past due) | 630 | **630** | FAIR | **PASSED** ($\Delta = 0$) |
| **U006** | 1 4-wheeler valid; 2 LOW distinct codes PAID on time, ages 200 & 300 | 765 | **765** | VERY_GOOD | **PASSED** ($\Delta = 0$) |
| **U007** | 3 commercial vehicles (1 with expired PUC); LOW age 90, MED age 150, both PAID on time | 726 | **726** | GOOD | **PASSED** ($\Delta = 0$) |
| **U008** | Brand new (registered 2 days ago), 1 2-wheeler valid, 0 challans (starts at 700 + 15 compliance) | 715 | **715** | GOOD | **PASSED** ($\Delta = 0$) |
| **U009** | 2 vehicles with insurance & PUC expired, licence expired; 1 MED age 40 PAID on time | 669 | **669** | GOOD | **PASSED** ($\Delta = 0$) |
| **U010** | 1 4-wheeler valid, registered 45 days ago; 2 DISPUTED and 1 PENDING challans (excluded from scoring) | 725 | **725** | GOOD | **PASSED** ($\Delta = 0$) |

---

## 2. Seeded Configurations & Systems

1. **Scoring Configuration (`scoring_config`)**:
   - Version 1: Parameters parsed and validated against `ScoringParametersSchema`.
   - Effective from `2024-01-01T00:00:00.000Z`, created by `"SYSTEM"`.
2. **Reward Configuration (`reward_config`)**:
   - 12 versioned records mapping 3 VAI tiers to 4 renewal services (PRD 8.1):
     - `FAIR`: 0 bps (0%) on INSURANCE, PUC, RC, LICENCE.
     - `GOOD`: 100 bps (1%) on INSURANCE, PUC, RC, LICENCE.
     - `VERY_GOOD`: 200 bps (2%) on INSURANCE, PUC, RC, LICENCE.
3. **Fee Configuration (`fee_config`)**:
   - **Option A (Default & Active)**: 50 ppm (0.005%), `PROVIDER_PAYS`, `isActive: true`.
   - **Option B**: 100 ppm (0.010%), `PROVIDER_PAYS`, `isActive: false`.
   - Enforced by SQLite partial unique index `fee_config_single_active_uq`.
4. **Simulated Service Providers (`service_providers`)**:
   - `PROV-HDFC-001`: HDFC ERGO General Insurance (`INSURANCE`)
   - `PROV-CLEAN-001`: CleanAir PUC Center (`PUC`)
   - `PROV-PARI-001`: Parivahan RTO Portal (`RC`)
   - `PROV-PARI-002`: Parivahan Sarathi Licence (`LICENCE`)
5. **Seeded Administrators (P9)**:
   - `superadmin@vai.local`: Role `SUPER_ADMIN`, password `SuperAdmin@123` (Argon2id)
   - `ops@vai.local`: Role `OPS`, password `OpsAdmin@123` (Argon2id)
   - `analyst@vai.local`: Role `ANALYST`, password `Analyst@123` (Argon2id)
6. **Consents (`consent_records`)**:
   - DPDP Act 2023 compliant consent records seeded for all profiles (`IDENTITY_VERIFICATION`, `VAI_SCORING`, `REWARD_DISCOUNT`).
7. **12 Historical Monthly Snapshots (`score_snapshots`)**:
   - For all mature profiles (U001–U007, U009), 12 backfilled snapshots (`2025-11-01` to `2026-10-01`) evaluated as of month-starts with `disableCap: true` per P6.
   - Brand new profiles (U008) have zero prior snapshots (`previousMonthScore = null`).

---

## 3. In-Process JobQueue and Scoring Worker

- **JobQueue (`apps/api/src/jobs/queue.ts`)**:
  - `enqueueScoreJob(userId, configVersion, scheduledFor)`: Idempotently enqueues jobs, deduplicating against any existing `PENDING` job for the same `(userId, configVersion)`.
  - State transitions: `PENDING` $\to$ `PROCESSING` $\to$ `COMPLETED` / `FAILED`.
- **Scoring Worker (`apps/api/src/jobs/worker.ts`)**:
  - Fetches pending due jobs, executes `recalculateUserScore`, records completion timestamp, and captures error traces if failure occurs.
- **Nightly Cron (`apps/api/src/jobs/cron.ts`)**:
  - Scheduled at `02:00` in `Asia/Kolkata` timezone via `node-cron`.
  - On the 1st of each calendar month: captures snapshots of current scores for active users.
  - Enqueues score recalculation for all active users to refresh violation age-decay and driving streak milestones.
  - Exposes `runNightlyMaintenance(asOf)` for deterministic unit testing.

---

## 4. Referential Integrity & Invariant Validation (TRD 18.3)

All TRD 18.3 checks verified automatically in `validateReferentialIntegrity()`:
- **No orphan records**: Every challan references a valid user and vehicle belonging to that user.
- **PAN Masking length**: Every masked PAN has length 10 (`XXXXXX` + last 4 characters, P2).
- **Score Bounds**: Every score is strictly within $[500, 900]$.
- **Single active fee_config**: Exactly 1 fee configuration is active.
- **Config version integrity**: All ledger entries reference an existing configuration version.
- **Append-only triggers**: Direct `UPDATE` or `DELETE` on `score_ledger` and `audit_logs` is rejected by SQLite triggers.

---

## 5. Test Suite Summary

```
 RUN  v3.2.7 C:/Users/ACER/Desktop/SIFC

 ✓ apps/api/tests/worker.test.ts (4 tests)
 ✓ apps/api/tests/seed.test.ts (7 tests)
 ✓ apps/api/tests/db.test.ts (10 tests)
 ✓ apps/api/tests/scoring.property.test.ts (5 tests, 2500 iterations)
 ✓ apps/api/tests/health.test.ts (3 tests)
 ✓ packages/shared/tests/dates.test.ts (3 tests)
 ✓ apps/api/tests/crypto.test.ts (5 tests)
 ✓ packages/shared/tests/masking.test.ts (4 tests)
 ✓ packages/shared/tests/schemas.test.ts (6 tests)
 ✓ apps/api/tests/scoring.test.ts (4 tests)
 ✓ packages/shared/tests/money.test.ts (7 tests)

 Test Files  11 passed (11)
      Tests  58 passed (58)
   Duration  19.71s
```

---

## 6. Next Phase: Phase 5 – Citizen API

In Phase 5, we will implement the citizen-facing REST endpoints:
1. **Auth Endpoints**:
   - `POST /api/v1/auth/otp/request`: Validate mobile (E.164) + dummy PAN regex (`^[A-Z]{5}[0-9]{4}[A-Z]$`), generate 6-digit CSPRNG OTP, store hash with 5-minute TTL, rate-limit. Return identical response for known and unknown users (TRD 8.1).
   - `POST /api/v1/auth/otp/verify`: Verify OTP, issue 15-minute access token (JWT), issue 7-day HttpOnly Strict refresh cookie, token rotation with reuse detection family revocation (TRD 8.3).
   - `POST /api/v1/auth/refresh`: Refresh token rotation with reuse detection.
   - `POST /api/v1/auth/logout`: Revoke active refresh token family.
2. **Citizen Endpoints**:
   - `GET /api/v1/users/me`: Return user profile with masked PAN.
   - `GET /api/v1/users/me/consents` & `PUT /api/v1/users/me/consents`: Consent capture (P7).
   - `GET /api/v1/vehicles`: List linked vehicles with compliance badges.
   - `GET /api/v1/vehicles/:id`: Vehicle details with document expiry status.
   - `GET /api/v1/challans`: List challans with status/severity/date filters and cursor pagination.
   - `POST /api/v1/challans/:id/dispute`: Citizen opens dispute (`PENDING` $\to$ `DISPUTED`, P7).
   - `GET /api/v1/score`: Current score, category, delta from start of month, milestone points needed.
   - `GET /api/v1/score/ledger`: Transparent ledger history with plain-language labels and reason codes.
   - `GET /api/v1/score/history`: 12-month snapshot history.
3. **Supertest Suite**: Complete end-to-end integration tests for success, validation failure, auth failure, and ownership failure (IDOR prevention).

---

> **Awaiting User Review**: Reply with **`APPROVED`** to proceed with **Phase 5: Citizen API**.
