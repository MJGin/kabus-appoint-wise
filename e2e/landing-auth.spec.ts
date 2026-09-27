import { expect, test, type Page } from "@playwright/test";

/** Wait for React hydration so onClick handlers are attached. */
async function settled(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => {
    const el = document.querySelector("main, header, [role='main']");
    return !!el;
  });
  // One frame after network idle is often still too early for hydration.
  await page.waitForTimeout(400);
}

test.describe("Landing page", () => {
  test("renders hero, School of Law branding, and CTA", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/KABU SlotIn|Kabarak University School of Law/i);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText("Kabarak University School of Law", { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
    await expect(page.getByRole("img", { name: /Kabarak University School of Law/i })).toBeVisible();
  });

  test("navigation anchors work", async ({ page, isMobile }) => {
    await page.goto("/");
    await settled(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const jump = async (hash: string) => {
      if (isMobile) {
        await expect(async () => {
          const menuBtn = page.getByRole("button", { name: /open menu/i });
          if (await menuBtn.count()) {
            await menuBtn.click();
          }
          await expect(page.locator(`#mobile-nav a[href="${hash}"]`)).toBeVisible({
            timeout: 1000,
          });
        }).toPass({ timeout: 8_000 });
        await page.locator(`#mobile-nav a[href="${hash}"]`).click();
      } else {
        await page.locator(`header a[href="${hash}"]`).first().click();
      }
      await expect(page.locator(hash)).toBeVisible();
    };

    await jump("#how");
    await jump("#security");
  });

  test("uses KABU SlotIn logo without trademark mark", async ({ page }) => {
    await page.goto("/");
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/™/);
    expect(body).toMatch(/KABU\s*SlotIn|Slot in\. Stay in sync\./i);
  });
});

test.describe("Auth page", () => {
  test("shows sign-in form and forgot password", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: /welcome back/i }).first()).toBeVisible();
    await expect(page.getByLabel(/registration number or staff email/i).first()).toBeVisible();
    await expect(page.getByLabel(/^password/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /forgot password/i }).first()).toBeVisible();
  });

  test("student signup validates LAW/ registration numbers", async ({ page }) => {
    await page.goto("/auth");
    await settled(page);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    await expect(async () => {
      await page.getByRole("button", { name: /create an account/i }).click();
      await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible({
        timeout: 1500,
      });
    }).toPass({ timeout: 10_000 });

    await page.locator('[role="tab"]', { hasText: "Student" }).click();
    await page.getByLabel("Full name").fill("Test Person");
    await page.getByLabel("Registration number").fill("ENG/M/001/2024/25");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByLabel("Confirm password").fill("Password123!");
    await page.getByRole("button", { name: /^create account$/i }).click();

    await expect(page.getByText(/LAW\/M\/|School of Law format/i).first()).toBeVisible();
  });

  test("rejects empty sign-in without leaking account existence", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("button", { name: /^sign in$/i }).first().click();
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toContain("no user found");
    expect(body).not.toContain("invalid user");
    expect(body).not.toContain("user not found");
  });
});

test.describe("Protected dashboard", () => {
  test("does not expose privileged panels when signed out", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/School Administrator/i)).toHaveCount(0);
    await expect(page.getByText(/technical activity log/i)).toHaveCount(0);
  });
});

test.describe("Security headers", () => {
  test("sends hardening headers", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    expect(headers["x-frame-options"] ?? "").toMatch(/DENY|SAMEORIGIN/i);
    expect(headers["x-content-type-options"] ?? "").toMatch(/nosniff/i);
    expect(headers["referrer-policy"] ?? "").toMatch(/no-referrer|same-origin|strict-origin/i);
    expect(headers["content-security-policy"] ?? "").toContain("frame-ancestors");
    expect(headers["content-security-policy"] ?? "").toContain("default-src");
  });

  test("chapel is documented as blocked on landing", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Chapel/i).first()).toBeVisible();
  });
});

test.describe("Responsive layout", () => {
  test("hero and primary CTAs fit the viewport", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /sign in to your account/i }).first();
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    const viewport = page.viewportSize();
    if (box && viewport) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 2);
    }
  });

  test("no horizontal overflow on landing", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("auth form is usable in current viewport", async ({ page }) => {
    await page.goto("/auth");
    const password = page.getByLabel(/^password/i).first();
    await expect(password).toBeVisible();
    const box = await password.boundingBox();
    const viewport = page.viewportSize();
    if (box && viewport) {
      expect(box.width).toBeGreaterThan(120);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 2);
    }
  });
});
