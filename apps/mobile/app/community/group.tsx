import { router, useLocalSearchParams } from "expo-router";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { View } from "react-native";
import { CommunityGate, useMyProfile } from "@/components/CommunityGate";
import { PostList } from "@/components/PostList";
import { Banner, Body, Btn, Card, Chip, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection, useDocument } from "@/lib/firestore";

function Inner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const uid = user!.uid;
  const me = useMyProfile();
  const g = useDocument(`communityGroups/${id}`);
  const members = useCollection(`communityGroups/${id}/members`);
  const [tab, setTab] = useState<"discussion" | "members">("discussion");
  const [err, setErr] = useState<string | null>(null);

  if (!g) return <Screen eyebrow="Community" title="Group" />;
  const isOwner = g.ownerId === uid;
  const roster = members.rows.filter((m) => m.status === "member");
  const pending = members.rows.filter((m) => m.status === "pending");
  const guard = (p: Promise<unknown>) => p.catch((e) => setErr((e as Error).message));

  return (
    <Screen eyebrow={g.kind === "profession" ? "Profession circle" : "Interest group"} title={g.name} intro={g.description}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip label="Discussion" on={tab === "discussion"} onPress={() => setTab("discussion")} />
        <Chip label="Members" on={tab === "members"} onPress={() => setTab("members")} />
      </View>
      {err && <Banner error>{err}</Banner>}
      {tab === "discussion" ? (
        <PostList groupId={id} authorName={me?.fullName ?? ""} />
      ) : (
        <>
          {isOwner && pending.length > 0 && <Heading>Waiting for approval</Heading>}
          {isOwner &&
            pending.map((m) => (
              <Card key={m.id}>
                <Body bold>{m.name}</Body>
                <Btn label="Approve" onPress={() => guard(updateDoc(doc(db, "communityGroups", id, "members", m.id), { status: "member" }))} />
                <Btn quiet label="Decline" onPress={() => guard(deleteDoc(doc(db, "communityGroups", id, "members", m.id)))} />
              </Card>
            ))}
          <Heading>Members ({roster.length})</Heading>
          {roster.map((m) => (
            <Card key={m.id}>
              <Body>
                {m.name} {m.role === "owner" ? "· Owner" : ""}
              </Body>
            </Card>
          ))}
          {!isOwner && (
            <Btn quiet label="Leave group" onPress={() => guard(deleteDoc(doc(db, "communityGroups", id, "members", uid)).then(() => router.back()))} />
          )}
        </>
      )}
    </Screen>
  );
}

export default function Group() {
  return (
    <CommunityGate title="Group">
      <Inner />
    </CommunityGate>
  );
}
