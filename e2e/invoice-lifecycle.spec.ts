import { expect, test } from "@playwright/test";
import { writesAllowed } from "./support";

// Creating an invoice consumes a value from the Postgres sequence that
// numbers the real ledger, so this never runs against production by
// default. Point E2E_BASE_URL at an instance backed by a throwaway
// database and set E2E_ALLOW_WRITES=1 to enable it.
test.describe("invoice lifecycle", () => {
  test.skip(!writesAllowed, "set E2E_ALLOW_WRITES=1 against a disposable database");

  test("creates a VAT invoice, numbers it from the sequence, then removes it", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.getByRole("button", { name: /Enregistrer le brouillon/ }).waitFor();
    await page.waitForTimeout(1500);

    // The preview must show the number the server will actually assign —
    // it used to show `N°{row count + 1}`, which matched nothing.
    const previewed = await page.getByText(/^Facture N°\d+$/).innerText();
    const previewedNumber = previewed.replace("Facture ", "");

    await page.locator('input[type="checkbox"]').first().check();
    await expect(page.getByText(/TVA \(\d+%\)/)).toBeVisible();

    await page.getByRole("button", { name: /Enregistrer le brouillon/ }).click();
    await expect(page.getByText(/Brouillon enregistré/)).toBeVisible();

    await page.goto("/invoices");
    await expect(page.getByText(previewedNumber, { exact: true })).toBeVisible();

    // And it must produce a real PDF, which VAT invoices previously could not.
    const href = await page
      .locator(`a[aria-label="Voir la facture ${previewedNumber}"]`)
      .getAttribute("href");
    await page.goto(href!);
    await page.getByRole("button", { name: /Télécharger le PDF/ }).waitFor();
    await page.waitForTimeout(1500);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Télécharger le PDF/ }).click();
    expect((await downloadPromise).suggestedFilename()).toContain("facture");

    await page.goto("/invoices");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator(`button[aria-label="Supprimer ${previewedNumber}"]`).click();
    await expect(page.getByText(previewedNumber, { exact: true })).toBeHidden();
  });
});
