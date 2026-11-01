# Gate Report: Phase 2 — Database

## (a) What Was Built
Phase 2 database architecture, migrations, and repositories:
- Defined complete Prisma schema for all 19 entities (TRD Section 6, Patches P1a–P1d, P7, P9, P11).
- Applied raw-SQL migration `0_init/migration.sql` with SQLite foreign keys ON, CHECK constraints, and partial indexes.
- Implemented append-only triggers on `score_ledger` and `audit_logs` that abort on UPDATE or DELETE.
- Implemented partial unique index enforcing at most a single active `fee_config` row at any time.
- Implemented typed repositories (`user`, `vehicle`, `challan`, `score`, `transaction`, `config`, `audit`) with ownership checks and `is_dummy` guard.

## (b) Exact Commands to Run It
To run migrations and execute the database test suite:
```powershell
# 1. Apply migrations from empty database
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma

# 2. Run the database test suite directly
npx vitest run apps/api/tests/db.test.ts

# 3. Run full verification command
npm run verify
```

## (c) "Check It Yourself" Steps
1. Run `npx vitest run apps/api/tests/db.test.ts` in the terminal to observe all 10 database tests passing.
2. Confirm the append-only triggers: attempting `UPDATE` or `DELETE` on `score_ledger` or `audit_logs` raises an abort error (`1811: ... is append-only: ... is prohibited`).
3. Confirm partial unique index: creating a second `fee_config` with `is_active = true` is rejected with `UNIQUE constraint failed`.
4. Confirm CHECK constraints: inserting `vai_scores` with `score` < 500 or > 900, `challans` with `amount_paise = 0`, or `users` with `pan_masked` length != 10 is rejected with `CHECK constraint failed`.
5. Confirm foreign key RESTRICT: deleting a user with existing vehicles fails with foreign key constraint violation.
6. Confirm `is_dummy` seed guard: attempting to delete a user with `isDummy = false` is rejected with a security alert.

## (d) Test Results
- **Command**: `npm run verify`
  - TypeScript Typecheck: Passed (0 errors across `packages/shared`, `apps/api`, `apps/web`).
  - ESLint: Passed (0 errors, 0 warnings).
  - Vitest Test Suite: **7 test files passed, 38 of 38 tests passed (100%)**.
    - `apps/api/tests/db.test.ts`: 10 passed (triggers, single active fee_config, CHECK constraints, FK RESTRICT, seed guard).
    - `packages/shared/tests/money.test.ts`: 7 passed (G4, G2, G3, G7, formatting).
    - `packages/shared/tests/masking.test.ts`: 4 passed (G5, dummy PANs, licences, mobile).
    - `packages/shared/tests/dates.test.ts`: 3 passed (calendar diffs, IST formatting).
    - `packages/shared/tests/schemas.test.ts`: 6 passed (Zod validation).
    - `apps/api/tests/crypto.test.ts`: 5 passed (AES-GCM, HMAC, timingSafeEqual).
    - `apps/api/tests/health.test.ts`: 3 passed (`/healthz`, `/readyz`, root banner).

## (e) TRACEABILITY IDs Completed
- **NFR-6**: Auditability (immutable score_ledger and audit_logs enforced via database triggers).
- **P1a–P1d**: Portable SQLite database with BigInt paise, CHECK constraints, append-only triggers, and in-process stores.
- **P7-Refunds (DB schema & repository)**: Refunds table, proportional fee reversal, and txn state management.

## (f) Deviations, Decisions, and Open Questions
- **Decisions Logged in `docs/DECISIONS.md`**:
  - `dev.db` created locally via SQLite and git-ignored.
  - Partial unique index `fee_config_single_active_uq` indexed on `is_active WHERE is_active = 1` to strictly enforce at most one active fee config system-wide.
  - `0_init/migration.sql` includes explicit `PRAGMA foreign_keys = ON;` and `createPrismaClient()` executes the PRAGMA on every connection.
- **Open Questions**: None. Gate requirements fully met; ready for Phase 3 (Scoring Engine).
