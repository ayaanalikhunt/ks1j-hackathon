import { exchangeCodeAsync } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";
import { useAuth } from "./auth";

// Finishes the browser round trip when the app is reopened by the redirect.
WebBrowser.maybeCompleteAuthSession();

/** How long to wait for Google's redirect after Android reports the browser closed. */
const REDIRECT_GRACE_MS = 2500;

/**
 * "Continue with Google".
 * - In the browser version of the app: a Google popup.
 * - On Android: Google's sign-in page opens, returns a code, we swap it for an ID token, and Firebase signs the member in with it.
 * Either way a first-time Google user gets a normal member record (never a staff role).
 *
 * Android does the round trip itself rather than through the hook's `response`: expo-web-browser races
 * "app became active" against the redirect URL, and when "active" wins it reports `dismiss` and drops the URL.
 * We listen for the redirect ourselves for the whole attempt and finish the sign-in with it whichever wins.
 */
export function useGoogleSignIn() {
  const { googleWeb, googleToken } = useAuth();
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const [request, , prompt] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: clientId,
    // We exchange the code below; a second exchange of the same one-time code would fail.
    shouldAutoExchangeCode: false,
  });

  async function android() {
    if (!request) throw new Error("Google sign-in is still loading. Try again in a moment.");
    let redirectUrl: string | null = null;
    let onRedirect: (() => void) | null = null;
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (url.startsWith(request.redirectUri)) {
        redirectUrl = url;
        onRedirect?.();
      }
    });
    try {
      let result = await prompt();
      if (result.type !== "success") {
        if (!redirectUrl) {
          await new Promise<void>((resolve) => {
            onRedirect = resolve;
            setTimeout(resolve, REDIRECT_GRACE_MS);
          });
        }
        if (!redirectUrl) {
          if (result.type === "error") throw new Error(result.error?.message ?? "Google sign-in did not complete.");
          throw new Error("Google sign-in was closed before it finished. Please try again.");
        }
        result = request.parseReturnUrl(redirectUrl);
        if (result.type !== "success") throw new Error(result.type === "error" ? (result.error?.message ?? "Google sign-in did not complete.") : "Google sign-in did not complete.");
      }
      const code = result.params.code;
      if (!code) throw new Error("Google did not return a sign-in code.");
      const tokens = await exchangeCodeAsync(
        { clientId: clientId ?? "", redirectUri: request.redirectUri, code, extraParams: { code_verifier: request.codeVerifier ?? "" } },
        Google.discovery,
      );
      if (!tokens.idToken) throw new Error("Google did not return an ID token.");
      await googleToken(tokens.idToken);
    } finally {
      sub.remove();
    }
  }

  return {
    ready: Platform.OS === "web" || !!request,
    async signIn(handleError: (e: Error) => void) {
      try {
        if (Platform.OS === "web") await googleWeb();
        else await android();
      } catch (e) {
        handleError(e as Error);
      }
    },
  };
}
