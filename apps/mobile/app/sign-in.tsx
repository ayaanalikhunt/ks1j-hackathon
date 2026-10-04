import { router } from "expo-router";
import { useState } from "react";
import { Banner, Btn, Chip, Field, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function SignIn() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <Screen eyebrow="Welcome" title={mode === "in" ? "Sign in" : "Create account"} intro="Use your email and a password.">
      {mode === "up" && <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {err && <Banner error>{err}</Banner>}
      <Btn label={mode === "in" ? "Sign in" : "Create account"} onPress={go} disabled={busy || !email || !password || (mode === "up" && !name)} />
      <Chip label={mode === "in" ? "New here? Create an account" : "Have an account? Sign in"} onPress={() => setMode(mode === "in" ? "up" : "in")} />
    </Screen>
  );
}
