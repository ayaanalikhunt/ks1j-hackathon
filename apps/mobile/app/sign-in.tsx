import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Banner, Btn, Chip, Field, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useGoogleSignIn } from "@/lib/googleAuth";
import { useLang } from "@/lib/i18n";
import { LanguagePicker } from "@/components/LanguagePicker";

export default function SignIn() {
  const { signIn, signUp, user } = useAuth();
  const g = useGoogleSignIn();
  const { t } = useLang();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Signing in with Google ends here, once Firebase has the member.
  useEffect(() => {
    if (user) {
      router.dismissAll?.();
      router.replace("/");
    }
  }, [user]);

  async function go() {
    setErr(null);
    setBusy(true);
    try {
      if (mode === "in") await signIn(email.trim(), password);
      else await signUp(name.trim(), email.trim(), password);
      router.dismissAll?.();
      router.replace("/");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen eyebrow={t("signin.eyebrow")} title={mode === "in" ? t("signin.titleIn") : t("signin.titleUp")} intro={t("signin.intro")}>
      <LanguagePicker />
      {mode === "up" && <Field label={t("common.fullName")} value={name} onChangeText={setName} autoCapitalize="words" />}
      <Field label={t("common.email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label={t("common.password")} value={password} onChangeText={setPassword} secureTextEntry />
      {err && <Banner error>{err}</Banner>}
      <Btn label={mode === "in" ? t("common.signIn") : t("common.createAccount")} onPress={go} disabled={busy || !email || !password || (mode === "up" && !name)} />
      <Btn quiet label={t("common.continueGoogle")} onPress={() => g.signIn((e) => setErr(e.message))} disabled={!g.ready || busy} />
      <Chip label={mode === "in" ? t("signin.newHere") : t("signin.haveAccount")} onPress={() => setMode(mode === "in" ? "up" : "in")} />
    </Screen>
  );
}
