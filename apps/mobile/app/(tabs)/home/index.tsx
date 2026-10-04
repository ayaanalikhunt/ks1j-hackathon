import { router } from "expo-router";
import { where } from "firebase/firestore";
import { MEMBER_EVENT_TEXT, timeAgo, type EventKind } from "@ks1j/shared";
import { Banner, Body, Btn, Card, FeatureCard, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/firestore";

export default function Home() {
  const { user, member, signOut } = useAuth();
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
      eyebrow="Jamaat services"
      title={member ? `Salaam, ${member.fullName.split(" ")[0]}` : "Welcome"}
      intro="Everything from the Jamaat in one place."
    >
      {!user && <Btn label="Sign in or create account" onPress={() => router.push("/sign-in")} />}

      {updates.length > 0 && <Heading>Updates for you</Heading>}
      {updates.map((e) => (
        <Card key={e.id}>
          <Body bold>
            {e.caseNumber ? `Case #${e.caseNumber}: ` : ""}
            {e.caseTitle}
          </Body>
          <Body>{MEMBER_EVENT_TEXT[e.kind as EventKind] ?? ""}</Body>
          <Body muted>{e.at?.toDate ? timeAgo(e.at.toDate()) : "just now"}</Body>
        </Card>
      ))}

      {tasks.length > 0 && <Heading>For you</Heading>}
      {tasks.map((l) => (
        <FeatureCard key={l.id} icon="coin" title="Agree your loan plan" desc="A monthly amount has been proposed for your education loan." href="/services/loans" />
      ))}

      <Heading>Announcements</Heading>
      {news.rows.length === 0 && <Banner>No announcements right now.</Banner>}
      {news.rows.slice(0, 3).map((n) => (
        <Card key={n.id}>
          <Body bold>{n.title}</Body>
          <Body muted>{n.body}</Body>
        </Card>
      ))}

      <Heading>Quick actions</Heading>
      <FeatureCard icon="heart" title="Apply for help" desc="Medical, education, ration or a scholarship." href="/services/apply" />
      <FeatureCard icon="shield" title="Support a Sadaat case" desc="Verified needs. Sehme Sadaat goes only here." href="/give/cases" />
      <FeatureCard icon="calculator" title="Pay Khums or Lawajam" desc="Calculate, pay and download receipts." href="/give" />
      {user && <Btn quiet label="Sign out" onPress={() => signOut()} />}
    </Screen>
  );
}
