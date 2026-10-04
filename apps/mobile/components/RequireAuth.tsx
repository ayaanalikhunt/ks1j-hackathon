import { router } from "expo-router";
import type { ReactNode } from "react";
import { Banner, Btn, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** Wraps screens that need a signed-in member. */
export function RequireAuth({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Screen eyebrow={eyebrow} title={title} />;
  if (!user)
    return (
      <Screen eyebrow={eyebrow} title={title}>
        <Banner>Please sign in to continue.</Banner>
        <Btn label="Sign in" onPress={() => router.push("/sign-in")} />
      </Screen>
    );
  return <>{children}</>;
}
