import { Link } from "expo-router";
import { doc, updateDoc, where } from "firebase/firestore";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { CommunityGate } from "@/components/CommunityGate";
import { Banner, Body, Btn, Card, Chip, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore";

function Inner() {
  const { user } = useAuth();
  const uid = user!.uid;
  const [tab, setTab] = useState<"messages" | "requests">("messages");
  const incoming = useCollection("communityConnections", [where("toId", "==", uid)], [uid]).rows;
  const outgoing = useCollection("communityConnections", [where("fromId", "==", uid)], [uid]).rows;

  const answer = (id: string, status: "accepted" | "declined") => updateDoc(doc(db, "communityConnections", id), { status });
  const accepted = [...incoming, ...outgoing].filter((c) => c.status === "accepted");
  const inPending = incoming.filter((c) => c.status === "pending");
  const outPending = outgoing.filter((c) => c.status === "pending");

  return (
    <Screen eyebrow="Community" title="Messages" intro="You can only chat once the other person accepts.">
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Chip label="Messages" on={tab === "messages"} onPress={() => setTab("messages")} />
        <Chip label={`Requests (${inPending.length})`} on={tab === "requests"} onPress={() => setTab("requests")} />
      </View>
      {tab === "messages" ? (
        <>
          {accepted.length === 0 && <Banner>No conversations yet.</Banner>}
          {accepted.map((c) => (
            <Link key={c.id} href={{ pathname: "/community/chat", params: { id: c.id } }} asChild>
              <Pressable>
                <Card>
                  <Body bold>{c.fromId === uid ? c.toName : c.fromName}</Body>
                  <Body muted>{c.kind === "call" ? "Call request" : "Message"} · tap to open</Body>
                </Card>
              </Pressable>
            </Link>
          ))}
        </>
      ) : (
        <>
          {inPending.length + outPending.length === 0 && <Banner>No requests.</Banner>}
          {inPending.map((c) => (
            <Card key={c.id}>
              <Body bold>
                {c.fromName} wants to {c.kind === "call" ? "call" : "message"} you
              </Body>
              <Body>{c.note}</Body>
              {c.preferredTime ? <Body muted>Preferred time: {c.preferredTime}</Body> : null}
              <Btn label="Accept" onPress={() => answer(c.id, "accepted")} />
              <Btn quiet label="Decline" onPress={() => answer(c.id, "declined")} />
            </Card>
          ))}
          {outPending.map((c) => (
            <Card key={c.id}>
              <Body bold>Waiting for {c.toName}</Body>
              <Body muted>{c.note}</Body>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

export default function Messages() {
  return (
    <CommunityGate title="Messages">
      <Inner />
    </CommunityGate>
  );
}
