import { Link } from "expo-router";
import { Pressable } from "react-native";
import { formatRupees } from "@ks1j/shared";
import { Banner, Body, Card, Screen } from "@/components/ui";
import { useCollection } from "@/lib/firestore";

export default function Cases() {
  const { rows, loading, error } = useCollection("publicCases");
  return (
    <Screen eyebrow="Give" title="Open cases" intro="Names and contact details are never shown.">
      {error && <Banner error>{error}</Banner>}
      {!loading && rows.length === 0 && <Banner>No open cases right now.</Banner>}
      {rows.map((c) => (
        <Link key={c.id} href={{ pathname: "/give/case", params: { id: c.id } }} asChild>
          <Pressable>
            <Card>
              <Body bold>{c.category}</Body>
              <Body>{c.description}</Body>
              <Body muted>
                {formatRupees(c.amountRaised ?? 0)} of {formatRupees(c.amountNeeded ?? 0)}
              </Body>
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}
