# Phase 8 Gate Report: Citizen Web App (TRD 4, PRD 8, P1–P12)

**Gate Date:** 2026-11-01  
**Status:** **APPROVED & CODE COMPLETE**  
**Component:** `@vai/web`  

---

## 1. Executive Summary

Phase 8 implements the complete Citizen Web Application for the Vehicle Accountability Index (VAI) prototype. All 13 routes mandated by TRD 4.1 are fully implemented, statically type-checked with TypeScript 5.7, linted cleanly with zero warnings, and compiled into production-optimized assets (`apps/web/dist`).

---

## 2. Route Catalogue & Implementation

| Route | View Component | Status | Features & Compliance |
|---|---|---|---|
| `/` | `LandingPage.tsx` | Complete | Product overview, 3 core pillars, quick-select persona buttons for U001–U010, Admin portal entry link. |
| `/login` | `LoginPage.tsx` | Complete | E.164 mobile & dummy PAN validation, quick persona switcher, permanent prototype disclaimer. |
| `/verify` | `VerifyOtpPage.tsx` | Complete | 6-digit CSPRNG OTP verification, 5-min timer, 30s resend cooldown, simulated OTP auto-fill button. |
| `/consent` | `ConsentPage.tsx` | Complete | DPDP Act 2023 consent capture (Identity, Scoring, Partner Discounts) with explicit opt-ins. |
| `/dashboard` | `DashboardPage.tsx` | Complete | SVG 270° score meter, month-over-month delta, top score drivers, fleet status, renewal shortcuts. |
| `/score` | `ScorePage.tsx` | Complete | 12-month historical trend chart, next tier milestone progress, cursor-paginated immutable ledger. |
| `/vehicles` | `VehiclesPage.tsx` | Complete | Vehicle garage with insurance/PUC/RC badges, compliance warning highlights. |
| `/vehicles/:regNo` | `VehicleDetailPage.tsx` | Complete | Granular vehicle compliance record and vehicle-specific violation history. |
| `/challans` | `ChallansPage.tsx` | Complete | Filterable violation ledger (severity, payment status), citizen dispute filing modal. |
| `/rewards` | `RewardsPage.tsx` | Complete | Statutory benefit schedule (0% Fair, 1.00% Good, 2.00% Very Good). |
| `/services/:type` | `ServiceRenewalPage.tsx` | Complete | 4 renewal wizards, 15-min locked quotes, **5-line price breakdown**, simulated payment modal. |
| `/transactions` | `TransactionsPage.tsx` | Complete | Financial transaction history, payment reference tokens, link to deterministic receipts. |
| `/transactions/:txnId` | `ReceiptPage.tsx` | Complete | Official National Compliance Receipt, masked PAN, breakdown, JSON & PDF download. |
| `/profile` | `ProfilePage.tsx` | Complete | Masked identity info, active DPDP consents toggle, single-click sign-out. |

---

## 3. Core Architecture & UX Highlights

1. **5-Line Price Breakdown (PRD 8.2, TRD 10.3, Spec Patch P8)**:
   - **Line 1**: Base Service Price (e.g. ₹10,000.00).
   - **Line 2**: VAI Accountability Discount (e.g. -₹200.00 for 2.00% Very Good).
   - **Line 3**: Government-Funded Incentive (₹200.00 clearly labelled as government subsidy).
   - **Line 4**: Citizen Payable Amount (₹9,800.00).
   - **Line 5**: VAI Platform Fee (₹0.50 for Option A 50 ppm, separately stated and never netted).
2. **Accessible Score Meter (TRD 4.4)**:
   - Dynamic SVG 270-degree arc with color transitions (Emerald, Blue, Amber).
   - Includes high-contrast labels and `aria-label="VAI Score {score} out of 900, category {category}"`.
3. **Responsive Viewport Support (TRD 4.5)**:
   - **Mobile (360px)**: Bottom navigation bar (`BottomNav.tsx`), full-width stacked card layouts for challans.
   - **Desktop (1280px)**: Persistent sidebar navigation, multi-column grid dashboard, dense tabular views.
4. **Permanent Prototype Banner (PRD 18.2)**:
   - Prominently displays dummy data disclaimer, simulated OTP code, and active environment mode.
