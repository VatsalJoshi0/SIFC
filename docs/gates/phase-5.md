# Phase 5 Gate Report: Citizen API

> **Phase Status**: COMPLETED  
> **Verification Command**: `npm run verify` (Typecheck, Lint, Test across workspaces)  
> **All Tests Passing**: 83 / 83 tests across 12 test suites (0 errors, 0 warnings)  
> **Walkthrough Command**: `npm run api:walkthrough` (Runnable standalone end-to-end demonstration)  
> **Gate Objective**: Complete citizen REST API with Supertest test coverage for success, validation failure, auth failure, and ownership failure (IDOR), plus a runnable walkthrough script.

---

## 1. Verified Endpoints Catalogue

All endpoints mounted under `/api/v1` with TRD 17 structured error envelope and `X-Request-Id` tracing:

| Method | Endpoint | Auth | Purpose | Verified In | Status |
|:------:|:---------|:----:|:--------|:-----------:|:------:|
| `POST` | `/api/v1/auth/otp/request` | Public | Validate mobile (E.164) & PAN regex; generate 6-digit CSPRNG OTP (5m TTL, 30s cooldown); identical response for unknown accounts | `citizen-api.test.ts` | **PASSED** |
| `POST` | `/api/v1/auth/otp/verify` | Public | Verify OTP in constant time; 3 attempts lockout; issue 15-min JWT access token + 7-day HttpOnly Strict refresh cookie | `citizen-api.test.ts` | **PASSED** |
| `POST` | `/api/v1/auth/refresh` | Cookie | Rotate refresh token; issue new JWT; family revocation on reuse detection (TRD 8.3) | `citizen-api.test.ts` | **PASSED** |
| `POST` | `/api/v1/auth/logout` | Cookie | Revoke refresh token family and clear session cookie | `citizen-api.test.ts` | **PASSED** |
| `GET` | `/api/v1/users/me` | Citizen | Masked citizen profile (`XXXXXX001X`, `+91 90000 XX001`), registration date, vehicle count | `citizen-api.test.ts` | **PASSED** |
| `GET` | `/api/v1/users/me/consents` | Citizen | Active DPDP Act 2023 consent records | `citizen-api.test.ts` | **PASSED** |
| `PUT` | `/api/v1/users/me/consents` | Citizen | Record consent grant/withdrawal with SHA-256 version hash (P7) | `citizen-api.test.ts` | **PASSED** |
| `GET` | `/api/v1/vehicles` | Citizen | List linked vehicles with validity statuses (insurance, PUC, RC) and compliance score ($c_v$) | `citizen-api.test.ts` | **PASSED** |
| `GET` | `/api/v1/vehicles/:idOrRegNo` | Citizen | Vehicle detail by ID or registration number with recent challans (IDOR protected) | `citizen-api.test.ts` | **PASSED** |
| `GET` | `/api/v1/vehicles/:idOrRegNo/challans` | Citizen | Vehicle challans with status/severity filters and cursor pagination (IDOR protected) | `citizen-api.test.ts` | **PASSED** |
| `GET` | `/api/v1/challans` | Citizen | Paginated citizen challans with status/severity/vehicle/date filters | `citizen-api.test.ts` | **PASSED** |
| `POST` | `/api/v1/challans/:id/dispute` | Citizen | Citizen opens dispute: `PENDING` $\to$ `DISPUTED`, sets `scoringEligible = false`, creates dispute record, writes audit log (P7) | `citizen-api.test.ts` | **PASSED** |
| `GET` | `/api/v1/score` | Citizen | Latest score, category, `previousMonthScore`, delta, next milestone, and top 3 drivers | `citizen-api.test.ts` | **PASSED** |
| `GET` | `/api/v1/score/history` | Citizen | 12-month backfilled snapshot array (`score_snapshots`) | `citizen-api.test.ts` | **PASSED** |
| `GET` | `/api/v1/score/ledger` | Citizen | Paginated score ledger with plain-language labels and descriptions | `citizen-api.test.ts` | **PASSED** |

---

## 2. Interactive Walkthrough Verification

You can run the end-to-end walkthrough at any time in a single command:
```powershell
npm run api:walkthrough
```

The script automatically spins up an in-process server if not already running, executes the 14-step citizen journey for profile `U001`, and prints each step:
1. `GET /healthz` $\to$ `200 OK`
2. `POST /api/v1/auth/otp/request` for U001 $\to$ `200 OK` (returns `sessionId`, `simulatedOtp`)
3. `POST /api/v1/auth/otp/verify` with simulated OTP $\to$ `200 OK` (issues JWT access token and sets `vai_refresh_token` cookie)
4. `GET /api/v1/users/me` $\to$ `200 OK` (returns Priya Sharma, `XXXXXX001X`)
5. `GET /api/v1/users/me/consents` $\to$ `200 OK` (3 active DPDP consents)
6. `PUT /api/v1/users/me/consents` $\to$ `200 OK` (updates consents)
7. `GET /api/v1/vehicles` $\to$ `200 OK` (KA01AB1001, Activa 6G, all documents valid, compliance score +15)
8. `GET /api/v1/vehicles/KA01AB1001` $\to$ `200 OK`
9. `GET /api/v1/challans` $\to$ `200 OK`
10. `GET /api/v1/score` $\to$ `200 OK` (Score 765, VERY_GOOD, delta +0)
11. `GET /api/v1/score/history?months=12` $\to$ `200 OK` (12 snapshots from `2025-11-01` to `2026-10-01`)
12. `GET /api/v1/score/ledger?limit=5` $\to$ `200 OK` (includes plain labels: "All vehicle documents valid", "180+ days without a violation")
13. `POST /api/v1/auth/refresh` $\to$ `200 OK` (rotates refresh token cookie, returns new access token)
14. `POST /api/v1/auth/logout` $\to$ `200 OK` (clears cookie, revokes session family)

---

## 3. Security and Architectural Invariants Verified

1. **OTP Security (TRD 8.1, 8.2)**:
   - 6-digit CSPRNG generation (`crypto.randomInt(100000, 1000000)`).
   - 5-minute TTL stored as HMAC in `otp_sessions`.
   - 30-second cooldown per mobile enforced with HTTP 429 `OTP_COOLDOWN`.
   - Lockout on 3 incorrect attempts.
   - Identical response for registered and unregistered accounts (prevents user enumeration).
2. **Token Security & Rotation (TRD 8.3, P10)**:
   - Access tokens are 15-minute signed JWTs (HS256) carrying only `userId`, `role`, and `exp` (no PAN or mobile).
   - Refresh tokens are 7-day opaque tokens stored as SHA-256 hashes in HttpOnly Strict cookies.
   - **Reuse Detection**: Presenting an already-consumed refresh token immediately revokes the entire token family, terminating all active sessions for that login family.
3. **IDOR & Authorization Protection**:
   - Authenticated user context strictly enforced (`requireCitizenAuth`).
   - A citizen cannot access another citizen's vehicles (`GET /vehicles/:id` returns 404 for non-owners).
   - A citizen cannot dispute another citizen's challans (returns 404).
4. **Dispute Invariant (P7)**:
   - Citizens can ONLY dispute challans in `PENDING` status. Attempting to dispute a `PAID` or `UNPAID` challan returns 400 `CHALLAN_NOT_DISPUTABLE`.
   - Disputing transitions status to `DISPUTED`, sets `scoringEligible = false`, creates a dispute record, and writes an audit log.
5. **New Account Scoring Invariant (P6)**:
   - Brand new accounts (e.g. U008, registered 2 days ago) correctly return `previousMonthScore = null` and calculate delta from base 700 (`changeSincePreviousMonth = 15`).

---

## 4. Test Suite Summary

```
 RUN  v3.2.7 C:/Users/ACER/Desktop/SIFC

 ✓ apps/api/tests/citizen-api.test.ts (25 tests)
 ✓ apps/api/tests/worker.test.ts (4 tests)
 ✓ apps/api/tests/seed.test.ts (7 tests)
 ✓ apps/api/tests/db.test.ts (10 tests)
 ✓ apps/api/tests/scoring.property.test.ts (5 tests, 2500 iterations)
 ✓ apps/api/tests/health.test.ts (3 tests)
 ✓ packages/shared/tests/dates.test.ts (3 tests)
 ✓ packages/shared/tests/schemas.test.ts (6 tests)
 ✓ packages/shared/tests/money.test.ts (7 tests)
 ✓ apps/api/tests/crypto.test.ts (5 tests)
 ✓ packages/shared/tests/masking.test.ts (4 tests)
 ✓ apps/api/tests/scoring.test.ts (4 tests)

 Test Files  12 passed (12)
      Tests  83 passed (83)
   Duration  26.40s
```

---

## 5. Next Phase: Phase 6 – Rewards & Transactions

In Phase 6, we will implement the rewards engine, 15-minute locked quote service, and transaction state machine:
1. **Category Resolution & Eligibility**:
   - Resolve VAI category (`FAIR`, `GOOD`, `VERY_GOOD`) from the latest score.
   - Verify document eligibility for the 4 renewal services (Insurance, PUC, RC, Driving Licence).
2. **15-Minute Locked Quotes (`POST /api/v1/services/quotes`)**:
   - Compute discount: `roundHalfUp(base * discountBps / 10000)`.
   - Compute platform fee: Option A (50 ppm) or Option B (100 ppm).
   - Compute fee mode breakdowns (`PROVIDER_PAYS` vs `PASS_THROUGH`).
   - Lock quote for 15 minutes (`quoteExpiresAt`).
3. **Transaction State Machine (`POST /api/v1/transactions`)**:
   - `CREATED` $\to$ `VALIDATED` $\to$ `PAYMENT_PENDING` $\to$ `SUCCESS` / `FAILED` / `TIMED_OUT` $\to$ `REFUNDED`.
   - Enforce `Idempotency-Key` header (P11).
   - Simulated payment adapter with configurable outcomes (`SUCCESS`, `FAILURE`, `TIMEOUT`), refusing to run if `NODE_ENV === "production"`.
4. **Deterministic Receipts**:
   - JSON and deterministic receipt output (P11).
5. **Refunds (P7) & Renewal Effects (P8)**:
   - Full and partial refunds (`calculateFeeReversalPaise`).
   - Extension of document expiry on success: Insurance +12m, PUC +6m, RC +5y, Licence +5y.
6. **Golden Tests G2, G3, G7**:
   - Comprehensive test suite for all reward and fee formulas.

---

> **Awaiting User Review**: Reply with **`APPROVED`** to proceed with **Phase 6: Rewards & Transactions**.
