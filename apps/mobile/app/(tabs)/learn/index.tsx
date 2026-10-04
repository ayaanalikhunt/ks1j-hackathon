import { where } from "firebase/firestore";
import { Linking } from "react-native";
import { FeatureCard, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/firestore";

export default function Learn() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const pending = useCollection(user ? "communityConnections" : null, [where("toId", "==", uid), where("status", "==", "pending")], [uid]);
  return (
    <Screen eyebrow="Learn" title="Learn and connect" intro="Ask the helpdesk, meet the community and find careers support.">
      <FeatureCard icon="help" title="Helpdesk" desc="Answers from approved sources only" href="/learn/helpdesk" />
      <Heading>Community</Heading>
      <FeatureCard icon="news" title="Feed" desc="What members are sharing" href="/community/feed" />
      <FeatureCard icon="address-book" title="Directory" desc="Find members by skill or city" href="/community/directory" />
      <FeatureCard icon="star" title="Mentorship Circle" desc="Members who offer guidance" href="/community/directory?mentors=1" />
      <FeatureCard icon="briefcase" title="Opportunities" desc="Jobs, internships and referrals" href="/community/opportunities" />
      <FeatureCard icon="messages" title="Messages" desc="Chats and requests" href="/community/messages" badge={pending.rows.length} />
      <FeatureCard icon="address-book" title="Groups" desc="Profession and interest circles" href="/community/groups" />
      <FeatureCard icon="user" title="My community profile" desc="What others see about you" href="/community/profile" />
      <Heading>Careers</Heading>
      <FeatureCard icon="external" title="LEAP careers programme" desc="Opens ksijleap.com in your browser" onPress={() => Linking.openURL("https://ksijleap.com/")} />
    </Screen>
  );
}
