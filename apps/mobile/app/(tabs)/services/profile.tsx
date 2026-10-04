import { router } from "expo-router";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useDocument } from "@/lib/firestore";

interface Household {
  name: string;
  area: string;
  memberNames?: string[];
}

export default function Profile() {
  const { user, member, signOut } = useAuth();
  const m = member as (typeof member & { householdId?: string; membershipVerified?: boolean }) | null;
  const household = useDocument<Household>(m?.householdId ? `households/${m.householdId}` : null);

  return (
    <RequireAuth eyebrow="Services" title="Profile and household">
      <Screen eyebrow="Your account" title="Profile and household" intro="Your membership details, and the family linked to you.">
        <Heading>Your details</Heading>
        <Card>
          <Body bold>{m?.fullName}</Body>
          <Body muted>{user?.email}</Body>
          <Body>Mobile: {m?.phone}</Body>
          <Body>{m?.membershipVerified ? "Membership: verified by the Jamaat" : "Membership: waiting for the Jamaat office to verify you"}</Body>
        </Card>

        <Heading>Your household</Heading>
        {!m?.householdId && (
          <Banner>Your household is not linked yet. The Jamaat office links you after checking who you are. Until then you cannot see family dues or loans.</Banner>
        )}
        {household && (
          <Card>
            <Body bold>
              {household.name} · {household.area}
            </Body>
            {(household.memberNames ?? []).map((n) => (
              <Body key={n}>
                {n}
                {n === m?.fullName ? " (you)" : ""}
              </Body>
            ))}
          </Card>
        )}

        <Btn quiet label="Sign out" onPress={() => signOut().then(() => router.replace("/home"))} />
      </Screen>
    </RequireAuth>
  );
}
