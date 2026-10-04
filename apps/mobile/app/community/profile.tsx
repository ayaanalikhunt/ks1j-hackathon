import { router } from "expo-router";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useLang } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { splitList } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { useMyProfile } from "@/components/CommunityGate";
import { Banner, Btn, Chip, Field, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";

function Editor() {
  const { t } = useLang();
  const { user, member } = useAuth();
  const existing = useMyProfile();
  const [f, setF] = useState({ headline: "", profession: "", industry: "", city: "", skills: "", bio: "", mentorAreas: "", mentorNote: "" });
  const [listed, setListed] = useState(true);
  const [openToWork, setOpenToWork] = useState(false);
  const [isMentor, setIsMentor] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!existing) return;
    setF({
      headline: existing.headline ?? "",
      profession: existing.profession ?? "",
      industry: existing.industry ?? "",
      city: existing.city ?? "",
      skills: (existing.skills ?? []).join(", "),
      bio: existing.bio ?? "",
      mentorAreas: (existing.mentorAreas ?? []).join(", "),
      mentorNote: existing.mentorNote ?? "",
    });
    setListed(existing.listed ?? true);
    setOpenToWork(existing.openToWork ?? false);
    setIsMentor(existing.isMentor ?? false);
  }, [existing]);

  async function save() {
    try {
      // Identity is the verified membership name. No phone number is ever stored here.
      await setDoc(doc(db, "communityProfiles", user!.uid), {
        fullName: member?.fullName ?? user!.displayName ?? "Member",
        headline: f.headline,
        profession: f.profession,
        industry: f.industry,
        city: f.city,
        skills: splitList(f.skills),
        bio: f.bio,
        listed,
        openToWork,
        isMentor,
        mentorAreas: isMentor ? splitList(f.mentorAreas) : [],
        mentorNote: isMentor ? f.mentorNote : "",
        updatedAt: serverTimestamp(),
      });
      setMsg("Saved.");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const leave = () => deleteDoc(doc(db, "communityProfiles", user!.uid)).then(() => router.replace("/learn"));

  return (
    <Screen eyebrow={t("commProfile.1")} title={t("commProfile.2")} intro={t("commProfile.3")}>
      <Field label={t("commProfile.4")} value={f.headline} onChangeText={set("headline")} />
      <Field label={t("commProfile.5")} value={f.profession} onChangeText={set("profession")} />
      <Field label={t("commProfile.6")} value={f.industry} onChangeText={set("industry")} />
      <Field label={t("commProfile.7")} value={f.city} onChangeText={set("city")} />
      <Field label={t("commProfile.8")} value={f.skills} onChangeText={set("skills")} />
      <Field label={t("commProfile.9")} value={f.bio} onChangeText={set("bio")} multiline />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Chip label={t("commProfile.10")} on={listed} onPress={() => setListed(!listed)} />
        <Chip label={t("commProfile.11")} on={openToWork} onPress={() => setOpenToWork(!openToWork)} />
        <Chip label={t("commProfile.12")} on={isMentor} onPress={() => setIsMentor(!isMentor)} />
      </View>
      {isMentor && (
        <>
          <Field label={t("commProfile.13")} value={f.mentorAreas} onChangeText={set("mentorAreas")} />
          <Field label={t("commProfile.14")} value={f.mentorNote} onChangeText={set("mentorNote")} />
        </>
      )}
      {msg && <Banner>{msg}</Banner>}
      <Btn label={t("commProfile.15")} onPress={save} />
      {existing && <Btn quiet label={t("commProfile.16")} onPress={leave} />}
    </Screen>
  );
}

export default function Profile() {
  const { t } = useLang();
  return (
    <RequireAuth eyebrow={t("commProfile.1")} title={t("commProfile.2")}>
      <Editor />
    </RequireAuth>
  );
}
