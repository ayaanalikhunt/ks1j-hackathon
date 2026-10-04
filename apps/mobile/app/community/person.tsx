import { router, useLocalSearchParams } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { View } from "react-native";
import { CommunityGate, useMyProfile, type Profile } from "@/components/CommunityGate";
import { Banner, Body, Btn, Card, Chip, Field, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useDocument } from "@/lib/firestore";

function Inner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const me = useMyProfile();
  const p = useDocument<Profile>(`communityProfiles/${id}`);
  const [kind, setKind] = useState<"message" | "call">("message");
  const [note, setNote] = useState("");
  const [time, setTime] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!p) return <Screen eyebrow="Community" title="Member">{p === null && <Banner>Profile not found.</Banner>}</Screen>;

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
    <Screen eyebrow="Community" title={p.fullName} intro={p.headline}>
      <Card>
        <Body>{[p.profession, p.industry, p.city].filter(Boolean).join(" · ")}</Body>
        {p.bio ? <Body>{p.bio}</Body> : null}
        {p.skills?.length ? <Body muted>Skills: {p.skills.join(", ")}</Body> : null}
        {p.openToWork ? <Body bold>Open to work</Body> : null}
        {p.isMentor ? (
          <>
            <Body bold>Mentor: {p.mentorAreas?.join(", ")}</Body>
            {p.mentorNote ? <Body muted>{p.mentorNote}</Body> : null}
          </>
        ) : null}
      </Card>
      {!self && (
        <>
          <Heading>Get in touch</Heading>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Request to message" on={kind === "message"} onPress={() => setKind("message")} />
            <Chip label="Request a call" on={kind === "call"} onPress={() => setKind("call")} />
          </View>
          <Field label="A short note (required)" value={note} onChangeText={setNote} multiline />
          {kind === "call" && <Field label="Preferred time" value={time} onChangeText={setTime} />}
          {err && <Banner error>{err}</Banner>}
          <Btn label="Send request" onPress={request} disabled={!note.trim()} />
        </>
      )}
    </Screen>
  );
}

export default function Person() {
  return (
    <CommunityGate title="Member">
      <Inner />
    </CommunityGate>
  );
}
