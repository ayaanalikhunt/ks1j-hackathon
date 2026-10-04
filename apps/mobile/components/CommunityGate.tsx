import { router } from "expo-router";
import type { ReactNode } from "react";
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
  const profile = useMyProfile();
  return (
    <RequireAuth eyebrow={eyebrow} title={title}>
      {profile === undefined ? (
        <Screen eyebrow={eyebrow} title={title} />
      ) : profile === null ? (
        <Screen eyebrow={eyebrow} title="Join the community" intro="Create a short profile to meet other members. Phone numbers are never shown.">
          <Banner>You need a community profile to continue.</Banner>
          <Btn label="Create my profile" onPress={() => router.push("/community/profile")} />
        </Screen>
      ) : (
        <>{children}</>
      )}
    </RequireAuth>
  );
}
