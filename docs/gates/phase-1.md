# Gate Report: Phase 1 — Foundations

## (a) What Was Built
Phase 1 foundation architecture and runtime libraries:
- npm-workspaces monorepo configured with `packages/shared`, `apps/api`, and `apps/web`.
- Implemented core libraries: `money.ts` (BigInt integer paise, `round_half_up`, INR formatting), `masking.ts` (10-char PAN masking), `dates.ts` (IST formatting, calendar days difference), `crypto.ts` (AES-256-GCM, HMAC-SHA256), and `logger.ts` (redacting Pino).
- Boot-time validated environment configuration via Zod, standard error envelope/codes, and TRD 5.2 middleware pipeline.
- Added `/healthz` and `/readyz` endpoints, Vitest test suite, and unified cross-platform `npm run verify` command.

## (b) Exact Commands to Run It
To run typechecking, linting, and all tests across all workspaces:
```powershell
# 1. Run the unified verification command
npm run verify

# 2. Or run individual workspace checks:
npm run typecheck
npm run lint
npx vitest run
```

## (c) "Check It Yourself" Steps
1. Execute `npm run verify` in the terminal; observe that TypeScript typecheck across all 3 workspaces passes cleanly, ESLint passes with 0 errors/warnings, and all 28 automated tests pass.
2. Verify G4 directly by inspecting or running `packages/shared/tests/money.test.ts`: base 12,350 at 100 bps yields 124 paise, base 12,345 yields 123 paise.
3. Verify G5 directly by inspecting or running `packages/shared/tests/masking.test.ts`: `DUMMY1001X` produces `XXXXXX001X` (exactly 10 characters).
4. Verify `/healthz` and `/readyz` via `apps/api/tests/health.test.ts`.

## (d) Test Results
- **Command**: `npm run verify`
  - TypeScript Typecheck: Passed (0 errors across `packages/shared`, `apps/api`, `apps/web`).
  - ESLint: Passed (0 errors, 0 warnings).
  - Vitest Unit Tests: **6 test files passed, 28 of 28 tests passed (100%)**.
    - `packages/shared/tests/money.test.ts` (7 tests passed: G4, G2, G3, G7, formatting, safe integer guard).
    - `packages/shared/tests/masking.test.ts` (4 tests passed: G5, dummy profiles, licence, mobile).
    - `packages/shared/tests/dates.test.ts` (3 tests passed: calendar days, document validity, IST formatting).
    - `packages/shared/tests/schemas.test.ts` (6 tests passed: P3 dummy PAN, E.164, strict validation, quotes, consents).
    - `apps/api/tests/crypto.test.ts` (5 tests passed: AES-256-GCM, random IV, tampering detection, HMAC-SHA256, timingSafeEqual).
    - `apps/api/tests/health.test.ts` (3 tests passed: `/healthz`, `/readyz`, prototype banner).

## (e) TRACEABILITY IDs Completed
- **FR-A5**: PAN masked everywhere (last 4 characters visible, 10 characters total).
- **G4**: Rounding half-up verified.
- **G5**: PAN masking verified.
- **NFR-3**: AES-256-GCM encryption at rest + HMAC-SHA256 lookup hash + redacting logger implemented.
- **NFR-4**: Consent schemas and validation defined.
- **NFR-7**: IST formatting and en-IN Rupee formatting helpers implemented.

## (f) Deviations, Decisions, and Open Questions
- **Deviations / Decisions Logged in `docs/DECISIONS.md`**:
  - `vitest.config.ts` configured with `resolve: { preserveSymlinks: true }` and `server: { deps: { inline: true } }` to avoid Windows sandbox `fs.realpath` EPERM restrictions.
  - Used named import `import { pinoHttp } from "pino-http"` for robust ESM compatibility under NodeNext.
- **New Dependencies Added**:
  - Dev dependencies: `@eslint/js`, `typescript-eslint`, `prettier` (as specified in TRD/environment).
  - Runtime dependencies: `dotenv` for env loading in local development.
- **Open Questions**: None. Gate requirements fully met; ready for Phase 2 (Database).
