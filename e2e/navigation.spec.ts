import { expect, test } from "@playwright/test";

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects protected routes to the login page", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("protected routes", () => {
  test("the dashboard shows real figures", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Bonjour/ }).first()).toBeVisible();
    // The dashboard aggregates server-side; it should show an actual amount
    // rather than staying on its empty placeholder.
    await expect(page.getByText(/FCFA/).first()).toBeVisible();
  });

  test("lists clients and invoices with pagination", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.getByRole("heading", { name: "Toutes les factures" })).toBeVisible();
    await expect(page.getByText(/Page \d+ sur \d+/)).toBeVisible();

    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "Vos clients" })).toBeVisible();
    await expect(page.getByText(/Page \d+ sur \d+/)).toBeVisible();
  });

  test("filtering invoices by status keeps the page usable", async ({ page }) => {
    await page.goto("/invoices");
    await page.getByRole("button", { name: "Payée", exact: true }).click();
    await expect(page.getByText(/Page \d+ sur \d+/)).toBeVisible();
  });
});
