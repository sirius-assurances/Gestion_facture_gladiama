import { expect, test } from "@playwright/test";
import { listInvoiceHrefs } from "./support";

// Locks in the regression that broke the app in production: invoices with
// VAT enabled declared one column boundary too few, jsPDF received a NaN
// coordinate and threw, so those invoices could be neither downloaded nor
// viewed. Nothing in the suite caught it, because nothing exercised the
// real PDF path. These tests only read — they never create invoices.
test.describe("invoice PDF", () => {
  test("every invoice can be downloaded as a real PDF", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const hrefs = await listInvoiceHrefs(page);
    expect(hrefs.length, "expected at least one invoice to exercise").toBeGreaterThan(0);

    for (const href of hrefs) {
      await page.goto(href);
      const downloadButton = page.getByRole("button", { name: /Télécharger le PDF/ });
      await downloadButton.waitFor();
      await page.waitForTimeout(1500);

      const invoiceNumber = await page.locator("h1").first().innerText();
      const hasTva = await page.locator('input[type="checkbox"]').first().isChecked();

      const downloadPromise = page.waitForEvent("download");
      await downloadButton.click();
      const download = await downloadPromise;

      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      const bytes = Buffer.concat(chunks);

      expect(bytes.subarray(0, 4).toString(), `${invoiceNumber} (TVA=${hasTva}) is not a PDF`).toBe("%PDF");
      // Not just "bigger than nothing": the header logo, stamp and footer
      // are fetched separately, and a PDF that lost them still opens — it
      // simply goes out to the client with plain text where the branding
      // should be. Measured: ~320KB with the images, ~3KB without.
      expect(bytes.length, `${invoiceNumber} looks like it lost its branding images`).toBeGreaterThan(100_000);
    }

    expect(pageErrors, "the page threw while generating a PDF").toEqual([]);
  });

  test("viewing an invoice opens a stored PDF over https", async ({ page, context }) => {
    const [href] = await listInvoiceHrefs(page);
    await page.goto(href);
    await page.getByRole("button", { name: /Visualiser la facture/ }).waitFor();
    await page.waitForTimeout(1500);

    // The tab must be sent to a real https URL: Safari cannot resolve a
    // blob: URL created in the opener's context, which rendered blank.
    const storageResponse = context.waitForEvent("response", (response) =>
      response.url().includes("/storage/v1/object/"),
    );
    await page.getByRole("button", { name: /Visualiser la facture/ }).click();
    const response = await storageResponse;

    expect(response.url()).toMatch(/^https:\/\//);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
  });
});
