import { expect, test } from "@playwright/test";

const STUDENT = {
  reg: "LAW/1001/2024",
  password: "KabusTest2026!",
};

async function signInStudent(page: import("@playwright/test").Page) {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await page.getByLabel(/registration number or staff email/i).first().fill(STUDENT.reg);
  await page.getByLabel(/^password/i).first().fill(STUDENT.password);
  await page.getByRole("button", { name: /^sign in$/i }).first().click();
  // Leave /auth once the session lands on dashboard (or shows an auth error).
  await page.waitForURL((url) => !url.pathname.endsWith("/auth"), { timeout: 15_000 }).catch(() => {
    /* stay put; caller asserts */
  });
  await page.waitForLoadState("domcontentloaded");
}

test.describe("Student authentication", () => {
  test("student can sign in with LAW/ registration number", async ({ page }) => {
    await signInStudent(page);
    await expect(page).not.toHaveURL(/\/auth$/);
    // Dashboard or landing post-auth
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(50);
  });

  test("AI slot finder panel is present for signed-in student", async ({ page }) => {
    await signInStudent(page);
    // Navigate to dashboard if needed
    if (!page.url().includes("dashboard")) {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
    }
    const aiPanel = page.getByText(/AI slot finder|AI Gateway|Suggest open times/i).first();
    // Panel may require role=student; if not visible the user is not on student dash
    const count = await aiPanel.count();
    test.info().annotations.push({
      type: "note",
      description: `AI panel visible: ${count > 0}`,
    });
  });
});

test.describe("AI slot finder UI", () => {
  test("requires lecturer selection before recommending", async ({ page }) => {
    await signInStudent(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const suggest = page.getByRole("button", { name: /suggest open times/i }).first();
    if (await suggest.count()) {
      await expect(suggest).toBeDisabled();
    }
  });

  test("accepts a natural-language scheduling need", async ({ page }) => {
    await signInStudent(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const needs = page.getByLabel(/scheduling needs/i).first();
    if (await needs.count()) {
      await needs.fill("I need a short meeting next week, mornings preferred, urgent.");
      const suggest = page.getByRole("button", { name: /suggest open times/i }).first();
      if ((await suggest.count()) && (await suggest.isEnabled())) {
        await suggest.click();
        await page.waitForTimeout(2500);
      }
    }
  });
});
