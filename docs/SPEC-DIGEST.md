# VAI – Spec Digest (in my own words)

> Written by the engineering lead after reading PRD v1.0, TRD v1.0, and the 12 spec patches (P1–P12).

---

## 1. Purpose

VAI (Vehicle Accountability Index) is a web platform that gives every registered Indian driver a single compliance score (500–900, starting at 700). The score reflects their challan history, payment behaviour, and whether their vehicle documents and driving licence are valid. Good scores unlock discounts on four renewal services (insurance, PUC, RC, driving licence). The discount is government-funded; VAI earns a tiny platform fee (0.005%–0.010%) on the original amount. Everything is transparent: every score change is logged in a ledger the user can read.

The **prototype** runs entirely on **fictional data**. No real PAN, no real government API, no real payment gateway. Every external system sits behind an adapter interface with a simulated implementation.

---

## 2. Personas

| Persona | Representative | Key need |
|---------|---------------|----------|
| Salaried commuter | Priya, 34, owns a car and a two-wheeler | Lower insurance premium; one place to see challans |
| Fleet owner | Rahul, logistics, 3 commercial vehicles | Compliance status for every vehicle in one view |
| Senior driver | Anita, limited tech comfort | Large text, plain language, simple flows |
| Admin / Ops | Internal team | Configure scoring/rewards/fees; monitor revenue and data quality; audit trail |

---

## 3. Modules and Data Flow

```
┌──────────────┐   ┌──────────────┐
│ Citizen Web  │   │  Admin Web   │
│  (React+Vite)│   │  (React+Vite)│
└──────┬───────┘   └──────┬───────┘
       │                  │
       └──────┬───────────┘
              │ HTTPS/JSON
              v
  ┌──────────────────────────────────────┐
  │  API Gateway (Express)               │
  │  requestId → logger → helmet → CORS  │
  │  → bodyLimit → rateLimit → auth →    │
  │  RBAC → zodValidation → controller   │
  └──────────────┬───────────────────────┘
                 │
  ┌──────────────┴───────────────────────┐
  │        Domain Modules                │
  │  auth │ users │ vehicles │ challans  │
  │  scoring │ rewards │ services │      │
  │  transactions │ admin                │
  └──────────────┬───────────────────────┘
       ┌─────────┼──────────┐
       │         │          │
       v         v          v
   SQLite     In-Process   Scoring Worker
   (Prisma)   Stores       (event-driven +
              (OTP,Rate,   node-cron nightly
               Cache,Jobs) at 02:00 IST)
       │
       v
  Adapters: OTP | Registry | Challan |
            Insurer | PUC | Payment | Notification
  (all simulated in prototype)
```

### Module responsibilities

| Module | What it does |
|--------|-------------|
| **auth** | OTP request/verify, JWT access (15 min) & refresh (7 days, rotating with reuse detection), admin email+password+simulated 2FA |
| **users** | Profile (masked PAN only), consents |
| **vehicles** | Vehicle list, detail, document expiry status |
| **challans** | Challan queries, filters, cursor pagination, dispute workflow |
| **scoring** | Pure-function engine, ledger writer, snapshot writer, nightly + event-driven recalculation |
| **rewards** | Category resolution from latest score, discount calculation, eligibility check |
| **services** | Quote generation (15-min lock), renewal orchestration |
| **transactions** | State machine (CREATED→VALIDATED→PAYMENT_PENDING→SUCCESS/FAILED/TIMED_OUT→REFUNDED), fee calculation, receipts, idempotency, refunds |
| **admin** | User/vehicle/challan views (masked), config versioning (scoring/rewards/fees), dispute resolution, audit log, analytics, dataset reset |

---

## 4. Scoring Formula

```
Score = clamp( 700 + V + RP + P + D + C, 500, 900 )
```

### V – Violation penalty (age-decayed, severity-weighted)
```
V = max( -150, -Σ W(severity_i) × 0.5^(age_days_i / 365) )
W(LOW) = 5,  W(MEDIUM) = 15,  W(HIGH) = 30
```
Only **confirmed** challans (status PAID or UNPAID). PENDING/DISPUTED/WAIVED excluded.

### RP – Repeat penalty (P5)
```
RP = -min( 40, Σ over violation_codes of 10 × max(0, n_code − 1) )
```
Counts confirmed challans in the **last 365 days**, grouped by `violation_code`.

### P – Payment behaviour
```
P = min(30, 3 × N_on_time) + max(-100, -20 × N_overdue_unpaid)
N_on_time    = PAID challans where payment_date ≤ due_date
N_overdue    = UNPAID challans where today > due_date
```

### D – Driving discipline / streak (P4)
```
streak_days = days since last confirmed violation
              (if none: days since registration_date)
D = +50  if streak ≥ 180
    +25  if streak ≥ 90
    +10  if streak ≥ 30
     0   otherwise
(highest milestone reached, not cumulative)
```

### C – Vehicle & licence compliance
```
Per vehicle v:
  c_v = (+5 if insurance valid) + (+5 if PUC valid) + (+5 if RC valid)
      + (-10 for each expired document)

C_vehicle = clamp( average(c_v), -30, +15 )
licence_term = -15 if licence expired, else 0
C = C_vehicle + licence_term
```

### Monthly cap (P6)
```
anchor = score snapshot at start of current calendar month (700 if none)
|final_score − anchor| ≤ 50
When applied, write a CAP_ADJ ledger entry.
Cap is DISABLED during seed/backfill.
```

### Categories
| Range | Category | Discount |
|-------|----------|----------|
| 500–649 | FAIR | 0 bps |
| 650–749 | GOOD | 100 bps (1%) |
| 750–900 | VERY_GOOD | 200 bps (2%) |

---

## 5. Reward & Fee Formulas

### Discount
```
discount_paise = round_half_up( base_amount_paise × discount_bps / 10000 )
govt_funded    = discount_paise          (prototype: sponsor funds 100%)
payable_paise  = base_amount_paise − discount_paise
```

### Platform fee
```
platform_fee_paise = round_half_up( base_amount_paise × ppm / 1,000,000 )
Option A: 50 ppm (0.005%)     Option B: 100 ppm (0.010%)
```

### Fee mode
- **PROVIDER_PAYS**: `settlement_to_provider = base − discount − fee`; user pays `payable_paise`
- **PASS_THROUGH**: `user_total = payable_paise + fee`; provider gets `base − discount`

### Renewal effects on success (P8)
| Service | Extension | From |
|---------|-----------|------|
| Insurance | +12 months | later(today, current_expiry) |
| PUC | +6 months | later(today, current_expiry) |
| RC | +5 years | later(today, current_expiry) |
| Licence | +5 years | later(today, current_expiry) |

---

## 6. Money Rules

- All money is **integer paise** stored as BigInt. Convert to number only at the repository boundary with a safe-integer guard.
- **No floats for money anywhere.**
- Rounding is **half-up** to the nearest paisa.
- Display: en-IN grouping with ₹ symbol (e.g. ₹9,800.00).

---

## 7. PAN Rules

- Stored encrypted: AES-256-GCM (random 96-bit nonce per record).
- Lookup: HMAC-SHA256 hash of normalised PAN.
- Display: **masked form only** = `"XXXXXX" + last4chars` (10 chars total) (P2).
- Validation regex at login: `^[A-Z]{5}[0-9]{4}[A-Z]$` (P3). No holder-type check.
- **Never logged, never in localStorage, never returned by API.**
- Permanent banner: "Prototype – simulated OTP – do not enter a real PAN."

---

## 8. Auth Flow

### Citizen
1. Enter mobile (E.164) + PAN → validate → create OTP session
2. Generate 6-digit OTP (CSPRNG), store HMAC with 5-min TTL, 3 attempts
3. Verify OTP → issue access token (15 min, in memory) + refresh token (7 days, HttpOnly Strict cookie)
4. Refresh rotation with reuse detection per TRD 8.3
5. Idle timeout 15 min → logout + revoke refresh family (FR-A4, FR-A6)
6. Consent step before dashboard

### Admin (P7, P9)
1. Email + password (Argon2id)
2. Simulated 6-digit second factor shown on dummy banner
3. Roles: SUPER_ADMIN, OPS, ANALYST
4. Seeded: one per role

---

## 9. Transaction State Machine

```
CREATED → VALIDATED → PAYMENT_PENDING → SUCCESS → (REFUNDED)
  ↓          ↓              ↓
expired    expired       FAILED
                         TIMED_OUT
```
- Admin can reconcile TIMED_OUT → SUCCESS or FAILED (audited) (P7).
- Only SUCCESS can be REFUNDED.
- POST /transactions requires Idempotency-Key header.

---

## 10. Key Tables

users, vehicles, licences, challans, vai_scores, score_ledger, score_snapshots, transactions, service_providers, reward_config, fee_config, scoring_config, admins, audit_logs, consent_records, disputes, otp_sessions, refunds (P7), score_jobs (P1d).

---

## 11. Seed Profiles (10 users)

| ID | Scenario | Target Score | Category |
|----|----------|:----------:|----------|
| U001 | Zero challans, registered 2024-03-14 | 765 | VERY_GOOD |
| U002 | 3 LOW paid on time | 742 | GOOD |
| U003 | 9 challans, repeat codes, 4 unpaid | 591 | FAIR |
| U004 | 2 HIGH same code, paid late, expired docs | 634 | FAIR |
| U005 | 4 UNPAID, 3 past due | 630 | FAIR |
| U006 | 2 LOW paid, excellent 12 months | 765 | VERY_GOOD |
| U007 | Commercial fleet, mixed docs | 726 | GOOD |
| U008 | Brand new, 2 days old | 715 | GOOD |
| U009 | Expired docs, licence expired | 669 | GOOD |
| U010 | Disputed+pending challans (excluded) | 725 | GOOD |

All use dummy PANs (DUMMY1001X–DUMMY1010X), dummy mobiles (+919000000001–+919000000010), seed date 2026-10-30.

---

## 12. Adapter Interfaces

Every external system is behind an adapter interface:
- **OtpAdapter**: send(mobile, otp) → delivery status
- **RegistryAdapter**: getVehicle(regNo) → vehicle details
- **ChallanAdapter**: list(userId) → challans
- **InsurerAdapter**: getQuote, issueRenewal
- **PucAdapter**: checkSlot, book, receiveCertificate
- **PaymentAdapter**: createOrder, capture, refund
- **NotificationAdapter**: send notification

Prototype provides simulated implementations. Switching to live = new implementation, no business logic change.

---

## 13. Non-Functional Requirements

- Responsive: 360px, 768px, 1280px tested
- Performance: dashboard < 2s on 4G, API p95 < 300ms reads
- Security: PAN encrypted+masked, OTP rate-limited, RBAC, helmet, CORS, 100KB body, Zod validation
- Privacy: consent captured before dashboard, DPDP Act compliant
- Accessibility: WCAG 2.1 AA, min 16px body, keyboard nav, colour never sole signal
- Auditability: all score/config changes logged, append-only, immutable
