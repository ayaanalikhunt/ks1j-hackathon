import { Link, useLocalSearchParams } from "expo-router";
import { where } from "firebase/firestore";
import { useLang } from "@/lib/i18n";
import { useState } from "react";
import { Pressable } from "react-native";
import { initials } from "@ks1j/shared";
import { CommunityGate } from "@/components/CommunityGate";
import { Banner, Body, Card, Chip, Field, Screen } from "@/components/ui";
import { useCollection } from "@/lib/firestore";

function Inner() {
  const { t } = useLang();
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
    <Screen eyebrow={t("cDir.1")} title={mentorsOnly ? t("cDir.8") : t("cDir.6")} intro={t("cDir.2")}>
      <Field label={t("cDir.3")} value={q} onChangeText={setQ} placeholder={t("cDir.4")} />
      <Chip label={t("cDir.5")} on={mentorsOnly} onPress={() => setMentorsOnly(!mentorsOnly)} />
      {list.length === 0 && <Banner>{t("cDir.7")}</Banner>}
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
  const { t } = useLang();
  return (
    <CommunityGate title={t("cDir.6")}>
      <Inner />
    </CommunityGate>
  );
}
