# VAI – Decisions Log

> Precedence order: (1) spec_patches P1–P12, (2) TRD v1.0, (3) PRD v1.0.
> Never resolve a conflict silently; every conflict or gap is logged here.

---

## Spec Patches (P1–P12) — Applied

### P1 – Database: SQLite via Prisma
- **PRD 18.2** names PostgreSQL. **This patch amends it** to SQLite for the prototype.
- Schema stays Prisma-provider-portable: switching provider + regenerating migrations = only change needed.
- Money: integer paise as BigInt; number conversion only at repository boundary with safe-integer guard.
- Enums: string columns with CHECK constraints + Zod (Prisma enums if supported on SQLite, otherwise strings).
- JSON fields stored as TEXT.
- Raw-SQL migration adds: FK enforcement, append-only triggers on `score_ledger` and `audit_logs`, partial unique index on `fee_config`, all TRD 6.4 indexes.
- Redis/BullMQ replaced by interfaces: OtpStore (otp_sessions table), RateLimitStore (memory), JobQueue (score_jobs table + in-process worker, node-cron at 02:00 Asia/Kolkata), ScoreCache (memory, TTL).
- The `.db` file is git-ignored.

### P2 – PAN Masking
- TRD sample shows "XXXXXX1001X" (11 chars) which overflows VARCHAR(10). **Fixed**: masked = "XXXXXX" + last 4 chars = 10 chars total.
- Example: DUMMY1001X → XXXXXX001X.

### P3 – Dummy PAN Validation
- TRD claims dummy PANs "fail the real PAN structure check" — **this is false**; DUMMY1001X matches `^[A-Z]{5}[0-9]{4}[A-Z]$`.
- At login: use only the regex, no holder-type 4th-letter check.
- Dummy-ness enforced by `is_dummy` flag, seed guard, and permanent banner.

### P4 – Streak
- streak_days = days since last confirmed violation; if none, days since registration_date.
- D = highest milestone reached: +10 (≥30d), +25 (≥90d), +50 (≥180d). Not cumulative on top.
- **Conflict**: PRD 11 says U001 is "Good"; TRD 18.2 says "VERY_GOOD". **TRD wins per precedence**. With P4, U001 (registered 2024-03-14, 961-day streak) gets D=+50, C=+15, total=765=VERY_GOOD. ✓

### P5 – Repeat Penalty
- RP = -min(40, SUM over codes of 10 × max(0, n_code − 1)), counting confirmed challans in last 365 days.
- Overrides TRD 9.2 text (which is consistent but less explicit).

### P6 – Monthly Cap
- Anchor = score snapshot at start of current calendar month (700 if none).
- |final − anchor| ≤ 50. Writes CAP_ADJ ledger entry when applied.
- Snapshot(period=first of month P) = score at end of previous month, written on day 1.
- Dashboard `previousMonthScore` = that snapshot (null for new accounts → UI says "New account – you start at 700").
- Engine takes `asOf` date; treats later data as non-existent.
- **Cap DISABLED during seed/backfill** (otherwise U003–U005 could never fall below 650 from 700).

### P7 – Missing Endpoints and Tables
- Added: POST /admin/auth/login (email+password+simulated 2FA)
- Added: GET/PUT /users/me/consents
- Added: POST /challans/{challanId}/dispute
- Added: POST /admin/disputes/{disputeId}/resolve (UPHELD→WAIVED, REJECTED→revert)
- Added: `refunds` table (refund_id, txn_id, amount_paise, fee_reversed_paise, reason_code, admin_id, created_at)
- Added: WAIVED to challan status enum (scoring_eligible=false)
- transactions: added fee_mode, user_total_paise, settlement_to_provider_paise; vehicle_id and licence_id both nullable
- Admin reconciliation: mark TIMED_OUT → SUCCESS or FAILED (audited)

### P8 – Renewal Effects
- Insurance: +12 months, PUC: +6 months, RC: +5 years, Licence: +5 years.
- Each extends from later(today, current_expiry).
- FOUR_WHEELER insurance = ₹10,000 (1,000,000 paise) in simulated price table.

### P9 – Admin Roles
- Canonical names: SUPER_ADMIN, OPS, ANALYST (TRD spells them two ways; standardised).
- Seed one admin per role with demo-only passwords in README.

### P10 – Sessions
- Access token: 15 min. Refresh: rotation with reuse detection (TRD 8.3).
- Frontend idle timer: 15 min inactivity → logout + revoke refresh family.

### P11 – Receipts
- Deterministic: regenerating gives identical output (no "generated at" timestamps).
- POST /transactions requires Idempotency-Key header.
- `simulatedOutcome` accepted only when NODE_ENV ≠ "production".

### P12 – Formatting
- en-IN number grouping with ₹ symbol.
- Dates displayed in Asia/Kolkata, stored in UTC.

---

## Conflicts Found in Documents

### C1 – PRD 11 vs TRD 18.2: U001 category
- **PRD 11**: "Baseline score of 700 with full vehicle compliance, showing the Good category."
- **TRD 18.2**: "VERY_GOOD (streak bonus and full compliance)."
- **Resolution**: TRD wins per precedence. With the scoring formula (P4 streak from registration 2024-03-14 → 961 days → D=+50), score = 765 = VERY_GOOD. The PRD text "700" is the base, not the final score.

### C2 – TRD 9.2 Streak formula vs P4
- **TRD 9.2**: "streak ≥ 30 adds +10; ≥ 90 adds further +15 (total +25); ≥ 180 adds further +25 (total +50)" — this is cumulative wording.
- **P4**: "D = +10 at ≥30, +25 at ≥90, +50 at ≥180 (highest milestone reached, not cumulative on top)" — this is "pick the highest" wording.
- **Resolution**: Both produce the same values (+10, +25, +50). P4 wins; implemented as "pick the highest applicable milestone value."

### C3 – TRD 9.7 Pseudocode monthly cap
- **TRD pseudocode**: compares with "last_score(user)" (previous computation), which doesn't bound monthly movement properly.
- **P6 overrides**: anchor = monthly snapshot at start of current calendar month. |final − anchor| ≤ 50.
- **Resolution**: P6 wins.

### C4 – TRD 6.5 Sample PAN masked value
- **TRD 6.5**: `"pan_masked": "XXXXXX1001X"` (11 chars, overflows VARCHAR(10)).
- **P2**: masked = "XXXXXX" + last 4 = 10 chars → "XXXXXX001X".
- **Resolution**: P2 wins. All samples and tests use the corrected form.

### C5 – TRD 3 Node.js version
- **TRD 3**: "Node.js 20 LTS" — Node 20 has reached or is past end-of-life as of October 2026.
- **Resolution per spec_patches environment rule**: Use current LTS/stable release (Node 22 LTS). Logged here.

### C6 – TRD 12.2 Admin role naming inconsistency
- **TRD 12.2**: Uses "ADMIN_ANALYST" and "ADMIN_OPS" in some places.
- **P9**: Standardises to SUPER_ADMIN, OPS, ANALYST.
- **Resolution**: P9 wins. All code uses the P9 names.

### C7 – PRD 18.2 Stack constraint
- **PRD 18.2**: "Development is limited to the React, Node.js, Express and PostgreSQL stack defined in the TRD."
- **P1**: Amends PostgreSQL to SQLite for prototype.
- **Resolution**: P1 overrides. Noted here.

### C8 – TRD 9.2 Repeat Penalty wording
- **TRD 9.2**: `RP = -min(40, 10 × max(0, n_same − 1))` uses `n_same` implying per-code count.
- **P5**: Clarifies: `RP = -min(40, SUM over violation codes of 10 × max(0, n_code − 1))`, summing across all codes.
- **Resolution**: P5 is more explicit. Both formulas produce the same result when you sum across codes. P5 wins.

---

## Design Decisions Made (Simplest Reading)

### D1 – Scoring "round" function
- TRD says "rounded to the nearest integer". JavaScript `Math.round` is half-up for positive numbers (0.5 → 1). Since scores are always positive (500–900), this is consistent. Using `Math.round`.

### D2 – "On time" definition
- Seed targets say "on time = paid within 60 days of issue".
- Formula uses `payment_date ≤ due_date` where `due_date = challan_date + 60`.
- These are equivalent. Used `payment_date ≤ due_date` in code.

### D3 – Compliance: null expiry dates
- TRD says insurance_expiry and puc_expiry are nullable ("null means no policy on record").
- Decision: null expiry treated as **expired** (no valid document = penalty). This is the conservative reading and matches the intent.

### D4 – U009 RC validity
- Seed target says "insurance AND PUC expired" but doesn't mention RC.
- Decision: RC is valid for U009 vehicles. Only insurance and PUC are expired.

### D5 – LICENCE service has no vehicle
- P7 says "vehicle_id and licence_id both nullable" on transactions; "the LICENCE service has no vehicle."
- Decision: LICENCE renewal transactions have vehicle_id = null, licence_id = the user's licence.

### D6 – U003 severity assignment
- Seed target specifies 3 MEDIUM and 6 LOW at ages 10,40,75,110,150,200,250,300,340.
- Hand calculation shows MEDIUM at ages 40, 75, 150 yields score 591 (target).
- This assignment is deterministic for the seed.

### D7 – React version
- TRD 3 says "React 18". React 19 is the current stable as of 2026.
- Decision: Use React 19 (current stable). Logged here.
