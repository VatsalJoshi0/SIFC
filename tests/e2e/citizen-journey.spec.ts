import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.describe("Citizen Web App - End-to-End Critical Journeys (Phase 8 Gate)", () => {
  const screenshotsDir = path.resolve(process.cwd(), "docs/gates/screenshots");

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test("Journey 1: Landing -> Login -> OTP -> Consent -> Dashboard (1280px desktop)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Visit landing page
    await page.goto("/");
    await expect(page).toHaveTitle(/VAI - Vehicle Accountability Index/);
    await expect(page.getByText("Prototype: Simulated OTP mode active")).toBeVisible();

    // 2. Click Citizen Sign In
    await page.getByRole("link", { name: "Citizen Sign In" }).first().click();
    await expect(page).toHaveURL(/\/login/);

    // 3. Fill mobile and PAN for U001 (Priya Sharma, 765 VERY_GOOD)
    await page.locator("#mobile").fill("+919000000001");
    await page.locator("#pan").fill("DUMMY1001X");
    await page.getByRole("button", { name: "Request OTP" }).click();

    // 4. Verify OTP page - use auto-fill for exact CSPRNG OTP
    await expect(page).toHaveURL(/\/verify/);
    await expect(page.getByRole("button", { name: "Auto-fill" })).toBeVisible();
    await page.getByRole("button", { name: "Auto-fill" }).click();
    await page.getByRole("button", { name: "Verify & Sign In" }).click();

    // 5. Consent Notice page (if shown) or Dashboard
    await page.waitForURL(/\/(dashboard|consent)/);
    if (page.url().includes("/consent")) {
      await expect(page.getByText("Citizen Data Consent Notice")).toBeVisible();
      await page.getByRole("button", { name: "I Consent & Proceed" }).click();
      await page.waitForURL(/\/dashboard/);
    }

    // 6. Citizen Dashboard
    await expect(page.getByText("Citizen Dashboard")).toBeVisible({ timeout: 10000 });

    // Verify Score Meter (765 VERY_GOOD for U001 per P4 / TRD 18.2)
    const scoreMeter = page.getByRole("img", { name: /VAI Score 765/ });
    await expect(scoreMeter).toBeVisible();
    await expect(page.getByText("765").first()).toBeVisible();
    await expect(page.getByText("Very Good").first()).toBeVisible();

    // Verify summary metrics
    await expect(page.getByText("Unpaid Challans")).toBeVisible();
    await expect(page.getByText("Renewal Discount")).toBeVisible();

    // Capture desktop dashboard screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "citizen-01-dashboard-1280px.png"),
      fullPage: true,
    });
  });

  test("Journey 2: Insurance Renewal -> 5-Line Price Breakdown -> Simulated Payment -> Deterministic Receipt", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Login with U006 (Sunita Verma, 765 VERY_GOOD, 4-wheeler)
    await page.goto("/login");
    await page.locator("#mobile").fill("+919000000006");
    await page.locator("#pan").fill("DUMMY1006X");
    await page.getByRole("button", { name: "Request OTP" }).click();
    await expect(page).toHaveURL(/\/verify/);
    await page.getByRole("button", { name: "Auto-fill" }).click();
    await page.getByRole("button", { name: "Verify & Sign In" }).click();
    await page.waitForURL(/\/(dashboard|consent)/);
    if (page.url().includes("/consent")) {
      await page.getByRole("button", { name: "I Consent & Proceed" }).click();
      await page.waitForURL(/\/dashboard/);
    }

    // 2. Navigate to Insurance Renewal flow via dashboard card
    await expect(page.getByText("Citizen Dashboard")).toBeVisible({ timeout: 10000 });
    await page.getByRole("link", { name: /Motor Insurance/ }).click();
    await expect(page).toHaveURL(/\/services\/insurance/);
    await expect(page.getByText("Four-Wheeler Motor Insurance")).toBeVisible();

    // 3. Generate 15-Minute Locked Quote
    await page.getByRole("button", { name: "Generate 15-Minute Locked Quote" }).click();

    // 4. Verify 5-line price breakdown (PRD 8.2, TRD 10.3, P8)
    await expect(page.getByText("Renewal Price Breakdown")).toBeVisible();
    await expect(page.getByText("Base Service Price")).toBeVisible();
    await expect(page.getByText("₹10,000.00").first()).toBeVisible();
    await expect(page.getByText("VAI Accountability Discount (2.00%)")).toBeVisible();
    await expect(page.getByText("- ₹200.00")).toBeVisible();
    await expect(page.getByText("Government-Funded Incentive")).toBeVisible();
    await expect(page.getByText("₹200.00").first()).toBeVisible();
    await expect(page.getByText("Service Payable Amount")).toBeVisible();
    await expect(page.getByText("₹9,800.00").first()).toBeVisible();
    await expect(page.getByText(/VAI Platform Fee/)).toBeVisible();
    await expect(page.getByText("₹0.50")).toBeVisible();

    // Capture price breakdown screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "citizen-02-breakdown-1280px.png"),
    });

    // 5. Open Simulated Payment Modal
    await page.getByRole("button", { name: /Confirm & Pay/ }).click();
    await expect(page.getByText("Simulated Payment Gateway")).toBeVisible();

    // 6. Submit Simulated Payment
    await page.getByRole("button", { name: "Submit Payment" }).click();

    // 7. Success state confirmation
    await expect(page.getByText("Renewal Completed Successfully!")).toBeVisible();
    await expect(page.getByText("Validity Extension: +12 Months")).toBeVisible();

    // 8. Open Official Receipt
    await page.getByRole("link", { name: "View Official Deterministic Receipt" }).click();
    await expect(page).toHaveURL(/\/transactions\/TXN-/);
    await expect(page.getByText("National Compliance Receipt")).toBeVisible();
    await expect(page.getByText("Sunita Verma")).toBeVisible();
    await expect(page.getByText("PAN: XXXXXX006X")).toBeVisible();
    await expect(page.getByText("₹9,800.00").first()).toBeVisible();

    // Capture receipt screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "citizen-03-receipt-1280px.png"),
      fullPage: true,
    });
  });

  test("Journey 3: Responsive Breakpoints (360px mobile and 768px tablet)", async ({ page }) => {
    // 1. Mobile 360px viewport (TRD 4.5) with U002 (Rajesh Patel, 742 GOOD)
    await page.setViewportSize({ width: 360, height: 740 });

    await page.goto("/login");
    await page.locator("#mobile").fill("+919000000002");
    await page.locator("#pan").fill("DUMMY1002X");
    await page.getByRole("button", { name: "Request OTP" }).click();
    await expect(page).toHaveURL(/\/verify/);
    await page.getByRole("button", { name: "Auto-fill" }).click();
    await page.getByRole("button", { name: "Verify & Sign In" }).click();
    await page.waitForURL(/\/(dashboard|consent)/);
    if (page.url().includes("/consent")) {
      await page.getByRole("button", { name: "I Consent & Proceed" }).click();
      await page.waitForURL(/\/dashboard/);
    }

    await expect(page.getByText("Citizen Dashboard")).toBeVisible({ timeout: 10000 });

    // Verify Mobile Bottom Navigation bar exists
    const bottomNav = page.getByRole("navigation", { name: "Mobile Bottom Navigation" });
    await expect(bottomNav).toBeVisible();

    // Capture 360px mobile dashboard screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "citizen-04-dashboard-360px.png"),
      fullPage: true,
    });

    // 2. Navigate to Challans on mobile via bottom navigation
    await bottomNav.getByRole("link", { name: "Challans" }).click();
    await expect(page).toHaveURL(/\/challans/);
    await expect(page.getByText("Traffic Challans & Disputes")).toBeVisible();

    // Capture mobile challans cards screenshot (demonstrates table -> card switch below 768px)
    await page.screenshot({
      path: path.join(screenshotsDir, "citizen-05-challans-cards-360px.png"),
    });

    // 3. Tablet 768px viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await bottomNav.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Citizen Dashboard")).toBeVisible();

    // Capture tablet 768px screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "citizen-06-dashboard-768px.png"),
      fullPage: true,
    });
  });
});
