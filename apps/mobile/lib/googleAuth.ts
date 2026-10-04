import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useAuth } from "./auth";

// Finishes the browser round trip when the app is reopened by the redirect.
WebBrowser.maybeCompleteAuthSession();

/**
 * "Continue with Google".
 * - In the browser version of the app: a Google popup.
 * - On Android: Google's sign-in page opens, returns an ID token, and Firebase signs the member in with it.
 * Either way a first-time Google user gets a normal member record (never a staff role).
 */
export function useGoogleSignIn() {
  const { googleWeb, googleToken } = useAuth();
  const [request, response, prompt] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });
  const onError = useRef<((e: Error) => void) | null>(null);

  useEffect(() => {
    if (response?.type === "success") {
      const idToken = response.params.id_token;
      if (idToken) googleToken(idToken).catch((e) => onError.current?.(e as Error));
    } else if (response?.type === "error") {
      onError.current?.(new Error(response.error?.message ?? "Google sign-in did not complete."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return {
    ready: Platform.OS === "web" || !!request,
    async signIn(handleError: (e: Error) => void) {
      onError.current = handleError;
      try {
        if (Platform.OS === "web") await googleWeb();
        else await prompt();
      } catch (e) {
        handleError(e as Error);
      }
    },
  };
}
