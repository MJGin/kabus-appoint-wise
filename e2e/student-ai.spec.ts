import { expect, test } from "@playwright/test";

// Credentials come from the environment so no password is committed to the repository.
// Run with a real, dedicated test student, e.g.
//   E2E_STUDENT_EMAIL="student@students.kabu.test" E2E_STUDENT_PASSWORD="..." npm run test:e2e
const STUDENT = {
  email: process.env["E2E_STUDENT_EMAIL"] ?? "",
  password: process.env["E2E_STUDENT_PASSWORD"] ?? "",
};

test.skip(
  !STUDENT.email || !STUDENT.password,
  "Set E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD to run the signed-in student tests.",
);

const shot = (page: import("@playwright/test").Page, name: string) =>
  page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });

async function signInStudent(page: import("@playwright/test").Page) {
  await page.goto("/auth");
  await shot(page, "01-landing");
  await expect(page.getByRole("heading", { name: /^sign in$/i })).toBeVisible();
  await page
    .getByLabel(/^email/i)
    .first()
    .fill(STUDENT.email);
  await page
    .getByLabel(/^password/i)
    .first()
    .fill(STUDENT.password);
  await shot(page, "02-auth-filled");
  await page
    .getByRole("button", { name: /^sign in$/i })
    .first()
    .click();
  await page
    .waitForURL((url) => !url.pathname.endsWith("/auth"), { timeout: 15_000 })
    .catch(() => {
      /* stay put; caller asserts */
    });
  await page.waitForLoadState("domcontentloaded");
  await shot(page, "03-post-signin");
}

test("student can sign in with email and password", async ({ page }) => {
  await signInStudent(page);
  await expect(page).not.toHaveURL(/\/auth$/);
  // Dashboard or landing post-auth
  const body = await page.locator("body").innerText();
  expect(body.length).toBeGreaterThan(50);
});

test.describe("Student authentication", () => {
  test("student can sign in with email and password", async ({ page }) => {
    await signInStudent(page);
    await expect(page).not.toHaveURL(/\/auth$/);
    // Dashboard or landing post-auth
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(50);
  });

});

