import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { buildAuthorizeUrl, readMicrosoftOAuthConfig } from "@/lib/oauth/microsoft";

/** Name kept in sync with the one the callback route reads back. */
const STATE_COOKIE = "ms_oauth_state";

/**
 * "Connecter un compte Microsoft" lands here, which immediately redirects to
 * Microsoft's own login page — this app never shows a password field for
 * this flow, nor stores one.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // Signed into this app is required before handing out a Microsoft login
  // screen; otherwise anyone with the link could connect a mailbox nobody
  // here authorised.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url));

  const config = readMicrosoftOAuthConfig();
  if (!config.ok) {
    const message = `Connexion Microsoft non configurée. Variables manquantes : ${config.missing.join(", ")}.`;
    return NextResponse.redirect(new URL(`/invoices?microsoft_error=${encodeURIComponent(message)}`, url));
  }

  // returnTo: where to send the browser back after Microsoft redirects here
  // with a code — typically the invoice the sender was on.
  const returnTo = url.searchParams.get("returnTo") || "/invoices";
  const csrf = randomBytes(24).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, JSON.stringify({ csrf, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildAuthorizeUrl(config.config, csrf));
}
