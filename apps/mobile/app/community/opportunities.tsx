import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { View } from "react-native";
import { OPPORTUNITY_KINDS, OPPORTUNITY_LABELS, type OpportunityKind } from "@ks1j/shared";
import { CommunityGate, useMyProfile } from "@/components/CommunityGate";
import { Banner, Body, Btn, Card, Chip, Field, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore";

function Inner() {
  const { t } = useLang();
  const { user } = useAuth();
  const me = useMyProfile();
  const { rows } = useCollection("communityOpportunities");
  const [kind, setKind] = useState<OpportunityKind>("job");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const list = rows.filter((o) => !o.removed);

  const add = () =>
    addDoc(collection(db, "communityOpportunities"), {
      authorId: user!.uid,
      authorName: me?.fullName ?? "",
      kind,
      title: title.trim(),
      company: company.trim(),
      description: description.trim(),
      removed: false,
      createdAt: serverTimestamp(),
    })
      .then(() => {
        setTitle("");
        setCompany("");
        setDescription("");
      })
      .catch((e) => setErr((e as Error).message));

  return (
    <Screen eyebrow={t("cOpps.1")} title={t("cOpps.2")} intro={t("cOpps.3")}>
      {list.length === 0 && <Banner>{t("cOpps.8")}</Banner>}
      {list.map((o) => (
        <Card key={o.id}>
          <Body bold>
            {OPPORTUNITY_LABELS[o.kind as OpportunityKind] ?? o.kind} · {o.title}
          </Body>
          <Body muted>{o.company}</Body>
          <Body>{o.description}</Body>
          <Body muted>Shared by {o.authorName}</Body>
        </Card>
      ))}
      <Heading>{t("cOpps.9")}</Heading>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {OPPORTUNITY_KINDS.map((k) => (
          <Chip key={k} label={OPPORTUNITY_LABELS[k]} on={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
      <Field label={t("cOpps.4")} value={title} onChangeText={setTitle} />
      <Field label={t("cOpps.5")} value={company} onChangeText={setCompany} />
      <Field label={t("cOpps.6")} value={description} onChangeText={setDescription} multiline />
      {err && <Banner error>{err}</Banner>}
      <Btn label={t("cOpps.7")} onPress={add} disabled={!title.trim()} />
    </Screen>
  );
}

export default function Opportunities() {
  const { t } = useLang();
  return (
    <CommunityGate title={t("cOpps.2")}>
      <Inner />
    </CommunityGate>
  );
}
