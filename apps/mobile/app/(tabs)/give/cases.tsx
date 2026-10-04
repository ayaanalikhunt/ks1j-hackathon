import { Link, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { CASE_TYPE_LABELS, formatRupees, type CaseType } from "@ks1j/shared";
import { Banner, Body, Card, Chip, Screen } from "@/components/ui";
import { useCollection } from "@/lib/firestore";

const FILTERS = [
  ["all", "All cases"],
  ["sadaat", "Sadaat cases"],
  ["other", "Non-Sadaat cases"],
] as const;

export default function Cases() {
  const { rows, loading, error } = useCollection("publicCases");
  const params = useLocalSearchParams<{ filter?: string; fund?: string }>();
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>(params.filter === "sadaat" || params.filter === "other" ? params.filter : "all");
  const shown = rows.filter((c) => filter === "all" || (filter === "sadaat" ? c.sadaat : !c.sadaat));
  return (
    <Screen eyebrow="Give" title="Support a case" intro="Verified needs, approved by two Jamaat admins. Names and contact details are never shown.">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {FILTERS.map(([k, label]) => (
          <Chip key={k} label={label} on={filter === k} onPress={() => setFilter(k)} />
        ))}
      </View>
      {error && <Banner error>{error}</Banner>}
      {!loading && shown.length === 0 && <Banner>No open cases right now.</Banner>}
      {shown.map((c) => (
        <Link key={c.id} href={{ pathname: "/give/case", params: { id: c.id, fund: params.fund ?? "" } }} asChild>
          <Pressable>
            <Card>
              <Body bold>
                {c.number ? `#${c.number} ` : ""}
                {c.title || "Help for a family"}
              </Body>
              <Body muted>
                {CASE_TYPE_LABELS[c.type as CaseType] ?? c.category}
                {c.sadaat ? " · Sadaat" : ""}
              </Body>
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
