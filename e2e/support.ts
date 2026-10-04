import { expect, type Page } from "@playwright/test";

export const E2E_EMAIL = process.env.E2E_EMAIL ?? "";
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "";

/**
 * Session captured once by auth.setup.ts and reused by every spec. Kept as
 * a plain relative path: using import.meta here marks the module ESM, which
 * breaks Playwright's loader with a require-cycle error.
 */
export const AUTH_STATE = "e2e/.auth/user.json";

/**
 * Writing tests create real invoices, and invoice numbers come from a
 * Postgres sequence — running them against the production project would
 * burn numbers in the real ledger. They only run when explicitly allowed.
 */
export const writesAllowed = process.env.E2E_ALLOW_WRITES === "1";

export async function signIn(page: Page) {
  if (!E2E_EMAIL || !E2E_PASSWORD) throw new Error("Set E2E_EMAIL and E2E_PASSWORD before running the E2E suite.");

  await page.goto("/login");
  const email = page.locator('input[type="email"]');
  const password = page.locator('input[type="password"]');
  const submit = page.locator('button[type="submit"]');
  await email.waitFor();
  await expect(submit).toBeEnabled();

  // The React submit handler only exists once the page has hydrated, and in
  // dev that can take a while — clicking earlier does nothing at all (the
  // native submit is prevented but no request is sent). Rather than guess a
  // delay, submit and retry until the app actually moves off /login, or
  // until it tells us the credentials were refused.
  for (let attempt = 1; attempt <= 6; attempt++) {
    await email.fill(E2E_EMAIL);
    await password.fill(E2E_PASSWORD);
    await submit.click();

    try {
      await page.waitForFunction(() => !location.pathname.startsWith("/login"), undefined, { timeout: 10_000 });
      return;
    } catch {
      const refusal = await page
        .locator("p", { hasText: /incorrect|invalide|erreur/i })
        .first()
        .innerText()
        .catch(() => "");
      if (refusal) throw new Error(`Sign-in refused by the app: ${refusal}`);
    }
  }

  throw new Error("Sign-in never left /login and the app reported no error (the page may not have hydrated).");
}

/** Hrefs of every invoice currently listed, newest first. */
export async function listInvoiceHrefs(page: Page) {
  await page.goto("/invoices");
  await page.locator('a[aria-label^="Voir la facture"]').first().waitFor();
  return page.locator('a[aria-label^="Voir la facture"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? ""),
  );
}
