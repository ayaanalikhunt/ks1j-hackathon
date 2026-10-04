import { router } from "expo-router";
import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { Banner, Btn, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** Wraps screens that need a signed-in member. */
export function RequireAuth({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const { t: tr } = useLang();
  const { user, loading } = useAuth();
  if (loading) return <Screen eyebrow={eyebrow} title={title} />;
  if (!user)
    return (
      <Screen eyebrow={eyebrow} title={title}>
        <Banner>{tr("authUi.2")}</Banner>
        <Btn label={tr("authUi.1")} onPress={() => router.push("/sign-in")} />
      </Screen>
    );
  return <>{children}</>;
}
