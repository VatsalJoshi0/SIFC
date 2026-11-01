# Phase 6 Gate Report: Rewards, Services & Transactions

**Date**: 2026-10-31  
**Author**: VAI Senior Full-Stack Engineer & System Architect  
**Status**: COMPLETED & VERIFIED  

---

## 1. Executive Summary

Phase 6 implements the complete commercial renewal and transaction processing engine for VAI as specified in PRD 8, 12, 13, 14, 18.2; TRD 10, 11, 13; and Lead Architect Spec Patches P7, P8, and P11.

Citizens can select services (Insurance, PUC, RC, Driving Licence), obtain 15-minute price-locked quotes with transparent fee and discount breakdowns, and execute simulated payments with guaranteed idempotency and deterministic receipt generation. On payment success, document renewals are automatically extended from the later of today and the current expiry, and a score recalculation is enqueued to reward vehicle compliance. Full and partial refunds are implemented with mathematically exact proportional platform fee reversals.

All three required Golden Tests (**G2**, **G3**, and **G7**) have been verified. The entire monorepo verification suite (`npm run verify`) is completely green with **109 passing tests across 14 test suites**, 0 TypeScript errors, and 0 ESLint warnings.

---

## 2. Key Modules & Technical Architecture

### A. Pricing & Renewal Config (`apps/api/src/config/services.ts`)
- **Simulated Base Prices (Spec Patch P8)**:
  - Four-wheeler insurance: 1,000,000 paise (₹10,000.00, the golden baseline).
  - Two-wheeler insurance: 200,000 paise (₹2,000.00); Commercial: 1,500,000 paise (₹15,000.00).
  - PUC: 10,000 to 30,000 paise (₹100 to ₹300).
  - RC Renewal: 50,000 to 250,000 paise (₹500 to ₹2,500).
  - Driving Licence Renewal: 50,000 paise (₹500).
- **Renewal Extension Durations (P8)**:
  - Insurance: +12 months from `later(today, current_expiry)`.
  - PUC: +6 months from `later(today, current_expiry)`.
  - RC: +5 years from `later(today, current_expiry)`.
  - Driving Licence: +5 years from `later(today, current_expiry)`.

### B. Rewards & Quote Service (`apps/api/src/modules/rewards/`)
- `rewards.service.ts`:
  - **Category Resolution (TRD 10.1)**: Dynamically resolves category from the latest score (`vai_scores`): $\ge 750 \to \text{VERY\_GOOD}$, $\ge 650 \to \text{GOOD}$, $< 650 \to \text{FAIR}$.
  - **Discount Calculation (TRD 10.2)**: Looks up active `reward_config` row (`VERY_GOOD` $\to$ 200 bps / 2%, `GOOD` $\to$ 100 bps / 1%, `FAIR` $\to$ 0 bps / 0%).
  - **Fee Calculation (TRD 11.2)**: Looks up active `fee_config` (Option A: 50 ppm, Option B: 100 ppm) and fee mode (`PROVIDER_PAYS` vs `PASS_THROUGH`).
  - **IDOR Protection (TRD 12.2)**: Verifies vehicle/licence ownership against caller's `userId`; returns 404 NOT_FOUND on mismatch.
- `quote.store.ts`:
  - In-memory store with 15-minute TTL (`quoteExpiresAt = now + 15m`).
  - Locks score category, discount percentage, fee option, and breakdown values for the quote lifetime.
  - Generates format `Q-[A-F0-9]{6}` (e.g. `Q-7H2K9P`).

### C. Simulated Payment Adapter (`apps/api/src/adapters/payment/`)
- `payment.adapter.ts` (Interface): Common interface for payment gateways (`createOrder`, `capture`, `refund`).
- `simulated.adapter.ts`:
  - Enforces strict production safety guard: refuses to run if `NODE_ENV === "production"` (P11).
  - Supports testing outcomes: `SUCCESS`, `FAILURE`, `TIMEOUT`.
  - Returns simulated gateway references (`PAY-SIM-...`, `PAY-FAIL-...`, `PAY-TIMEOUT-...`).

### D. Transactions State Machine (`apps/api/src/modules/transactions/`)
- `transactions.service.ts`:
  - **State Transitions (TRD 11.1)**: `CREATED` $\to$ `VALIDATED` $\to$ `PAYMENT_PENDING` $\to$ `SUCCESS` / `FAILED` / `TIMED_OUT` $\to$ `REFUNDED`.
  - **Quote Stale Guard (TRD 10.4, 17.2)**: Checks quote expiry; rejects with 409 `QUOTE_STALE` if expired.
  - **Idempotency (P11, TRD 11.4)**: Enforces mandatory `Idempotency-Key` header; deduplicates repeat requests and returns stored transaction without double charges or duplicate renewals.
  - **Renewal Effects (P8)**: Automatically updates vehicle document expiries or licence expiry upon `SUCCESS`.
  - **Score Recalculation Trigger**: Enqueues an event-driven score recalculation job (`jobQueue.enqueueScoreRecalc`) to refresh compliance points $C$.
  - **Refund Engine (P7, TRD 11.3)**:
    - Full refund: sets status to `REFUNDED`, reverses 100% of platform fee.
    - Partial refund: keeps status `SUCCESS`, inserts `refunds` entry, reverses fee proportionally:
      $$\text{fee\_reversed} = \text{round\_half\_up}\left(\frac{\text{fee} \times \text{refunded\_base}}{\text{base}}\right)$$
  - **Admin Reconciliation (P7)**:
    - Allows OPS+ admin to mark `TIMED_OUT` transactions as `SUCCESS` (applying renewal and enqueuing recalc) or `FAILED`, with full audit logging.
    - Rejects reconciliation on non-`TIMED_OUT` transactions with 409 `TXN_STATE_INVALID`.

### E. Deterministic Receipt Generation (`apps/api/src/modules/receipts/`)
- `receipt.service.ts`:
  - Generates receipts purely from transaction and citizen fields using `txn.createdAt` as the immutable timestamp (P11, US-07). Zero clock-dependent jitter.
  - Supports JSON format and valid binary PDF format (`%PDF-1.4`).
  - Verified: Multiple generations of the same receipt yield byte-for-byte identical outputs.

---

## 3. Endpoints Wired & Tested

| Method | Route | Description | Auth | Status |
|---|---|---|---|:---:|
| `POST` | `/api/v1/rewards/eligibility` | Reward discount & price breakdown quote | Citizen | VERIFIED |
| `POST` | `/api/v1/services/quotes` | Create priced quote (15-min lock) | Citizen | VERIFIED |
| `POST` | `/api/v1/transactions` | Confirm quote & execute payment (idempotent) | Citizen | VERIFIED |
| `GET` | `/api/v1/transactions` | Citizen transaction history | Citizen | VERIFIED |
| `GET` | `/api/v1/transactions/:txnId` | Transaction details (IDOR protected) | Citizen | VERIFIED |
| `GET` | `/api/v1/transactions/:txnId/receipt` | Deterministic receipt as JSON or PDF | Citizen | VERIFIED |

---

## 4. Golden Test Results

| Test | Objective | Input Base | Expected Values | Actual Result | Status |
|:---:|---|:---:|---|---|:---:|
| **G2** | Rewards calculation | 1,000,000 paise | **VERY_GOOD** (200 bps): 20,000 discount / 980,000 payable<br>**GOOD** (100 bps): 10,000 discount / 990,000 payable<br>**FAIR** (0 bps): 0 discount / 1,000,000 payable | Exact match | **PASSED** |
| **G3** | Platform fee & modes | 1,000,000 paise | **Option A** (50 ppm): 50 paise<br>**Option B** (100 ppm): 100 paise<br>**PROVIDER_PAYS**: user pays 980,000, settlement 979,950<br>**PASS_THROUGH**: user pays 980,050, settlement 980,000 | Exact match | **PASSED** |
| **G7** | Partial refund fee reversal | 1,000,000 paise | Base 1,000,000, fee 50 paise, refund 400,000 $\to$ fee reversed **20 paise** | Fee reversed = 20 paise, txn stays SUCCESS | **PASSED** |

---

## 5. Automated Test Suite Metrics

```
Test Files  14 passed (14)
     Tests  109 passed (109)
  Duration  32.77s
```

### Breakdown of Passing Test Suites:
1. `apps/api/tests/transactions.test.ts` (19 tests) — Quotes, eligibility, state machine, idempotency, renewals, receipts, refunds, reconciliation.
2. `apps/api/tests/golden-rewards.test.ts` (7 tests) — Golden Tests G2, G3, and G7 isolated verification.
3. `apps/api/tests/citizen-api.test.ts` (25 tests) — Auth, OTP, tokens, vehicles, challans, disputes, score ledger.
4. `apps/api/tests/seed.test.ts` (7 tests) — Deterministic seed scores U001–U010 and referential validation.
5. `apps/api/tests/db.test.ts` (10 tests) — SQLite triggers, partial unique indexes, CHECK constraints, FK RESTRICT.
6. `apps/api/tests/scoring.property.test.ts` (5 tests) — `fast-check` 2,500 property tests (G6).
7. `apps/api/tests/scoring.test.ts` (4 tests) — Pure scoring engine and Golden Test G1 (714 GOOD).
8. `apps/api/tests/crypto.test.ts` (5 tests) — AES-256-GCM and HMAC-SHA256 crypto tests.
9. `apps/api/tests/health.test.ts` (3 tests) — Health and readiness endpoints.
10. `packages/shared/tests/money.test.ts` (7 tests) — Integer paise math and Golden Test G4.
11. `packages/shared/tests/masking.test.ts` (4 tests) — PAN and mobile masking (Golden Test G5).
12. `packages/shared/tests/dates.test.ts` (3 tests) — IST date formatting utilities.
13. `packages/shared/tests/schemas.test.ts` (6 tests) — Zod schemas validation.
14. `apps/api/tests/worker.test.ts` (4 tests) — Score job queue and background worker execution.

### Verification Commands:
- `npm run typecheck` $\to$ **0 errors** (all workspaces).
- `npm run lint` $\to$ **0 errors, 0 warnings**.
- `npm run verify` $\to$ **100% green exit code 0**.

---

## 6. Readiness for Phase 7

With Phase 6 complete and thoroughly tested, the platform has a working financial and renewal core. All requirements for FR-R1 through FR-R6, US-05 through US-07, and spec patches P7, P8, P11 are satisfied.

**Next Phase**: **Phase 7 – Admin API**
- Admin authentication & RBAC (`SUPER_ADMIN`, `OPS`, `ANALYST` per P9).
- Masked citizen, vehicle, and challan administration views.
- Dispute resolution workflow (`UPHELD` $\to$ `WAIVED`, `REJECTED` $\to$ revert, audited, with score recalculation per P7).
- Versioned configuration management for scoring, rewards, and fees with conflict detection (`CONFIG_CONFLICT` 422).
- Transaction monitoring, admin refund triggers, and reconciliation of `TIMED_OUT` transactions.
- Audit log search and compliance logging.
- Dataset reset tool with `is_dummy` guard.
- Analytics and CSV export.

Awaiting user confirmation to proceed to Phase 7.
