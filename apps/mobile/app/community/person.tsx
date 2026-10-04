import { router, useLocalSearchParams } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useLang } from "@/lib/i18n";
import { useState } from "react";
import { View } from "react-native";
import { CommunityGate, useMyProfile, type Profile } from "@/components/CommunityGate";
import { Banner, Body, Btn, Card, Chip, Field, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useDocument } from "@/lib/firestore";

function Inner() {
  const { t } = useLang();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const me = useMyProfile();
  const p = useDocument<Profile>(`communityProfiles/${id}`);
  const [kind, setKind] = useState<"message" | "call">("message");
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!p) return <Screen eyebrow={t("cPerson.1")} title={t("cPerson.2")}>{p === null && <Banner>{t("cPerson.8")}</Banner>}</Screen>;

  async function request() {
    setErr(null);
    try {
      // Consent-gated: nothing can be sent until the other person accepts.
      await addDoc(collection(db, "communityConnections"), {
        fromId: user!.uid,
        toId: id,
        fromName: me?.fullName ?? "",
        toName: p!.fullName,
        kind,
        status: "pending",
        note: note.trim(),
        preferredTime: time.trim() || null,
        createdAt: serverTimestamp(),
      });
      router.replace("/community/messages");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const self = id === user?.uid;
  return (
    <Screen eyebrow={t("cPerson.1")} title={p.fullName} intro={p.headline}>
      <Card>
        <Body>{[p.profession, p.industry, p.city].filter(Boolean).join(" · ")}</Body>
        {p.bio ? <Body>{p.bio}</Body> : null}
        {p.skills?.length ? <Body muted>Skills: {p.skills.join(", ")}</Body> : null}
        {p.openToWork ? <Body bold>{t("cPerson.9")}</Body> : null}
        {p.isMentor ? (
          <>
            <Body bold>Mentor: {p.mentorAreas?.join(", ")}</Body>
            {p.mentorNote ? <Body muted>{p.mentorNote}</Body> : null}
          </>
        ) : null}
      </Card>
      {!self && (
        <>
          <Heading>{t("cPerson.10")}</Heading>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label={t("cPerson.3")} on={kind === "message"} onPress={() => setKind("message")} />
            <Chip label={t("cPerson.4")} on={kind === "call"} onPress={() => setKind("call")} />
          </View>
          <Field label={t("cPerson.5")} value={note} onChangeText={setNote} multiline />
          {kind === "call" && <Field label={t("cPerson.6")} value={time} onChangeText={setTime} />}
          {err && <Banner error>{err}</Banner>}
          <Btn label={t("cPerson.7")} onPress={request} disabled={!note.trim()} />
        </>
      )}
    </Screen>
  );
}

export default function Person() {
  const { t } = useLang();
  return (
    <CommunityGate title={t("cPerson.2")}>
      <Inner />
    </CommunityGate>
  );
}
