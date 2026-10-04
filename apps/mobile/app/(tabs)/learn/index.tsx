import { where } from "firebase/firestore";
import { Linking } from "react-native";
import { FeatureCard, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/firestore";
import { useLang } from "@/lib/i18n";

export default function Learn() {
  const { user } = useAuth();
  const { t } = useLang();
  const uid = user?.uid ?? "";
  const pending = useCollection(user ? "communityConnections" : null, [where("toId", "==", uid), where("status", "==", "pending")], [uid]);
  return (
    <Screen hero eyebrow={t("learn.eyebrow")} title={t("learn.title")} intro={t("learn.intro")}>
      <FeatureCard icon="help" title={t("learn.helpdesk.t")} desc={t("learn.helpdesk.d")} href="/learn/helpdesk" />
      <Heading>{t("learn.community")}</Heading>
      <FeatureCard icon="news" title={t("learn.feed.t")} desc={t("learn.feed.d")} href="/community/feed" />
      <FeatureCard icon="address-book" title={t("learn.directory.t")} desc={t("learn.directory.d")} href="/community/directory" />
      <FeatureCard icon="star" title={t("learn.mentors.t")} desc={t("learn.mentors.d")} href="/community/directory?mentors=1" />
      <FeatureCard icon="briefcase" title={t("learn.jobs.t")} desc={t("learn.jobs.d")} href="/community/opportunities" />
      <FeatureCard icon="messages" title={t("learn.messages.t")} desc={t("learn.messages.d")} href="/community/messages" badge={pending.rows.length} />
      <FeatureCard icon="address-book" title={t("learn.groups.t")} desc={t("learn.groups.d")} href="/community/groups" />
      <FeatureCard icon="user" title={t("learn.profile.t")} desc={t("learn.profile.d")} href="/community/profile" />
      <Heading>{t("learn.careers")}</Heading>
      <FeatureCard icon="external" title={t("learn.leap.t")} desc={t("learn.leap.d")} onPress={() => Linking.openURL("https://ksijleap.com/")} />
    </Screen>
  );
}
