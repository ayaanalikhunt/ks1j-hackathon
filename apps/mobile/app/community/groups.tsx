import { Link } from "expo-router";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useLang } from "@/lib/i18n";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { CommunityGate, useMyProfile } from "@/components/CommunityGate";
import { Banner, Body, Btn, Card, Chip, Field, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection, useDocument } from "@/lib/firestore";

function GroupRow({ g, name }: { g: any; name: string }) {
  const { t } = useLang();
  const { user } = useAuth();
  const uid = user!.uid;
  const mine = useDocument(`communityGroups/${g.id}/members/${uid}`);
  const [err, setErr] = useState<string | null>(null);
  // Public groups: join instantly. Private: request, then the owner approves.
  const join = () =>
    setDoc(doc(db, "communityGroups", g.id, "members", uid), { role: "member", status: g.private ? "pending" : "member", name }).catch((e) =>
      setErr((e as Error).message),
    );
  return (
    <Card>
      <Body bold>
        {g.name} · {g.kind === "profession" ? t("cGroups.7") : t("cGroups.8")}
        {g.private ? " · Private" : ""}
      </Body>
      <Body muted>{g.description}</Body>
      {mine?.status === "member" ? (
        <Link href={{ pathname: "/community/group", params: { id: g.id } }} asChild>
          <Pressable>
            <Btn label={t("cGroups.1")} onPress={() => {}} />
          </Pressable>
        </Link>
      ) : mine?.status === "pending" ? (
        <Banner>{t("cGroups.10")}</Banner>
      ) : (
        <Btn label={g.private ? t("cGroups.13") : t("cGroups.14")} onPress={join} />
      )}
      {err && <Banner error>{err}</Banner>}
    </Card>
  );
}

function Inner() {
  const { t } = useLang();
  const { user } = useAuth();
  const me = useMyProfile();
  const { rows } = useCollection("communityGroups");
  const groups = rows.filter((g) => !g.removed);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"profession" | "interest">("interest");
  const [isPrivate, setIsPrivate] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    try {
      const uid = user!.uid;
      const ref = await addDoc(collection(db, "communityGroups"), {
        name: name.trim(),
        description: description.trim(),
        kind,
        private: isPrivate,
        ownerId: uid,
        removed: false,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "communityGroups", ref.id, "members", uid), { role: "owner", status: "member", name: me?.fullName ?? "" });
      setName("");
      setDescription("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <Screen eyebrow={t("cGroups.2")} title={t("cGroups.3")} intro={t("cGroups.4")}>
      {groups.length === 0 && <Banner>{t("cGroups.11")}</Banner>}
      {groups.map((g) => (
        <GroupRow key={g.id} g={g} name={me?.fullName ?? ""} />
      ))}
      <Heading>{t("cGroups.12")}</Heading>
      <Field label={t("cGroups.5")} value={name} onChangeText={setName} />
      <Field label={t("cGroups.6")} value={description} onChangeText={setDescription} multiline />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Chip label={t("cGroups.7")} on={kind === "profession"} onPress={() => setKind("profession")} />
        <Chip label={t("cGroups.8")} on={kind === "interest"} onPress={() => setKind("interest")} />
        <Chip label={isPrivate ? t("cGroups.15") : t("cGroups.1")} on={isPrivate} onPress={() => setIsPrivate(!isPrivate)} />
      </View>
      {err && <Banner error>{err}</Banner>}
      <Btn label={t("cGroups.9")} onPress={create} disabled={!name.trim()} />
    </Screen>
  );
}

export default function Groups() {
  const { t } = useLang();
  return (
    <CommunityGate title={t("cGroups.3")}>
      <Inner />
    </CommunityGate>
  );
}
