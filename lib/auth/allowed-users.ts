/**
 * Supabase Auth alone only proves "this is a real, confirmed account" — it
 * says nothing about who's allowed to use this app. If public sign-up is
 * ever left enabled on the Supabase project (the default for a new
 * project), anyone who signs up and confirms their email passes
 * `auth.getUser()` and reaches every client/invoice and the director's
 * connected mailbox. This is the second, independent check: the email must
 * also be on a short list this app controls.
 *
 * ALLOWED_USER_EMAILS is intentionally permissive when unset — admins must
 * opt in by setting it, rather than this change locking everyone out the
 * moment it ships before the variable exists in Vercel.
 */
export function isUserEmailAllowed(email: string | null | undefined): boolean {
  const raw = process.env.ALLOWED_USER_EMAILS?.trim();
  if (!raw) return true;
  if (!email) return false;

  const allowed = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
