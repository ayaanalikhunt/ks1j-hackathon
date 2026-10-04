import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { View } from "react-native";
import { DONOR_CURRENCIES, DONOR_NOTIFICATION_KEYS, DONOR_NOTIFICATION_LABELS, donorWants, type DonorNotificationKey } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Chip, Field, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useDocument } from "@/lib/firestore";

interface Edits {
  fullName?: string;
  displayName?: string;
  phone?: string;
  country?: string;
  preferredCurrency?: string;
  notifications?: Partial<Record<DonorNotificationKey, boolean>>;
}

function Form({ uid, email, saved, fallbackName, fallbackPhone }: { uid: string; email: string; saved: Record<string, any> | null; fallbackName: string; fallbackPhone: string }) {
  const [edit, setEdit] = useState<Edits>({});
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const v = {
    fullName: edit.fullName ?? saved?.fullName ?? fallbackName,
    displayName: edit.displayName ?? saved?.displayName ?? "",
    phone: edit.phone ?? saved?.phone ?? fallbackPhone,
    country: edit.country ?? saved?.country ?? "India",
    preferredCurrency: edit.preferredCurrency ?? saved?.preferredCurrency ?? "INR",
    notifications: { ...saved?.notifications, ...edit.notifications } as Partial<Record<DonorNotificationKey, boolean>>,
  };

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const data = {
        donorId: uid,
        fullName: v.fullName.trim(),
        displayName: v.displayName.trim(),
        email,
        phone: v.phone.trim(),
        country: v.country.trim(),
        preferredCurrency: v.preferredCurrency,
        notifications: Object.fromEntries(DONOR_NOTIFICATION_KEYS.map((k) => [k, donorWants(v.notifications, k)])),
        updatedAt: serverTimestamp(),
      };
      if (saved) await updateDoc(doc(db, "donors", uid), data);
      else await setDoc(doc(db, "donors", uid), { ...data, createdAt: serverTimestamp() });
      setEdit({});
      setMsg({ error: false, text: "Saved." });
    } catch (e) {
      setMsg({ error: true, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Heading>Your details</Heading>
      <Field label="Full name" value={v.fullName} onChangeText={(t) => setEdit({ ...edit, fullName: t })} maxLength={80} />
      <Field label="Name to show publicly (only if you choose Show my name)" value={v.displayName} onChangeText={(t) => setEdit({ ...edit, displayName: t })} maxLength={60} />
      <Field label="Phone" value={v.phone} onChangeText={(t) => setEdit({ ...edit, phone: t })} keyboardType="phone-pad" maxLength={25} />
      <Field label="Country" value={v.country} onChangeText={(t) => setEdit({ ...edit, country: t })} maxLength={60} />
      <Body bold>Preferred currency</Body>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {DONOR_CURRENCIES.map((c) => (
          <Chip key={c} label={c} on={v.preferredCurrency === c} onPress={() => setEdit({ ...edit, preferredCurrency: c })} />
        ))}
      </View>
      <Body muted>Email: {email}. Only committee staff can see your details, and never on a public page unless you choose it.</Body>

      <Heading>Notifications</Heading>
      <Body muted>These appear in the app. Email and SMS are not offered yet.</Body>
      <View style={{ gap: 8 }}>
        {DONOR_NOTIFICATION_KEYS.map((k) => (
          <Chip key={k} label={DONOR_NOTIFICATION_LABELS[k]} on={donorWants(v.notifications, k)} onPress={() => setEdit({ ...edit, notifications: { ...edit.notifications, [k]: !donorWants(v.notifications, k) } })} />
        ))}
      </View>

      {msg && <Banner error={msg.error}>{msg.text}</Banner>}
      <Btn label={busy ? "Saving…" : "Save"} onPress={save} disabled={busy || !v.fullName.trim()} />
    </>
  );
}

export default function DonorProfile() {
  const { user, member } = useAuth();
  const saved = useDocument(user ? `donors/${user.uid}` : null);
  const m = member as (typeof member & { phone?: string }) | null;
  return (
    <RequireAuth eyebrow="Give" title="Profile">
      <Screen eyebrow="Give" title="Profile and notifications" intro="Used to pre-fill the donation form and to decide which updates you receive.">
        {saved !== undefined && user && (
          <Form key={saved ? "saved" : "new"} uid={user.uid} email={user.email ?? ""} saved={saved} fallbackName={m?.fullName ?? ""} fallbackPhone={m?.phone ?? ""} />
        )}
      </Screen>
    </RequireAuth>
  );
}
