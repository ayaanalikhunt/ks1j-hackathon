// Google's sign-in redirect (com.ks1j.app:/oauthredirect?code=...) is for lib/googleAuth, not a page.
// Left to the router it opens an unmatched route and can unmount the sign-in screen mid-attempt.
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (path.includes("oauthredirect")) return initial ? "/" : null;
  return path;
}
