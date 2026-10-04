import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, updateDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { LANGS, isRtl, translate, type Lang, type MessageKey } from "@ks1j/shared";
import { useAuth } from "./auth";
import { db } from "./firebase";

interface Ctx {
  lang: Lang;
  rtl: boolean;
  setLang(l: Lang): Promise<void>;
  t(key: MessageKey, vars?: Record<string, string | number>): string;
}

const LangCtx = createContext<Ctx | null>(null);
const KEY = "ks1j-lang";
const valid = (x: unknown): x is Lang => typeof x === "string" && (LANGS as readonly string[]).includes(x);

/**
 * The app language. A signed-in member's choice is kept on their account so it follows them to a new phone; on this phone it is
 * also kept locally so the sign-in screen is already in their language. Notices written by the office are never translated.
 */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const { user, member } = useAuth();
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (valid(v)) setLangState(v);
      })
      .catch(() => {});
  }, []);

  // The account's saved choice wins once it is known.
  const saved = (member as { language?: unknown } | null)?.language;
  useEffect(() => {
    if (valid(saved)) setLangState(saved);
  }, [saved]);

  const value: Ctx = {
    lang,
    rtl: isRtl(lang),
    async setLang(l) {
      setLangState(l);
      AsyncStorage.setItem(KEY, l).catch(() => {});
      if (user) await updateDoc(doc(db, "members", user.uid), { language: l }).catch(() => {});
    },
    t: (key, vars) => translate(lang, key, vars),
  };
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const c = useContext(LangCtx);
  if (!c) throw new Error("useLang outside LangProvider");
  return c;
}
