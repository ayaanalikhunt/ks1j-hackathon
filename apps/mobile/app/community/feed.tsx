import { CommunityGate, useMyProfile } from "@/components/CommunityGate";
import { PostList } from "@/components/PostList";
import { useLang } from "@/lib/i18n";
import { Screen } from "@/components/ui";

function Inner() {
  const { t } = useLang();
  const me = useMyProfile();
  return (
    <Screen eyebrow={t("cFeed.1")} title={t("cFeed.2")} intro={t("cFeed.3")}>
      <PostList authorName={me?.fullName ?? ""} />
    </Screen>
  );
}

export default function Feed() {
  const { t } = useLang();
  return (
    <CommunityGate title={t("cFeed.2")}>
      <Inner />
    </CommunityGate>
  );
}
