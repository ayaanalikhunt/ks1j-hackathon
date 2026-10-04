import { useLocalSearchParams } from "expo-router";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { CommunityGate } from "@/components/CommunityGate";
import { Banner, Body, Btn, Card, Field, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useDocument } from "@/lib/firestore";

function Inner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const uid = user!.uid;
  const conn = useDocument(`communityConnections/${id}`);
  const [msgs, setMsgs] = useState<{ id: string; senderId: string; text: string; at: number }[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getDocs(collection(db, "communityConnections", id, "messages"));
      setMsgs(
        s.docs
          .map((d) => ({ id: d.id, ...(d.data() as any), at: d.data().createdAt?.seconds ?? 9e9 }))
          .sort((a, b) => a.at - b.at),
      );
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  // Poll every ~8s instead of realtime, to keep this simple.
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    await addDoc(collection(db, "communityConnections", id, "messages"), { senderId: uid, text: text.trim(), createdAt: serverTimestamp() });
    setText("");
    load();
  };

  if (!conn) return <Screen eyebrow="Community" title="Chat" />;
  const other = conn.fromId === uid ? conn.toName : conn.fromName;
  return (
    <Screen eyebrow="Community" title={other} intro="Keep phone numbers private until you are both comfortable.">
      <Card>
        <Body muted>Original request: {conn.note}</Body>
        {conn.preferredTime ? <Body muted>Preferred time: {conn.preferredTime}</Body> : null}
      </Card>
      {err && <Banner error>{err}</Banner>}
      {msgs.map((m) => (
        <Card key={m.id}>
          <Body bold>{m.senderId === uid ? "You" : other}</Body>
          <Body>{m.text}</Body>
        </Card>
      ))}
      <Field label="Message" value={text} onChangeText={setText} multiline />
      <Btn label="Send" onPress={send} disabled={!text.trim()} />
    </Screen>
  );
}

export default function Chat() {
  return (
    <CommunityGate title="Chat">
      <Inner />
    </CommunityGate>
  );
}
