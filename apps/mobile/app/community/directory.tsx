import { Link, useLocalSearchParams } from "expo-router";
import { where } from "firebase/firestore";
import { useState } from "react";
import { Pressable } from "react-native";
import { initials } from "@ks1j/shared";
import { CommunityGate } from "@/components/CommunityGate";
import { Banner, Body, Card, Chip, Field, Screen } from "@/components/ui";
import { useCollection } from "@/lib/firestore";

function Inner() {
  const { mentors } = useLocalSearchParams<{ mentors?: string }>();
  const [q, setQ] = useState("");
  const [mentorsOnly, setMentorsOnly] = useState(mentors === "1");
  // Must constrain listed == true for the query to satisfy the security rules.
  const { rows } = useCollection("communityProfiles", [where("listed", "==", true)]);
  const needle = q.trim().toLowerCase();
  const list = rows
    .filter((p) => !mentorsOnly || p.isMentor)
    .filter(
      (p) =>
        !needle ||
        [p.fullName, p.headline, p.profession, p.industry, p.city, ...(p.skills ?? [])].join(" ").toLowerCase().includes(needle),
    );
  return (
    <Screen eyebrow="Community" title={mentorsOnly ? "Mentorship Circle" : "Directory"} intro="Members who chose to be listed.">
      <Field label="Search" value={q} onChangeText={setQ} placeholder="Name, skill, city, profession" />
      <Chip label="Mentors only" on={mentorsOnly} onPress={() => setMentorsOnly(!mentorsOnly)} />
      {list.length === 0 && <Banner>No one matches.</Banner>}
      {list.map((p) => (
        <Link key={p.id} href={{ pathname: "/community/person", params: { id: p.id } }} asChild>
          <Pressable>
            <Card>
              <Body bold>
                {initials(p.fullName ?? "?")} · {p.fullName}
              </Body>
              <Body>{p.headline}</Body>
              <Body muted>{[p.profession, p.city].filter(Boolean).join(" · ")}</Body>
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

export default function Directory() {
  return (
    <CommunityGate title="Directory">
      <Inner />
    </CommunityGate>
  );
}
