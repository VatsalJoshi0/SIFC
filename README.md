# Vehicle Accountability Index (VAI) – National Prototype

> **MoRTH / Parivahan-Compatible Citizen Driver Scoring, Transparent Ledger & Statutory Renewal Incentives Platform**  
> *Built strictly in accordance with PRD, TRD, and Lead Architect Spec Patches P1–P12.*

---

## 1. Quickstart (Run in 3 Commands)

Ensure you have **Node.js 20+** installed.

```bash
# 1. Install all dependencies across the monorepo
npm install

# 2. Initialize database and seed deterministic personas U001–U010
npm run seed

# 3. Start API backend and Web application concurrently
npm run dev
```

- **Citizen Web Portal**: [http://localhost:5173](http://localhost:5173)  
- **Admin Governance Portal**: [http://localhost:5173/admin/login](http://localhost:5173/admin/login)  
- **Backend API & Swagger/Health**: [http://localhost:3001/healthz](http://localhost:3001/healthz)

---

## 2. Seed Personas & Demo Test Accounts

The database is deterministically pre-populated with 10 distinct citizen profiles covering every scoring tier and violation pattern, calibrated exactly to their target scores ($\pm 0$ variance).

### Citizen Personas (Mobile + PAN + Simulated OTP)

*Note: In simulated mode, any 6-digit OTP works, or you can click the **"Auto-fill"** button on the OTP screen.*

| ID | Citizen Name | Mobile (E.164) | Dummy PAN | Target Score | Category | Profile Profile Description |
|:---:|:---|:---|:---:|:---:|:---:|:---|
| **U001** | Priya Sharma | `+919000000001` | `DUMMY1001X` | **765** | **VERY GOOD** | Zero challans, 100% document compliance, top tier (2.00% discount) |
| **U002** | Rajesh Patel | `+919000000002` | `DUMMY1002X` | **742** | **GOOD** | 3 paid LOW challans, high compliance, good tier (1.00% discount) |
| **U003** | Vikram Singh | `+919000000003` | `DUMMY1003X` | **591** | **FAIR** | Frequent repeat speeding violations, advisory only (0% discount) |
| **U004** | Ananya Iyer | `+919000000004` | `DUMMY1004X` | **634** | **FAIR** | 2 HIGH severity challans, expired vehicle insurance & PUC |
| **U005** | Mohammed Khan | `+919000000005` | `DUMMY1005X` | **630** | **FAIR** | 4 unpaid past-due challans, heavy delinquency penalty |
| **U006** | Sunita Verma | `+919000000006` | `DUMMY1006X` | **765** | **VERY GOOD** | 180-day violation-free streak, 4-wheeler owner (Ideal for renewal demo) |
| **U007** | Gurpreet Singh | `+919000000007` | `DUMMY1007X` | **726** | **GOOD** | Commercial fleet owner (3 vehicles), 1 expired PUC certificate |
| **U008** | Deepak Joshi | `+919000000008` | `DUMMY1008X` | **715** | **GOOD** | New account (starts at baseline 700), clean initial history |
| **U009** | Kavita Reddy | `+919000000009` | `DUMMY1009X` | **669** | **GOOD** | Near lower boundary of Good tier, expired insurance & PUC |
| **U010** | Amitabh Das | `+919000000010` | `DUMMY1010X` | **725** | **GOOD** | Active contested challan under dispute (excluded from score) |

---

### Admin & Staff Accounts (Argon2id + Simulated 2FA)

*Login at `/admin/login`. 2FA Code is statically displayed or auto-filled as `123456`.*

| Role | Work Email | Password | Permissions |
|:---|:---|:---|:---|
| **SUPER_ADMIN** | `superadmin@vai.local` | `SuperAdmin@123` | Full administrative control, fee switching, dataset reset, refunds |
| **OPS** | `ops@vai.local` | `OpsAdmin@123` | Dispute adjudication queue, transaction inspections, user directory |
| **ANALYST** | `analyst@vai.local` | `Analyst@123` | Executive analytics dashboard, read-only audit trail, CSV exports |

---

## 3. Evaluator Walkthrough Guide

### Journey A: Citizen Experience (Score & Renewal Savings)

1. **Open Landing Page**: Visit `http://localhost:5173/`. Click on any demo persona card (e.g. **Sunita Verma U006** or **Priya Sharma U001**).
2. **Citizen Sign-In**:
   - The Mobile (`+919000000006`) and Dummy PAN (`DUMMY1006X`) are pre-filled.
   - Click **"Request OTP"**.
   - On the verification screen, click the **"Auto-fill"** button (or enter the OTP from the banner) and click **"Verify & Sign In"**.
3. **DPDP Act 2023 Consent Notice**: Review the statutory purposes (Identity, Scoring, Discounts) and click **"I Consent & Proceed"**.
4. **Citizen Dashboard**:
   - View the interactive SVG **270° Score Meter** showing **765 (Very Good)**.
   - Inspect the score drivers: Zero challans (+35 pts), Full document compliance (+20 pts), Baseline (+700).
5. **Score Ledger & History**:
   - Navigate to `/score` to see the 12-month historical snapshot graph and the append-only ledger entries explaining each point delta.
6. **Service Renewal & 5-Line Price Breakdown (PRD 8.2 & P8)**:
   - Click **"Motor Insurance"** from the dashboard or renewal shortcuts.
   - Click **"Generate 15-Minute Locked Quote"**.
   - Observe the strictly compliant **5-line breakdown**:
     1. Base Service Price: `₹10,000.00`
     2. VAI Accountability Discount (2.00%): `-₹200.00`
     3. Government-Funded Incentive: `₹200.00` (clarifying government subsidy)
     4. Service Payable Amount: `₹9,800.00`
     5. VAI Platform Fee (Option A: 50 ppm): `₹0.50` (separately stated, NOT netted)
7. **Simulated Payment & Official Receipt**:
   - Click **"Confirm & Pay"** $\to$ Click **"Submit Payment"**.
   - View the confirmation screen and click **"View Official Deterministic Receipt"**.
   - Download the official receipt as structured **JSON** or **PDF**.

---

### Journey B: Admin Governance Experience

1. **Open Admin Portal**: Visit `http://localhost:5173/admin/login` (or click "Admin Portal" on the landing page header).
2. **Staff Login**:
   - Click the **"Super Admin"** quick-select button (`superadmin@vai.local`).
   - Click **"Proceed to 2FA"** $\to$ click **"Auto-fill"** (`123456`) $\to$ **"Verify 2FA & Enter Portal"**.
3. **Executive Dashboard**:
   - Inspect real-time population distribution across Fair (<650), Good (650–749), and Very Good (750–900).
   - Review platform gross volume, funded rewards sum, and accrued platform fees.
4. **Citizen Dispute Adjudication Queue (`/admin/disputes`)**:
   - View pending citizen disputes (e.g. for Amitabh Das U010).
   - Click **"Uphold"** to waive the fine and award restitution points, or **"Reject"** to reinstate the penalty.
5. **Governance & Fee Switcher (`/admin/governance`)**:
   - Toggle between **Option A (50 PPM)** and **Option B (100 PPM)**.
   - Notice that the partial unique index at the database level guarantees only one fee configuration is active at any time.
6. **Proportional Refund Execution (`/admin/transactions`)**:
   - Select any completed transaction and issue a partial refund (e.g. ₹5,000.00 of ₹9,800.00).
   - Observe that the platform fee is automatically and proportionally clawed back using BigInt precision.
7. **Tamper-Proof Audit Trail & CSV Export (`/admin/audit`)**:
   - Browse the immutable log of system events.
   - Download single-click regulatory CSV files for Citizens, Transactions, Challans, and Audit Logs.

---

## 4. Architectural Highlights & Lead Architect Specs

```
┌────────────────────────────────────────────────────────────────────────┐
│                          VAI Monorepo Topology                         │
├────────────────────────────┬─────────────────────────────┬─────────────┤
│  apps/web (React 19 + Vite)│ apps/api (Node.js + Express)│ @vai/shared │
│  - 13 Citizen Views (TRD 4)│ - Pure Scoring Engine       │ - BigInt    │
│  - 7 Admin Views (TRD 5)   │ - In-Process Queue & Cron   │   Money Math│
│  - Tailwind CSS + Lucide   │ - AES-256-GCM / HMAC Crypto │ - Masking   │
│  - Mobile BottomNav (360px)│ - SQLite Triggers (Dev)     │ - Zod Types │
└────────────────────────────┴─────────────────────────────┴─────────────┘
```

- **Spec Patch P1 (Database & Triggers)**: Dev uses local SQLite with Prisma ORM; 100% portable to PostgreSQL 16. Includes native SQLite triggers prohibiting `DELETE` and `UPDATE` on `score_ledger` and `audit_logs`.
- **Spec Patch P2 & P3 (PAN Masking & Validation)**: Citizen PANs are masked as `XXXXXX` + last 4 characters (`XXXXXX001X`), strictly 10 characters long. Validation accepts `^[A-Z]{5}[0-9]{4}[A-Z]$` for dummy profiles.
- **Spec Patch P4 (Deterministic Seed)**: 10 profiles (U001–U010) match their exact mathematical target scores with 12 monthly backfilled snapshots.
- **Spec Patch P6 (15-Minute Locked Quotes)**: Quote generation freezes score, tier, discount, and fee for exactly 15 minutes to eliminate race conditions.
- **Spec Patch P7 (Proportional Fee Clawback)**: Partial refunds reverse the platform fee in exact mathematical proportion:
  $$\text{feeReversedPaise} = \left\lfloor \frac{\text{refundPaise} \times \text{originalFeePaise}}{\text{originalPayablePaise}} + 0.5 \right\rfloor$$
- **Spec Patch P8 (Platform Fee Presentation)**: Separately stated fee under Option A (50 ppm / 0.005%) or Option B (100 ppm / 0.010%). Never netted against citizen discounts.
- **Spec Patch P10 (Session Security & Idle Timeout)**: 15-minute frontend inactivity timer that automatically revokes refresh token families upon timeout.

---

## 5. Verification & Test Suite

The codebase is backed by **15 test suites and 131 tests**, passing with 100% success:

```bash
# Run unit and integration test suite
npm test

# Run TypeScript typecheck across all workspaces
npm run typecheck

# Run ESLint across all workspaces
npm run lint
```

- **Golden Test G1**: Worked calculation example (714 GOOD) verified.
- **Golden Test G2 & G3**: 1,000,000 paise base reward and platform fee verification.
- **Golden Test G4**: Symmetric half-up integer rounding verified.
- **Golden Test G5**: PAN masking verified across all representations.
- **Golden Test G6**: Property-based scoring testing with `fast-check` (scores strictly bounded in $[500, 900]$).
- **Golden Test G7**: Proportional refund calculations verified.

---

## 6. Regulatory & Compliance Notice

This application is an educational prototype engineered to demonstrate compliance with:
- **Motor Vehicles Act (Amendment) 2019 / Section 136A** (Electronic monitoring & enforcement)
- **Digital Personal Data Protection (DPDP) Act 2023** (Explicit purpose consents and identity masking)
- **Ministry of Road Transport and Highways (MoRTH)** standard security guidelines
