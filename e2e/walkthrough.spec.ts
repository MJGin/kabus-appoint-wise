import { expect, test } from "@playwright/test";

const STUDENT = { reg: "LAW/M/1001/2024/25", password: "KabusTest2026!" };

const shot = (page: import("@playwright/test").Page, name: string) =>
  page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });

test("mobile onboarding walkthrough", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await shot(page, "01-landing");

  await page.goto("/auth");
  await page.waitForLoadState("networkidle");
  await shot(page, "02-auth-signin");

  await page.getByLabel(/registration number or staff email/i).first().fill(STUDENT.reg);
  await page.getByLabel(/^password/i).first().fill(STUDENT.password);
  await shot(page, "03-auth-filled");
  await page.getByRole("button", { name: /^sign in$/i }).first().click();
  await page.waitForURL((url) => !url.pathname.endsWith("/auth"), { timeout: 20_000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
  await shot(page, "04-post-signin");

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await shot(page, "05-dashboard");

  // Onboarding: student self-signup
  await page.goto("/auth");
  await page.waitForLoadState("networkidle");
  const createAccount = page.getByRole("button", { name: /create.*account|sign up|register/i }).first();
  if (await createAccount.count()) {
    await createAccount.click();
    await page.waitForLoadState("networkidle");
    await shot(page, "06-signup-form");

    await page.getByLabel(/full name/i).fill("Walkthrough Person");
    await page.getByLabel(/registration number/i).fill("LAW/M/9999/2024/25");
    await page.getByLabel(/^password/i).first().fill("Password123!");
    await page.getByLabel(/confirm password/i).fill("Password123!");
    await shot(page, "07-signup-filled");
    await page.getByRole("button", { name: /create account|sign up|register/i }).last().click();
    await page.waitForTimeout(3000);
    await shot(page, "08-signup-result");
  }

  expect(true).toBe(true);
});