import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // CI uses a deliberately fake Supabase URL/key. Stub the public read so the
  // login page can render its connected state without any real backend access.
  await page.route("**/rest/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
});

test("login page renders the credential form", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByText("Sign in to your account")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeEnabled();
});

test("unauthenticated users are redirected from protected pages to login", async ({ page }) => {
  await page.goto("/projects");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});
