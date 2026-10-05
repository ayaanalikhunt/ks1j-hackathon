import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

// On the hosted site, sign in through this site's own /__/auth/handler (Firebase Hosting serves it on every project domain).
// With the default firebaseapp.com domain, phone browsers block the cross-site storage the Google sign-in handshake needs,
// so the sign-in is silently dropped. Local development keeps the env value.
const host = typeof window !== "undefined" ? window.location?.hostname : undefined;
const authDomain = host && /\.(web\.app|firebaseapp\.com)$/.test(host) ? window.location.host : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

const fresh = getApps().length === 0;
const app = fresh
  ? initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    })
  : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

// For end-to-end testing only: NEXT_PUBLIC_USE_EMULATORS=true points the whole app at the local Firebase emulators, so a
// test can sign in, donate and approve without touching real data. It is never set for a real build.
if (fresh && process.env.NEXT_PUBLIC_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(getFunctions(app, "asia-south1"), "127.0.0.1", 5001);
}
