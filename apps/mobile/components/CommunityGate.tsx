import { router } from "expo-router";
import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { Banner, Btn, Screen } from "@/components/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useDocument } from "@/lib/firestore";

export interface Profile {
  fullName: string;
  headline?: string;
  profession?: string;
  industry?: string;
  city?: string;
  skills?: string[];
  bio?: string;
  listed?: boolean;
  openToWork?: boolean;
  isMentor?: boolean;
  mentorAreas?: string[];
  mentorNote?: string;
}

export function useMyProfile() {
  const { user } = useAuth();
  return useDocument<Profile>(user ? `communityProfiles/${user.uid}` : null);
}

/** Community is opt-in: with no profile row, show only a join prompt. */
export function CommunityGate({ eyebrow = "Community", title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  const { t: tr } = useLang();
  const profile = useMyProfile();
  return (
    <RequireAuth eyebrow={eyebrow} title={title}>
      {profile === undefined ? (
        <Screen eyebrow={eyebrow} title={title} />
      ) : profile === null ? (
        <Screen eyebrow={eyebrow} title={tr("gateUi.1")} intro={tr("gateUi.2")}>
          <Banner>{tr("gateUi.4")}</Banner>
          <Btn label={tr("gateUi.3")} onPress={() => router.push("/community/profile")} />
        </Screen>
      ) : (
        <>{children}</>
      )}
    </RequireAuth>
  );
}
