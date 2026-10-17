import { expect, test } from "@playwright/test";

const authenticatedRoutes = [
  "/dashboard",
  "/profile",
  "/attendance/my",
  "/attendance",
  "/logs/submit",
  "/logs/my",
  "/logs/all",
  "/leave/my",
  "/leave/requests",
  "/clients",
  "/projects",
  "/projects/new",
  "/announcements",
  "/reports",
  "/settings",
  "/audit",
  "/workflow-templates",
  "/notifications",
];

for (const route of authenticatedRoutes) {
  test(`${route} requires an authenticated user`, async ({ page }) => {
    await page.goto(route);

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });
}
