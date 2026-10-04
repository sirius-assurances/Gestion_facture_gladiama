import { test as setup } from "@playwright/test";
import { AUTH_STATE, signIn } from "./support";

// Signing in once and reusing the session matters: logging in per test
// tripped Supabase's auth rate limiting, which failed the whole suite for
// reasons that had nothing to do with the app.
setup("authenticate", async ({ page }) => {
  await signIn(page);
  await page.context().storageState({ path: AUTH_STATE });
});
