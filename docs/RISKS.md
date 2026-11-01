# VAI – Risk Register & Mitigation Strategy

This document details the architectural, regulatory, algorithmic, security, and operational risks identified across the PRD, TRD, and prototype implementation, along with their mitigation strategies.

---

## 1. Technical & Architectural Risks

| Risk ID | Description | Impact | Likelihood | Mitigation Strategy |
|---------|-------------|:------:|:----------:|---------------------|
| **TR-01** | **SQLite concurrency & table locks**<br>Simultaneous write operations (recalculations, quotes, payments) blocking each other in SQLite. | High | Low | • Enable WAL mode (`PRAGMA journal_mode=WAL;`).<br>• Enforce short transaction scopes with `busy_timeout = 5000`.<br>• Job queue runs serialized in-process jobs for recalculations. |
| **TR-02** | **Prisma provider portability**<br>Schema drifts or SQLite-specific features break eventual migration to PostgreSQL 16. | High | Medium | • Restrict Prisma schema to portable primitive types.<br>• Keep raw SQL migrations isolated in a dedicated migration file (P1c).<br>• Store JSON as `TEXT` and money as `BigInt`. |
| **TR-03** | **Precision loss in money arithmetic**<br>Rounding errors accumulating across discounts, government subsidy, platform fee, and proportional refunds. | High | Low | • All money represented as integer paise (`BigInt`).<br>• Multiply first, divide last, with strict `round_half_up`.<br>• Golden tests G2, G3, G4, and G7 enforce exact mathematical equivalence. |
| **TR-04** | **In-memory store volatility on restart**<br>Rate limits, token blacklist, or pending OTPs cleared if process crashes or restarts. | Medium | Medium | • `OtpStore` backed by SQLite `otp_sessions` table with expiration timestamps.<br>• Access tokens are short-lived (15 min) and stateless.<br>• Refresh token hashes stored persistently in DB with family rotation. |
| **TR-05** | **Race conditions in quote-to-payment transitions**<br>Simultaneous payment submissions or double-tapping confirmation button causing duplicate charges. | High | Low | • Mandatory `Idempotency-Key` header with 24-hour persistence.<br>• Strict transactional state machine transitions in SQLite: `VALIDATED -> PAYMENT_PENDING -> SUCCESS`. |

---

## 2. Security & Privacy Risks

| Risk ID | Description | Impact | Likelihood | Mitigation Strategy |
|---------|-------------|:------:|:----------:|---------------------|
| **SR-01** | **Accidental exposure or leakage of PAN**<br>Raw PAN leaking into application logs, error envelopes, or client payloads. | Critical | Medium | • Never store or log raw PAN. Validated in-memory only.<br>• Encrypted with AES-256-GCM at rest; HMAC-SHA256 for lookup.<br>• Redacting logger replaces any PAN pattern match in logs.<br>• API only returns masked form `XXXXXX001X` (P2, P5). |
| **SR-02** | **IDOR (Insecure Direct Object Reference)**<br>Citizens querying or modifying vehicles, challans, or transactions belonging to other users. | High | Medium | • Enforce strict ownership verification in the service layer.<br>• Return HTTP 404 (NOT_FOUND) instead of 403 on mismatch to prevent enumeration.<br>• Automated integration tests for cross-user resource access. |
| **SR-03** | **OTP enumeration & brute-force attacks**<br>Attacker attempting to guess 6-digit OTP or spamming phone numbers. | High | Medium | • Max 3 verification attempts before session invalidation.<br>• 5-minute strict expiration.<br>• Rate limiting: 3 OTP requests/10 min per mobile, 10/hr per IP.<br>• Uniform response timing and identical response for unknown mobile/PAN. |
| **SR-04** | **Refresh token hijacking**<br>Compromised refresh token used to generate unauthorized access tokens. | High | Low | • Token rotation on every refresh call.<br>• Family ID tracking: presenting an already rotated token revokes the entire family immediately. |

---

## 3. Algorithmic & Scoring Risks

| Risk ID | Description | Impact | Likelihood | Mitigation Strategy |
|---------|-------------|:------:|:----------:|---------------------|
| **AR-01** | **Score cliff / wild swings**<br>A cluster of challans causing catastrophic collapse in a citizen's score within a short period. | Medium | Low | • Violation penalty cap at -150.<br>• Overdue penalty cap at -100.<br>• Repeat penalty cap at -40.<br>• Monthly movement cap at $\pm 50$ points relative to monthly snapshot (P6). |
| **AR-02** | **Seed profile score deviation**<br>Seeded demo profiles (U001–U010) failing to match golden target scores. | High | Low | • Complete hand calculation and Python verification completed.<br>• Specific severity assignment identified for U003 (MEDIUM at ages 40, 75, 150).<br>• Seeding/backfill disables monthly cap to allow accurate historical trajectories. |
| **AR-03** | **Disputed challans affecting scores unfairly**<br>Challans subject to legitimate dispute unfairly depressing citizen scores. | Medium | Medium | • Scoring engine strictly filters `scoring_eligible = true` (`PAID` or `UNPAID` only).<br>• `PENDING`, `DISPUTED`, and `WAIVED` challans are excluded from scoring inputs. |

---

## 4. Usability & Compliance Risks

| Risk ID | Description | Impact | Likelihood | Mitigation Strategy |
|---------|-------------|:------:|:----------:|---------------------|
| **UR-01** | **Accessibility barriers for elderly citizens**<br>Complex UI, small tap targets, or relying on color alone to convey score category. | Medium | Medium | • WCAG 2.1 AA compliance verified via `axe-core`.<br>• Minimum 16px body font, high contrast ratios, touch targets $\ge 44\text{px}$.<br>• Color is never the sole indicator; categories always accompany text and icons. |
| **UR-02** | **Lack of DPDP compliance**<br>Processing user driving records without verifiable user consent. | High | Low | • Mandatory consent capture screen presented prior to accessing dashboard.<br>• Granular consent purposes logged with notice text hash in `consent_records`. |
