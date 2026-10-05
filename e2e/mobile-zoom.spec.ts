import { expect, test } from "@playwright/test";
import { AUTH_STATE } from "./support";

/**
 * Safari on iOS zooms the whole page in when a form control whose text is
 * smaller than 16px takes focus, and never zooms back out — the page stays
 * magnified until the user pinches it back. It made the app unusable on a
 * real iPhone: every control sat at 11-14px, so the very first tap on the
 * login field left the viewport stuck.
 *
 * globals.css lifts controls to 16px under `(hover: none) and (pointer:
 * coarse)`. A styling rule that specific is easy to drop by accident, so it
 * is pinned here instead of trusted.
 */
const ROUTES = ["/login", "/invoices", "/clients", "/invoices/new"];

for (const route of ROUTES) {
  test(`form controls on ${route} are at least 16px on touch devices`, async ({ browser }) => {
    // Own context: the media query only matches with mobile emulation, which
    // the shared `signed-in` project does not use.
    const context = await browser.newContext({
      storageState: AUTH_STATE,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    // Supabase keeps the session in cookies, and a signed-in visitor is
    // redirected off /login to the dashboard — which has no form controls at
    // all, so the test would wait for a field that never comes.
    if (route === "/login") await context.clearCookies();
    const page = await context.newPage();

    await page.goto(route);
    await page.locator("input, select, textarea").first().waitFor();

    const tooSmall = await page.locator("input, select, textarea").evaluateAll((controls) =>
      controls
        .filter((el) => el.getBoundingClientRect().height > 0)
        .map((el) => ({
          control: `<${el.tagName.toLowerCase()}${el.getAttribute("type") ? ` type=${el.getAttribute("type")}` : ""}>`,
          size: parseFloat(getComputedStyle(el).fontSize),
        }))
        .filter((c) => c.size < 16),
    );

    expect(tooSmall, "controls below 16px make iOS Safari zoom in and stay zoomed").toEqual([]);

    await context.close();
  });
}
