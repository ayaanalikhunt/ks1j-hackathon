import type { ImageSourcePropType } from "react-native";
import type { MarjaId } from "@ks1j/shared";

/** The portraits ship inside the app, so they show without a network. */
export const MARJA_PHOTOS: Record<MarjaId, ImageSourcePropType> = {
  sistani: require("../assets/marjas/sistani.jpg"),
  khamenei: require("../assets/marjas/khamenei.jpg"),
  makarem: require("../assets/marjas/makarem.jpg"),
};

const WEB = "https://ks1j-8a2e3.web.app";

/**
 * Where each page the guide can open lives in the app. The server only ever names a registry id, never a free-form
 * address, so an unknown id simply falls back to the website page the server sent.
 *   screen: an app screen    stay: the guide handles it itself    web: a page that exists only on the website
 */
export type Dest = { screen: string } | { stay: "select" | "compare" | MarjaId | "here" } | { web: string };

export const DESTINATIONS: Record<string, Dest> = {
  home: { screen: "/home" },
  ask: { stay: "select" },
  ask_sistani: { stay: "sistani" },
  ask_khamenei: { stay: "khamenei" },
  ask_makarem: { stay: "makarem" },
  ask_compare: { stay: "compare" },
  cases: { screen: "/give/cases" },
  donate: { screen: "/give/donate" },
  transparency: { web: `${WEB}/transparency/` },
  contact: { web: `${WEB}/contact/` },
  login: { screen: "/sign-in" },
  get_app: { stay: "here" },
  member_app: { screen: "/home" },
  give: { screen: "/give" },
  khums: { screen: "/give/khums" },
  my_donations: { screen: "/give/donations" },
};

/** Urdu, Arabic and Persian read right to left. */
export const isRtlText = (s: string) => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(s);
