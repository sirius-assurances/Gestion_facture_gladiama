import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isUserEmailAllowed } from "@/lib/auth/allowed-users";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase Auth environment variables are missing.");

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  // A confirmed Supabase account only proves it's a real, confirmed email —
  // not that this app should trust it. If Supabase's own public sign-up is
  // ever left on (the default for a new project), this is what stops a
  // stranger's new account from reaching anything past this point. See
  // lib/auth/allowed-users.ts.
  const isAllowed = Boolean(user) && isUserEmailAllowed(user?.email);
  const isLoginRoute = request.nextUrl.pathname === "/login";

  if (!isAllowed && !isLoginRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAllowed && isLoginRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  // manifest.webmanifest and icons/ must stay reachable without a session:
  // the browser (and iOS/Android's install flow) fetches them unauthenticated
  // when deciding whether the app is installable, before anyone has logged in.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|icons/|manifest.webmanifest).*)"],
};