import { router } from "expo-router";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { View } from "react-native";
import { CASE_CATEGORIES, CATEGORY_LABELS, DOC_KINDS, REQUIRED_DOCS, type DocKind } from "@ks1j/shared";
import { ProofSlot } from "@/components/ProofSlot";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Chip, Field, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import type { ProofPhoto } from "@/lib/photo";

const num = (s: string) => Math.max(0, Math.trunc(Number(s) || 0));

export default function Apply() {
  const { user, member } = useAuth();
  const [f, setF] = useState({
    name: member?.fullName ?? "",
    phone: "",
    address: "",
    city: "",
    requirement: "",
    amount: "",
    familyMembers: "",
    earningMembers: "",
    monthlyIncome: "",
    familyHistory: "",
    idLast4: "",
  });
  const [category, setCategory] = useState<string>("welfare");
  const [docs, setDocs] = useState<Partial<Record<DocKind, ProofPhoto | null>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const missingDocs = REQUIRED_DOCS.filter((k) => !docs[k]);
  const ready =
    f.name.trim() && f.phone.trim().length >= 8 && f.address.trim() && f.requirement.trim() && num(f.amount) > 0 && f.familyHistory.trim() && missingDocs.length === 0;

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      // Draft first, so the proof photos can be attached, then submit it for review.
      const ref = await addDoc(collection(db, "cases"), {
        applicantId: user!.uid,
        applicantName: f.name.trim(),
        applicantPhone: f.phone.trim(),
        applicantAddress: f.address.trim(),
        applicantCity: f.city.trim(),
        category,
        requirement: f.requirement.trim(),
        description: f.requirement.trim(),
        amountRequested: num(f.amount),
        familyMembers: num(f.familyMembers),
        earningMembers: num(f.earningMembers),
        monthlyIncome: num(f.monthlyIncome),
        familyHistory: f.familyHistory.trim(),
        idLast4: f.idLast4.trim().slice(0, 4),
        status: "draft",
        createdAt: serverTimestamp(),
      });
      for (const kind of DOC_KINDS) {
        const p = docs[kind];
        if (p) await addDoc(collection(ref, "documents"), { kind, name: p.name, dataUrl: p.dataUrl, uploadedAt: serverTimestamp() });
      }
      await updateDoc(doc(db, "cases", ref.id), { status: "submitted" });
      router.replace("/services/mine");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireAuth eyebrow="Services" title="Ask for help">
      <Screen
        eyebrow="Services"
        title="Ask for help"
        intro="Tell us about your situation and attach your proof. Only the committee can see this. It is never shown publicly."
      >
        <Heading>About you</Heading>
        <Field label="Full name" value={f.name} onChangeText={set("name")} autoCapitalize="words" />
        <Field label="Phone number" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
        <Field label="Home address" value={f.address} onChangeText={set("address")} multiline />
        <Field label="City" value={f.city} onChangeText={set("city")} />

        <Heading>What you need</Heading>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CASE_CATEGORIES.map((c) => (
            <Chip key={c} label={CATEGORY_LABELS[c]} on={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
        <Field label="What is the need?" value={f.requirement} onChangeText={set("requirement")} multiline />
        <Field label="Amount needed (₹)" value={f.amount} onChangeText={set("amount")} keyboardType="number-pad" />

        <Heading>Your family</Heading>
        <Field label="People in the household" value={f.familyMembers} onChangeText={set("familyMembers")} keyboardType="number-pad" />
        <Field label="People who earn" value={f.earningMembers} onChangeText={set("earningMembers")} keyboardType="number-pad" />
        <Field label="Total monthly household income (₹)" value={f.monthlyIncome} onChangeText={set("monthlyIncome")} keyboardType="number-pad" />
        <Field label="Family background and how things got here" value={f.familyHistory} onChangeText={set("familyHistory")} multiline />

        <Heading>Proof</Heading>
        <Body muted>Clear photos, taken in good light. Two are required so the committee can confirm who you are and where you live.</Body>
        <Field label="Last 4 digits of your Aadhaar (optional)" value={f.idLast4} onChangeText={set("idLast4")} keyboardType="number-pad" maxLength={4} />
        <ProofSlot kind="aadhaar" required value={docs.aadhaar ?? null} onChange={(p) => setDocs((d) => ({ ...d, aadhaar: p }))} />
        <ProofSlot kind="address_proof" required value={docs.address_proof ?? null} onChange={(p) => setDocs((d) => ({ ...d, address_proof: p }))} />
        <ProofSlot kind="income_proof" value={docs.income_proof ?? null} onChange={(p) => setDocs((d) => ({ ...d, income_proof: p }))} />

        {err && <Banner error>{err}</Banner>}
        {!ready && <Banner>Please fill in every section and attach your Aadhaar card and address proof.</Banner>}
        <Btn label={busy ? "Submitting…" : "Submit application"} onPress={submit} disabled={!ready || busy} />
      </Screen>
    </RequireAuth>
  );
}
