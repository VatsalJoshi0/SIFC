# VAI – Traceability Matrix

> Maps every FR, US, and NFR to verified code locations, tests, and completion status.
> Lead Architect Spec Patches P1–P12 fully reconciled.

## Legend
- **Status**: `DONE` | `IN_PROGRESS` | `PLANNED` | `N/A`
- **Priority**: `M` = Must, `S` = Should, `C` = Could

---

## Functional Requirements – Authentication & Access (FR-A)

| ID | Requirement | Priority | Code Location | Test / Verification | Status |
|----|------------|:--------:|---------------|---------------------|:------:|
| FR-A1 | Login accepts mobile + PAN, validates, requests OTP | M | `apps/api/src/modules/auth/`, `LoginPage.tsx` | `citizen-api.test.ts` | DONE |
| FR-A2 | 6-digit OTP, 5-min expiry, 3 attempts | M | `apps/api/src/modules/auth/otp.service.ts` | `citizen-api.test.ts` | DONE |
| FR-A3 | After OTP, retrieve linked vehicles | M | `apps/api/src/modules/auth/auth.controller.ts` | `citizen-api.test.ts` | DONE |
| FR-A4 | Dashboard redirect; 15-min idle timeout | M | `apps/web/src/components/IdleTimer.tsx` | Unit verified, token revoke | DONE |
| FR-A5 | PAN masked everywhere (last 4 visible: XXXXXX001X) | M | `packages/shared/src/masking.ts` | `masking.test.ts` (G5) | DONE |
| FR-A6 | Logout invalidates all session tokens | M | `apps/api/src/modules/auth/token.service.ts` | `citizen-api.test.ts` | DONE |
| FR-A7 | Admin separate login with RBAC + 2FA | M | `apps/api/src/modules/admin/`, `AdminLoginPage.tsx` | `admin-api.test.ts` | DONE |

## Functional Requirements – Dashboard & Score (FR-D)

| ID | Requirement | Priority | Code Location | Test / Verification | Status |
|----|------------|:--------:|---------------|---------------------|:------:|
| FR-D1 | Dashboard: name, score, category, circular meter | M | `apps/web/src/features/dashboard/DashboardPage.tsx` | Verified on U001-U010 | DONE |
| FR-D2 | Dashboard: vehicle/challan counts, compliance | M | `apps/web/src/features/dashboard/DashboardPage.tsx` | Verified on U001-U010 | DONE |
| FR-D3 | Previous month score, change, top reasons, milestone | M | `apps/api/src/modules/scoring/service.ts` | `citizen-api.test.ts` | DONE |
| FR-D4 | Rewards eligibility and discount % per service | M | `apps/web/src/features/rewards/RewardsPage.tsx` | `golden-rewards.test.ts` | DONE |
| FR-D5 | Score ledger: reason code, date, delta, balance | M | `apps/api/src/modules/scoring/`, `ScorePage.tsx` | `citizen-api.test.ts` | DONE |
| FR-D6 | Score history chart (12 months) | S | `apps/web/src/features/score/ScorePage.tsx` | `citizen-api.test.ts` | DONE |

## Functional Requirements – Vehicles & Challans (FR-V)

| ID | Requirement | Priority | Code Location | Test / Verification | Status |
|----|------------|:--------:|---------------|---------------------|:------:|
| FR-V1 | Vehicle list: regNo, type, brand, model, status badges | M | `apps/web/src/features/vehicles/VehiclesPage.tsx` | `citizen-api.test.ts` | DONE |
| FR-V2 | Vehicle detail: expiry dates, days remaining, challans | M | `apps/web/src/features/vehicles/VehicleDetailPage.tsx` | `citizen-api.test.ts` | DONE |
| FR-V3 | Challan table: filter by status/severity/date, sort | M | `apps/web/src/features/challans/ChallansPage.tsx` | `citizen-api.test.ts` | DONE |
| FR-V4 | Disputed/Pending flagged, excluded from scoring | M | `apps/api/src/modules/scoring/engine.ts` | `scoring.test.ts` (G6) | DONE |
| FR-V5 | Vehicle compliance ≠ VAI score (displayed separately) | S | `apps/web/src/features/vehicles/` | Verified in UI | DONE |

## Functional Requirements – Rewards, Services & Transactions (FR-R)

| ID | Requirement | Priority | Code Location | Test / Verification | Status |
|----|------------|:--------:|---------------|---------------------|:------:|
| FR-R1 | Rewards page: discount % per category per service | M | `apps/web/src/features/rewards/RewardsPage.tsx` | `golden-rewards.test.ts` | DONE |
| FR-R2 | Renewal flow: select vehicle → quote → breakdown → pay → receipt | M | `apps/web/src/features/services/ServiceRenewalPage.tsx` | `transactions.test.ts` | DONE |
| FR-R3 | Price breakdown: original, discount, govt benefit, payable, fee | M | `apps/web/src/components/PriceBreakdown.tsx` | `golden-rewards.test.ts` (G2, G3) | DONE |
| FR-R4 | Simulated payment: success, failure, timeout | M | `apps/api/src/adapters/payment/` | `transactions.test.ts` | DONE |
| FR-R5 | Receipt with unique transaction ID | M | `apps/web/src/features/transactions/ReceiptPage.tsx` | `transactions.test.ts` | DONE |
| FR-R6 | Transaction history + admin refund action | S | `apps/web/src/features/admin/pages/AdminTransactionsPage.tsx` | `transactions.test.ts` | DONE |

## Functional Requirements – Admin (FR-M)

| ID | Requirement | Priority | Code Location | Test / Verification | Status |
|----|------------|:--------:|---------------|---------------------|:------:|
| FR-M1 | Admin: view, search, filter users/vehicles/challans | M | `AdminCitizensPage.tsx`, `AdminDisputesPage.tsx` | `admin-api.test.ts` | DONE |
| FR-M2 | Admin: edit scoring/reward/fee params with effective dates | M | `AdminGovernancePage.tsx` | `admin-api.test.ts` | DONE |
| FR-M3 | Audit log: old value, new value, admin, timestamp | M | `AdminAuditPage.tsx` | `admin-api.test.ts`, `db.test.ts` | DONE |
| FR-M4 | Admin dashboard: score distribution, revenue, txn success | M | `AdminDashboardPage.tsx` | `admin-api.test.ts` | DONE |
| FR-M5 | Reset/regenerate dummy dataset with safety guard | M | `AdminSystemPage.tsx`, `seed.ts` | `seed.test.ts`, `admin-api.test.ts` | DONE |
| FR-M6 | Export CSV (Users, Txns, Challans, Logs) | S | `AdminAuditPage.tsx` | `admin-api.test.ts` | DONE |

## Spec Patch Endpoints (P7)

| ID | Requirement | Code Location | Test | Status |
|----|------------|---------------|------|:------:|
| P7-AdminLogin | POST /admin/auth/login (Argon2id + 2FA) | `apps/api/src/modules/admin/` | `admin-api.test.ts` | DONE |
| P7-Consents | GET/PUT /users/me/consents (DPDP Act) | `apps/api/src/modules/users/` | `citizen-api.test.ts` | DONE |
| P7-Dispute | POST /challans/{id}/dispute | `apps/api/src/modules/challans/` | `citizen-api.test.ts` | DONE |
| P7-Resolve | POST /admin/disputes/{id}/resolve | `apps/api/src/modules/admin/` | `admin-api.test.ts` | DONE |
| P7-Refunds | Refunds table + partial refund logic | `apps/api/src/modules/transactions/` | `golden-rewards.test.ts` (G7) | DONE |
| P7-Reconcile | Admin mark TIMED_OUT → SUCCESS/FAILED | `apps/api/src/modules/transactions/` | `transactions.test.ts` | DONE |

---

## User Stories (US)

| ID | As a | I want to | Priority | Maps to FRs | Status |
|----|------|----------|:--------:|------------|:------:|
| US-01 | citizen | log in with mobile+PAN+OTP | M | FR-A1..A3 | DONE |
| US-02 | citizen | see my VAI Score and what changed it | M | FR-D1..D5 | DONE |
| US-03 | citizen | see all vehicles linked to me | M | FR-V1, FR-V2 | DONE |
| US-04 | citizen | filter challans by status | M | FR-V3 | DONE |
| US-05 | citizen | see my discount before I pay | M | FR-R3 | DONE |
| US-06 | citizen | renew insurance through VAI | M | FR-R2 | DONE |
| US-07 | citizen | download a receipt | M | FR-R5 | DONE |
| US-08 | fleet owner | see compliance for every vehicle | M | FR-V1, FR-V5 | DONE |
| US-09 | senior citizen | use large, plain-language screens | M | NFR-Accessibility | DONE |
| US-10 | admin | change scoring weights with effective date | M | FR-M2 | DONE |
| US-11 | admin | see every config change in audit log | M | FR-M3 | DONE |
| US-12 | admin | reset dummy dataset | M | FR-M5 | DONE |

---

## Non-Functional Requirements (NFR)

| ID | Category | Requirement | Priority | Implementation / Verification | Status |
|----|----------|------------|:--------:|-------------------------------|:------:|
| NFR-1 | Responsiveness | 360px, 768px, 1280px | M | Tailwind responsive shell, BottomNav & card layouts | DONE |
| NFR-2 | Performance | Dashboard < 2s, API p95 < 300ms | M | In-memory indexing, precomputed snapshots, fast response times | DONE |
| NFR-3 | Security | PAN encrypted (AES-256-GCM) + masked, RBAC, 2FA | M | `lib/crypto.ts`, `masking.ts`, Argon2id, CSPRNG OTP | DONE |
| NFR-4 | Privacy | Consent capture before dashboard (DPDP Act 2023) | M | `ConsentPage.tsx`, consent audit logs | DONE |
| NFR-5 | Accessibility | WCAG 2.1 AA, high-contrast text, 44px touch targets | M | Accessible SVG score meter with aria-label, semantic HTML5 | DONE |
| NFR-6 | Auditability | Immutable score ledger & audit logs via triggers | M | SQLite/Postgres triggers rejecting UPDATE/DELETE (`db.test.ts`) | DONE |
| NFR-7 | Localisation | English (INR ₹ currency formatting, BigInt paise) | M | `money.ts`, `formatPaiseToINR` | DONE |
| NFR-8 | Browser | Evergreen browsers (Chrome, Edge, Firefox, Safari) | M | Standard ES2022 + Vite React 19 bundle | DONE |

---

## Golden Tests (G1–G7)

| ID | Description | Maps to | Test File | Result | Status |
|----|------------|---------|-----------|--------|:------:|
| G1 | Score calculation worked example | TRD 9.5 | `scoring.test.ts` | 714 GOOD | DONE |
| G2 | Rewards on base 1M paise | PRD 8.2 | `golden-rewards.test.ts` | Exact paise match | DONE |
| G3 | Fees on base 1M paise | TRD 11.2 | `golden-rewards.test.ts` | 50 ppm & 100 ppm match | DONE |
| G4 | Rounding half-up | TRD 10.2 | `money.test.ts` | Symmetric Half-Up match | DONE |
| G5 | PAN masking (XXXXXX001X) | P2 | `masking.test.ts` | 10 chars, 4 visible | DONE |
| G6 | Property-based scoring | TRD 15 | `scoring.property.test.ts` | 100 random runs bounded [500, 900] | DONE |
| G7 | Proportional refund fee clawback | P7, TRD 11.3 | `golden-rewards.test.ts` | Proportional fee reversal | DONE |
