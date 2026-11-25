import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/oauth/crypto";
import { exchangeCodeForTokens, fetchMicrosoftProfile, readMicrosoftOAuthConfig } from "@/lib/oauth/microsoft";
import { safeRelativePath } from "@/lib/safe-redirect";
import { isUserEmailAllowed } from "@/lib/auth/allowed-users";

const STATE_COOKIE = "ms_oauth_state";

/**
 * Microsoft lands here with ?code=... after the account owner signs in and
 * accepts on Microsoft's own page. The code is exchanged for a refresh
 * token, which is encrypted and stored — see lib/oauth/crypto.ts — and
 * that is the only thing this app ever retains of the connection.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");

  const cookieStore = await cookies();
  const rawState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  let returnTo = "/invoices";
  try {
    if (rawState) returnTo = JSON.parse(rawState).returnTo || returnTo;
  } catch {
    // Malformed cookie falls back to /invoices below; the real failure is
    // reported regardless.
  }
  // Belt and suspenders: /connect already only ever stored a same-app path
  // here, but this is the value a redirect actually fires with, so it's
  // re-checked at the point of use rather than trusted from storage.
  returnTo = safeRelativePath(returnTo, "/invoices");

  const fail = (message: string) => NextResponse.redirect(new URL(`${returnTo}?microsoft_error=${encodeURIComponent(message)}`, url));

  // providerError is attacker-reachable text (anyone can hit this callback
  // URL with their own ?error_description=), displayed verbatim on the
  // invoice page — React escapes it so it can't inject markup, but it could
  // still read as a plausible, misleading message ("your account is
  // suspended, call …"). Logged for debugging, never shown as-is.
  if (providerError) {
    console.error("Microsoft OAuth callback error:", providerError);
    return fail("La connexion Microsoft a échoué. Réessayez.");
  }
  if (!code || !returnedState) return fail("Réponse Microsoft incomplète.");

  // The state Microsoft echoes back must match the one this app generated
  // and stored server-side in the cookie — otherwise a third party could
  // trick a signed-in user into connecting an account they did not choose
  // (a cross-site request forgery on the callback itself).
  let expectedCsrf: string | undefined;
  try {
    expectedCsrf = rawState ? JSON.parse(rawState).csrf : undefined;
  } catch {
    expectedCsrf = undefined;
  }
  if (!expectedCsrf || expectedCsrf !== returnedState) {
    return fail("Session de connexion expirée ou invalide, réessayez.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isUserEmailAllowed(user.email)) return NextResponse.redirect(new URL("/login", url));

  const config = readMicrosoftOAuthConfig();
  if (!config.ok) return fail("Connexion Microsoft non configurée côté serveur.");

  try {
    const tokens = await exchangeCodeForTokens(config.config, code);
    const profile = await fetchMicrosoftProfile(tokens.accessToken);

    await prisma.oAuthAccount.upsert({
      where: { provider_email: { provider: "microsoft", email: profile.email } },
      create: {
        provider: "microsoft",
        email: profile.email,
        displayName: profile.displayName,
        encryptedRefreshToken: encryptToken(tokens.refreshToken),
        connectedByEmail: user.email,
      },
      update: {
        displayName: profile.displayName,
        encryptedRefreshToken: encryptToken(tokens.refreshToken),
        connectedByEmail: user.email,
      },
    });

    return NextResponse.redirect(new URL(`${returnTo}?microsoft_connected=${encodeURIComponent(profile.email)}`, url));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Échec de la connexion Microsoft.");
  }
}
