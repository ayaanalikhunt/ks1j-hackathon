import { router } from "expo-router";
import { where } from "firebase/firestore";
import { Banner, Btn, Card, FeatureCard, Heading, Body, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/firestore";

export default function Home() {
  const { user, member, signOut } = useAuth();
  const uid = user?.uid ?? "";
  const cases = useCollection(user ? "cases" : null, [where("applicantId", "==", uid)], [uid]);
  const loans = useCollection(user ? "loans" : null, [where("borrowerId", "==", uid)], [uid]);
  const news = useCollection("announcements");
  const open = cases.rows.filter((c) => !["disbursed", "declined"].includes(c.status)).length;

  return (
    <Screen
      eyebrow="Jamaat services"
      title={member ? `Salaam, ${member.fullName.split(" ")[0]}` : "Welcome"}
      intro="Help, giving and learning for our community, in one place."
    >
      {!user ? (
        <Btn label="Sign in or create account" onPress={() => router.push("/sign-in")} />
      ) : (
        <Card>
          <Heading>Your summary</Heading>
          <Body>Open applications: {open}</Body>
          <Body>Loans: {loans.rows.length}</Body>
          <Btn quiet label="Sign out" onPress={() => signOut()} />
        </Card>
      )}
      {news.rows.slice(0, 2).map((n) => (
        <Card key={n.id}>
          <Body bold>{n.title}</Body>
          <Body muted>{n.body}</Body>
        </Card>
      ))}
      {news.rows.length === 0 && <Banner>No announcements right now.</Banner>}
      <FeatureCard icon="heart" title="Services" desc="Ask for help, loans, receipts" href="/services" />
      <FeatureCard icon="gift" title="Give" desc="Khums, Lawajam and open cases" href="/give" />
      <FeatureCard icon="book" title="Learn" desc="Helpdesk, community and careers" href="/learn" />
    </Screen>
  );
}
