import { CommunityGate, useMyProfile } from "@/components/CommunityGate";
import { PostList } from "@/components/PostList";
import { Screen } from "@/components/ui";

function Inner() {
  const me = useMyProfile();
  return (
    <Screen eyebrow="Community" title="Feed" intro="Keep it kind and useful. Staff may remove posts that break that.">
      <PostList authorName={me?.fullName ?? ""} />
    </Screen>
  );
}

export default function Feed() {
  return (
    <CommunityGate title="Feed">
      <Inner />
    </CommunityGate>
  );
}
