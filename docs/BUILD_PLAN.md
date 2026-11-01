# VAI – Build Plan

> This document contains the spec patches, golden tests, seed targets, and phases **verbatim** from the project prompt. It is the authoritative reference for what must be built.

---

## Spec Patches (P1–P12)

P1 Database: SQLite via Prisma for the prototype (NOT MongoDB), replacing PostgreSQL + Redis. The schema must stay portable to PostgreSQL 16: switching the Prisma provider and regenerating migrations must be the only change.
 a. Money is integer paise stored as BigInt; convert to number only at the repository boundary with a safe-integer guard. No floats for money anywhere.
 b. Enums are string columns with CHECK constraints (plus Zod). Use Prisma enums/Json only if the current Prisma supports them on SQLite; otherwise strings, and JSON as TEXT.
 c. One raw-SQL migration, clearly commented, adds: foreign keys ON; append-only triggers on score_ledger and audit_logs (abort on UPDATE or DELETE); a partial unique index so only one fee_config row is active per scope; the other indexes in TRD 6.4.
 d. Replace Redis/BullMQ with interfaces and in-process implementations: OtpStore (otp_sessions table), RateLimitStore (memory), JobQueue (score_jobs table + in-process worker, node-cron nightly at 02:00 Asia/Kolkata), ScoreCache (memory, TTL). Keep the TRD behaviours (TTLs, limits, idempotent jobs keyed by user + config version). A later swap to Redis/BullMQ must be a new implementation, not a business-logic change.
 e. Record in DECISIONS.md that PRD 18.2 names PostgreSQL and this patch amends it. The .db file is git-ignored.

P2 PAN masking: masked form = "XXXXXX" + last four characters = 10 characters (DUMMY1001X -> XXXXXX001X). The TRD sample "XXXXXX1001X" has 11 characters and overflows VARCHAR(10); it is wrong. Fix it in API samples and tests too.

P3 Dummy PAN validation: DUMMY1001X matches ^[A-Z]{5}[0-9]{4}[A-Z]$, so the TRD claim that dummy PANs "fail the real PAN structure check" is false. Use only that regex at login (no holder-type 4th-letter check; it would block the demo users). Dummy-ness is enforced by is_dummy, the seed guard and a permanent banner: "Prototype - simulated OTP - do not enter a real PAN". A real PAN is never stored or logged.

P4 Streak: streak_days = days since the last confirmed (PAID or UNPAID) violation; if there is none, days since the user's registration_date. D = +10 at >=30 days, +25 at >=90, +50 at >=180 (highest milestone reached, not cumulative on top). Consequence: U001 (zero challans, registered 2024-03-14) = 765 = VERY_GOOD, matching TRD 18.2. The PRD 11 text says Good; the TRD wins.

P5 Repeat penalty: RP = -min(40, SUM over violation codes of 10 * max(0, n_code - 1)), counting confirmed challans in the last 365 days.

P6 Monthly cap: the TRD pseudocode compares with the previous nightly score, which does not bound monthly movement. Instead, anchor = the user's score at the start of the current calendar month (the monthly snapshot; 700 if none). The final score may differ from the anchor by at most 50; when it applies, write a CAP_ADJ ledger entry. Snapshot(period = first day of month P) = score as of the end of the previous month, written on day 1. Dashboard previousMonthScore = that snapshot (null for brand-new accounts; the UI then says "New account - you start at 700").
 The engine takes an asOf date and treats later data as non-existent (a challan is PAID as of D only if payment_date <= D). Seeding/backfill evaluates month-ends with the cap DISABLED, otherwise U003-U005 could never fall below 650 from 700. The cap applies only to live recalculation after seeding.

P7 Missing endpoints and tables (add them; keep /api/v1 conventions and the error envelope):
 - POST /admin/auth/login: email + password, then a simulated 6-digit second factor shown on the dummy banner.
 - GET and PUT /users/me/consents: the consent step is shown before the dashboard (purposes per TRD 12.4).
 - POST /challans/{challanId}/dispute (citizen): PENDING -> DISPUTED with a timestamped note.
 - POST /admin/disputes/{disputeId}/resolve (OPS and above). UPHELD (dispute accepted) -> challan status WAIVED (add to the enum; scoring_eligible = false). REJECTED -> challan reverts to UNPAID (or PAID if payment_date exists) and counts in scoring. Both outcomes enqueue a recalculation and write an audit log.
 - refunds table: refund_id, txn_id, amount_paise, fee_reversed_paise, reason_code, admin_id, created_at. Full refund -> txn REFUNDED. Partial refund -> refund row only; txn stays SUCCESS; total refunded <= base; fee reversal = round_half_up(fee * refunded_base / base).
 - transactions: add fee_mode, user_total_paise, settlement_to_provider_paise; vehicle_id and licence_id both nullable (the LICENCE service has no vehicle).
 - Admin can mark a TIMED_OUT transaction SUCCESS or FAILED (audited). This is the "reconciliation" action.

P8 Renewal effects on success (config constants): insurance_expiry +12 months, puc_expiry +6 months, rc_validity_till +5 years, licence expiry +5 years, each extending from the later of today and the current expiry. Simulated price table lives in config; FOUR_WHEELER insurance must be Rs 10,000 (the golden example).

P9 Admin roles are SUPER_ADMIN, OPS, ANALYST everywhere (the TRD spells them two ways). Seed one admin per role with demo-only passwords documented in the README.

P10 Sessions: access token 15 min, refresh rotation with reuse detection per TRD 8.3. The frontend idle timer logs out after 15 minutes of inactivity and revokes the refresh family (FR-A4, FR-A6).

P11 Receipts are deterministic: regenerating one gives an identical PDF/JSON (no "generated at" clock values). POST /transactions requires an Idempotency-Key header (the UI generates one per Confirm click). simulatedOutcome is accepted only when NODE_ENV is not production.

P12 Formatting: en-IN number grouping with the rupee symbol (Rs 9,800.00 shown as the rupee sign form), dates displayed in Asia/Kolkata, stored in UTC.

---

## Golden Tests (G1–G7)

G1 Score (PRD 7.4, TRD 9.5): LOW challans aged 200 and 300 days and a MEDIUM aged 60 days, all PAID on time; last violation 60 days ago; one vehicle with valid insurance, PUC and RC; licence valid; no repeated codes. Expect V = -19.63, RP = 0, P = +9, D = +10, C = +15, raw 714.37, score 714, GOOD, pointsNeeded to VERY_GOOD = 36.

G2 Rewards on base 1,000,000 paise: VERY_GOOD 200 bps -> discount 20,000, payable 980,000. GOOD 100 bps -> 10,000 and 990,000. FAIR 0 -> 0 and 1,000,000 (the breakdown still shows the zero line).

G3 Fees on base 1,000,000 paise: 50 ppm -> 50 paise; 100 ppm -> 100 paise. VERY_GOOD + PROVIDER_PAYS: user pays 980,000, settlement to provider 979,950. PASS_THROUGH: user total 980,050.

G4 Rounding is half-up: base 12,350 at 100 bps -> discount 124; base 12,345 -> 123.

G5 Masking: DUMMY1001X -> XXXXXX001X.

G6 Properties (fast-check, thousands of random histories): score always within 500-900; adding a confirmed violation never raises the score; decay never increases a penalty; PENDING/DISPUTED/WAIVED challans never change the score; ledger deltas reconcile to the score change within +/-1.

G7 Partial refund: base 1,000,000, fee 50 paise, refund of 400,000 -> fee reversed 20 paise.

---

## Seed Targets (U001–U010)

Seed date 2026-10-30. Ages are days before the seed date. "On time" = paid within 60 days of issue. Scores below were calculated by hand with the TRD formula plus P4 and P5; your engine must reproduce them within +/-1. If a profile misses, change the seed dates, never the formula, and tell me.

U001 one two-wheeler, all documents valid, licence valid, no challans, registered 2024-03-14 -> 765 VERY_GOOD
U002 one four-wheeler; 3 LOW (different codes) PAID on time, ages 700/400/150 -> 742 GOOD
U003 two valid vehicles; 9 challans (3 MEDIUM, 6 LOW), codes RLVD x3, HELM x3, SPD x2, PARK x1, ages 10,40,75,110,150,200,250,300,340; the four newest are UNPAID, the rest PAID on time -> 591 FAIR
U004 one four-wheeler with insurance AND PUC expired (RC valid); 2 HIGH, same code, ages 62 and 100, both PAID late -> 634 FAIR
U005 one two-wheeler, valid; 4 UNPAID (LOW, MEDIUM, LOW, LOW; distinct codes), ages 20/75/120/200 (three past due) -> 630 FAIR
U006 one four-wheeler, valid; 2 LOW PAID on time, ages 200 and 300 -> 765 VERY_GOOD
U007 three commercial vehicles, one with expired PUC; LOW age 90 and MEDIUM age 150, both PAID on time -> 726 GOOD
U008 one two-wheeler, valid, registered 2 days ago, no challans -> 715 GOOD ("starts at 700", plus 15 compliance)
U009 two vehicles each with insurance and PUC expired, licence expired; one MEDIUM age 40 PAID on time -> 669 GOOD. Note: FAIR is mathematically unreachable for this profile under the formula; the point of this profile is the visible compliance penalty in the ledger.
U010 one four-wheeler, valid, registered 45 days ago; 2 DISPUTED and 1 PENDING challans (excluded from scoring) -> 725 GOOD

---

## Phases

Phase 0 - Understand and plan (no application code). Deliver: docs/SPEC-DIGEST.md (the project in your own words: purpose, personas, modules, data flow, scoring and fee formulas, to prove understanding); docs/TRACEABILITY.md covering every FR, US and NFR; docs/DECISIONS.md (patches P1-P12 plus any further conflicts or gaps you find in the PRD or TRD); docs/BUILD_PLAN.md (this prompt's spec_patches, golden_tests, seed_targets and phases copied verbatim); .agents/rules/vai-core.md; the proposed folder structure; a risk list. Re-check G1-G7 by hand and tell me if any disagrees with the documents. STOP for approval.

Phase 1 - Foundations: monorepo, TypeScript, ESLint/Prettier, shared Zod schemas, lib (money, IST dates, masking, crypto with AES-GCM + HMAC, redacting logger), env schema validated at boot, error envelope and codes (TRD 17), middleware order (TRD 5.2), /healthz and /readyz, Vitest, `npm run verify`. Gate: G4 and G5 pass.

Phase 2 - Database: Prisma schema for every TRD 6 table plus patches, migrations including the raw-SQL file (P1c), repositories, is_dummy seed guard. Gate: migrations run from an empty DB; tests prove CHECK constraints, FK RESTRICT, append-only triggers rejecting UPDATE/DELETE, and a single active fee_config.

Phase 3 - Scoring engine: pure functions, versioned scoring_config (TRD 5.3), ledger entries with stable reason codes and a plain-language label map, asOf support, cap logic (P6). No DB access inside the engine. Gate: G1, G6 and edge-case tests pass.

Phase 4 - Seed and worker: deterministic seed of the 10 profiles per seed_targets, plus providers, reward_config (PRD 8.1 values), fee_config (Option A 50 ppm, PROVIDER_PAYS, default), scoring_config v1, three admins, consent defaults; referential validation (TRD 18.3); 12 months of backfilled snapshots; JobQueue worker (event-driven and nightly) with idempotent jobs. Gate: a table of U001-U010 scores within +/-1 of target.

Phase 5 - Citizen API: auth (OTP 6-digit via CSPRNG, 5-minute expiry, 3 attempts, resend after 30 s, identical response for unknown users), token rotation with reuse detection, consents, users/me, vehicles, challans with filters and cursor pagination, disputes, score, history, ledger. Supertest for every endpoint: success, validation failure, auth failure, ownership failure. Gate: API walkthrough I can run.

Phase 6 - Rewards and transactions: category resolution from the latest score, eligibility, 15-minute locked quotes, state machine (TRD 11.1), both fee modes, simulated payment adapter (success, failure, timeout; refuses to run in production), idempotency, deterministic receipts (JSON + PDF), refunds, renewal effects (P8). Tests: G2, G3, G7, illegal state transitions, double submit.

Phase 7 - Admin API: admin auth + RBAC (TRD 12.2 with P9), masked user/vehicle/challan views, dispute resolution, versioned config for scoring/rewards/fees with effective dates and CONFIG_CONFLICT, audit log written in the same DB transaction as the change, analytics (score distribution, revenue by fee option, transaction success rate), dataset reset (is_dummy guard, audited), CSV export (PDF export is a Should).

Phase 8 - Citizen web app: every route in TRD 4.1; consent step; dummy banner; dashboard; circular score meter (270-degree arc, bands at 650 and 750, aria-label per TRD 4.4, colour never the only signal); score page with ledger and plain-language explanations; vehicle list and detail; challan table with status/severity/date filters and sorting; rewards; the four renewal flows with the price breakdown (original, discount, government-funded benefit, payable, platform fee as separate lines) and payment simulator; receipts; transactions; profile and logout; idle logout. Design: calm, trustworthy, high contrast, at least 16px body text, friendly to older users (large tap targets, plain wording); tables become cards below 768px; bottom nav on mobile, sidebar from 1024px; tested at 360, 768 and 1280 px. Gate: Playwright for login -> dashboard and the insurance renewal, with screenshots.

Phase 9 - Admin web app: modules per PRD 14; config editors with effective dates and an impact preview; read-only audit log viewer; dataset reset control; distribution and revenue charts; transaction monitoring and refunds.

Phase 10 - Hardening and handover: Playwright e2e for the four PRD 9 journeys plus an admin config change; axe-core on every page (zero serious or critical); security tests (IDOR, rate limits, refresh-token reuse); README (setup in 5 commands or fewer, the demo logins for U001-U010 and the three admins, and a demo script per persona); final TRACEABILITY report with every Must item marked done or not done; list of Should items completed; known gaps. Run the k6 load test only if k6 is installed; otherwise document it.
