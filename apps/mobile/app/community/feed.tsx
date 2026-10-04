import { CommunityGate, useMyProfile } from "@/components/CommunityGate";
import { PostList } from "@/components/PostList";
import { Screen } from "@/components/ui";
import { useLang } from "@/lib/i18n";

function Inner() {
  const me = useMyProfile();
  const { t } = useLang();
  return (
    <Screen eyebrow={t("learn.community")} title={t("learn.feed.t")} intro={t("feed.intro")}>
      <PostList authorName={me?.fullName ?? ""} />
    </Screen>
  );
}

export default function Feed() {
  const { t } = useLang();
  return (
    <CommunityGate title={t("learn.feed.t")}>
      <Inner />
    </CommunityGate>
  );
}
