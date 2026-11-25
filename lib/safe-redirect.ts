/**
 * Only ever returns a same-origin relative path. `next=`/`returnTo=` values
 * come straight from a URL a victim could be sent — `//evil.example` and
 * `https://evil.example` both parse as "redirect elsewhere" to a browser,
 * and the second one wouldn't even look wrong in the address bar since the
 * real login/Microsoft step happens first. Reject anything that isn't a
 * single-slash path on this app, and fall back instead.
 */
export function safeRelativePath(candidate: string | null | undefined, fallback: string): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  try {
    const resolved = new URL(candidate, "http://local.invalid");
    if (resolved.origin !== "http://local.invalid") return fallback;
  } catch {
    return fallback;
  }
  return candidate;
}
