import { useLocalSearchParams } from "expo-router";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { useLang } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { CommunityGate } from "@/components/CommunityGate";
import { Banner, Body, Btn, Card, Field, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useDocument } from "@/lib/firestore";

function Inner() {
  const { t } = useLang();
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

  if (!conn) return <Screen eyebrow={t("cChat.1")} title={t("cChat.2")} />;
  const other = conn.fromId === uid ? conn.toName : conn.fromName;
  return (
    <Screen eyebrow={t("cChat.1")} title={other} intro={t("cChat.3")}>
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
      <Field label={t("cChat.4")} value={text} onChangeText={setText} multiline />
      <Btn label={t("cChat.5")} onPress={send} disabled={!text.trim()} />
    </Screen>
  );
}

export default function Chat() {
  const { t } = useLang();
  return (
    <CommunityGate title={t("cChat.2")}>
      <Inner />
    </CommunityGate>
  );
}
