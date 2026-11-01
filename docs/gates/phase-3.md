# Gate Report: Phase 3 — Scoring Engine

## (a) What Was Built
Phase 3 scoring engine, configuration, reason codes, and mathematical verification:
- Pure functional scoring engine (`computeVaiScore`) with zero database dependencies.
- Implemented all 5 scoring factors: age-decayed violation penalty (V, 365d half-life), repeat penalty (RP, P5), payment behaviour (P), driving discipline streak (D, P4), and document compliance (C).
- Implemented monthly movement cap logic (+/- 50 points, P6) with CAP_ADJ ledger entry and asOf evaluation.
- Implemented stable reason codes and plain-language label mappings for non-technical users.
- Automated test coverage: **Golden Test G1 passed**, **Golden Test G6 passed (5 property invariants across 2,500 random histories via fast-check)**, and penalty cap tests passed.

## (b) Exact Commands to Run It
To run the scoring engine tests directly:
```powershell
# 1. Run scoring unit tests (including Golden Test G1 and edge cases)
npx vitest run apps/api/tests/scoring.test.ts

# 2. Run fast-check property-based tests (Golden Test G6)
npx vitest run apps/api/tests/scoring.property.test.ts

# 3. Run full verification command across entire codebase
npm run verify
```

## (c) "Check It Yourself" Steps
1. Run `npx vitest run apps/api/tests/scoring.test.ts` to inspect Golden Test G1:
   - Observe exact outputs: V = -19.63, RP = 0, P = +9, D = +10, C = +15, raw = 714.37, score = 714, GOOD category, 36 points to VERY_GOOD.
2. Run `npx vitest run apps/api/tests/scoring.property.test.ts` to inspect Golden Test G6:
   - 1,000 runs prove score is strictly bounded in [500, 900].
   - 500 runs prove adding a confirmed violation never raises score.
   - 500 runs prove non-scoring challans (PENDING/DISPUTED/WAIVED) never alter score.
   - 500 runs prove ledger deltas reconcile to total score delta within +/-1.
3. Run `npm run verify` to observe that all 47 tests across 9 test files pass cleanly with zero lint and zero type errors.

## (d) Test Results
- **Command**: `npm run verify`
  - TypeScript Typecheck: Passed (0 errors across `packages/shared`, `apps/api`, `apps/web`).
  - ESLint: Passed (0 errors, 0 warnings).
  - Vitest Test Suite: **9 test files passed, 47 of 47 tests passed (100%)**.
    - `apps/api/tests/scoring.test.ts`: 4 passed (Golden Test G1, cap logic, PENDING/DISPUTED/WAIVED exclusion, penalty caps).
    - `apps/api/tests/scoring.property.test.ts`: 5 passed (Golden Test G6: bounds, monotonicity, non-scoring neutrality, decay, ledger delta reconciliation).
    - `apps/api/tests/db.test.ts`: 10 passed (triggers, constraints, FK restrict, seed guard).
    - `packages/shared/tests/money.test.ts`: 7 passed (G4, G2, G3, G7, formatting).
    - `packages/shared/tests/masking.test.ts`: 4 passed (G5, PAN, licence, mobile).
    - `packages/shared/tests/dates.test.ts`: 3 passed (calendar diffs, IST formatting).
    - `packages/shared/tests/schemas.test.ts`: 6 passed (Zod validation).
    - `apps/api/tests/crypto.test.ts`: 5 passed (AES-GCM, HMAC, timingSafeEqual).
    - `apps/api/tests/health.test.ts`: 3 passed (`/healthz`, `/readyz`, root banner).

## (e) TRACEABILITY IDs Completed
- **G1**: Score calculation worked example verified (714 GOOD, 36 points needed).
- **G6**: Property-based scoring verified (bounds, monotonicity, decay, neutrality, delta reconciliation).
- **FR-V4**: Disputed/Pending challans excluded from score calculation until resolved.
- **FR-D5**: Sequential score ledger with running balance, delta points, and plain-language labels.

## (f) Deviations, Decisions, and Open Questions
- **Decisions Logged in `docs/DECISIONS.md`**:
  - `scoringParametersSchema`: `severityWeights` defaults to `{ LOW: 5, MEDIUM: 15, HIGH: 30 }`.
  - Pure function design: `computeVaiScore` receives plain objects and handles asOf temporal filtering.
- **Open Questions**: None. Ready for Phase 4 (Seed & Worker).
