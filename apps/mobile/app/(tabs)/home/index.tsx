import { router } from "expo-router";
import { where } from "firebase/firestore";
import { timeAgo, type EventKind } from "@ks1j/shared";
import { Banner, Body, Btn, Card, FeatureCard, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/firestore";
import { useLang } from "@/lib/i18n";

export default function Home() {
  const { user, member, signOut } = useAuth();
  const { t } = useLang();
  const uid = user?.uid ?? "";
  const events = useCollection(user ? "caseEvents" : null, [where("applicantId", "==", uid)], [uid]);
  const loans = useCollection(user ? "loans" : null, [where("borrowerId", "==", uid)], [uid]);
  const news = useCollection("announcements");

  // "Updates for you": every step taken on the member's own requests, newest first.
  const updates = [...events.rows]
    .sort((a, b) => (b.at?.seconds ?? 9e9) - (a.at?.seconds ?? 9e9))
    .slice(0, 6);
  const tasks = loans.rows.filter((l) => l.status === "emi_pending_agreement" && l.familyEmi !== l.trusteeEmi);

  return (
    <Screen
      hero
      eyebrow={t("home.eyebrow")}
      title={member ? t("home.salaam", { name: member.fullName.split(" ")[0] }) : t("home.welcome")}
      intro={t("home.intro")}
    >
      {!user && <Btn label={t("home.signInOrCreate")} onPress={() => router.push("/sign-in")} />}

      {updates.length > 0 && <Heading>{t("home.updates")}</Heading>}
      {updates.map((e) => (
        <Card key={e.id}>
          <Body bold>
            {e.caseNumber ? `Case #${e.caseNumber}: ` : ""}
            {e.caseTitle}
          </Body>
          <Body>{t(`ev.${e.kind as EventKind}` as never)}</Body>
          <Body muted>{e.at?.toDate ? timeAgo(e.at.toDate()) : "just now"}</Body>
        </Card>
      ))}

      {tasks.length > 0 && <Heading>{t("home.forYou")}</Heading>}
      {tasks.map((l) => (
        <FeatureCard key={l.id} icon="coin" title={t("home.agreePlan.t")} desc={t("home.agreePlan.d")} href="/services/loans" />
      ))}

      <Heading>{t("home.announcements")}</Heading>
      {news.rows.length === 0 && <Banner>{t("home.noAnnouncements")}</Banner>}
      {news.rows.slice(0, 3).map((n) => (
        <Card key={n.id}>
          <Body bold>{n.title}</Body>
          <Body muted>{n.body}</Body>
        </Card>
      ))}

      <Heading>{t("home.quick")}</Heading>
      <FeatureCard icon="heart" title={t("home.qa.apply.t")} desc={t("home.qa.apply.d")} href="/services/apply" />
      <FeatureCard icon="shield" title={t("home.qa.sadaat.t")} desc={t("home.qa.sadaat.d")} href="/give/cases" />
      <FeatureCard icon="calculator" title={t("home.qa.pay.t")} desc={t("home.qa.pay.d")} href="/give" />
      {user && <Btn quiet label={t("common.signOut")} onPress={() => signOut()} />}
    </Screen>
  );
}
