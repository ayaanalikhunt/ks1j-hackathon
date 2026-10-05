import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
// @ts-expect-error getReactNativePersistence is exported by the React Native build of firebase/auth
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

// On the hosted site, sign in through this site's own /__/auth/handler (Firebase Hosting serves it on every project domain).
// With the default firebaseapp.com domain, phone browsers block the cross-site storage the Google sign-in handshake needs,
// so the sign-in is silently dropped. Local development keeps the env value.
const host = typeof window !== "undefined" ? window.location?.hostname : undefined;
const authDomain = host && /\.(web\.app|firebaseapp\.com)$/.test(host) ? window.location.host : process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;

const fresh = getApps().length === 0;
const app = fresh
  ? initializeApp({
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    })
  : getApp();

export const auth =
  fresh && Platform.OS !== "web"
    ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
    : getAuth(app);
export const db = getFirestore(app);
