import { router } from "expo-router";
import { addDoc, collection, doc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { View } from "react-native";
import { CASE_TYPES, CASE_TYPE_LABELS, DOC_KINDS, requiredDocs, type CaseType, type DocKind } from "@ks1j/shared";
import { ProofSlot } from "@/components/ProofSlot";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Chip, Field, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import type { ProofPhoto } from "@/lib/photo";

const num = (s: string) => Math.max(0, Math.trunc(Number(s) || 0));

// Education loans have their own flow (Services > Education loan); these four are grants.
const APPLY_TYPES = CASE_TYPES.filter((t) => t !== "education_loan");
const categoryOf = (t: CaseType) => (t === "scholarship" ? "scholarship" : "welfare");

export default function Apply() {
  const { user, member } = useAuth();
  const [type, setType] = useState<CaseType>("medical");
  const [sadaat, setSadaat] = useState(false);
  const [f, setF] = useState({
    name: member?.fullName ?? "",
    phone: "",
    address: "",
    city: "",
    title: "",
    requirement: "",
    amount: "",
    familyMembers: "",
    earningMembers: "",
    monthlyIncome: "",
    familyHistory: "",
    idLast4: "",
  });
  const [docs, setDocs] = useState<Partial<Record<DocKind, ProofPhoto | null>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const needed = requiredDocs(type);
  const missingDocs = needed.filter((k) => !docs[k]);
  const ready =
    f.name.trim() && f.phone.trim().length >= 8 && f.address.trim() && f.title.trim() && f.requirement.trim() && num(f.amount) > 0 && f.familyHistory.trim() && missingDocs.length === 0;

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      // A running case number: #1, #2, #3. The rules only let the counter go up by one.
      const number = await runTransaction(db, async (tx) => {
        const ref = doc(db, "counters", "cases");
        const snap = await tx.get(ref);
        const next = (snap.exists() ? (snap.data().n as number) : 0) + 1;
        tx.set(ref, { n: next });
        return next;
      });
      // Draft first, so the proof photos can be attached, then submit it for review.
      const ref = await addDoc(collection(db, "cases"), {
        applicantId: user!.uid,
        applicantName: f.name.trim(),
        applicantPhone: f.phone.trim(),
        applicantAddress: f.address.trim(),
        applicantCity: f.city.trim(),
        number,
        title: f.title.trim(),
        type,
        category: categoryOf(type),
        sadaatClaimed: sadaat,
        requirement: f.requirement.trim(),
        description: f.requirement.trim(),
        amountRequested: num(f.amount),
        raised: 0,
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
      await addDoc(collection(db, "caseEvents"), {
        caseId: ref.id,
        applicantId: user!.uid,
        caseNumber: number,
        caseTitle: f.title.trim(),
        kind: "submitted",
        actorId: user!.uid,
        at: serverTimestamp(),
      });
      router.replace("/services/mine");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireAuth eyebrow="Services" title="Apply for help">
      <Screen
        eyebrow="Services"
        title="Apply for help"
        intro="Only the Jamaat committee assigned to your case sees these details. Donors never see your name."
      >
        <Heading>What do you need help with?</Heading>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {APPLY_TYPES.map((t) => (
            <Chip key={t} label={CASE_TYPE_LABELS[t]} on={type === t} onPress={() => setType(t)} />
          ))}
        </View>

        <Heading>Category</Heading>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Chip label="Sadaat (Syed)" on={sadaat} onPress={() => setSadaat(true)} />
          <Chip label="Non-Sadaat" on={!sadaat} onPress={() => setSadaat(false)} />
        </View>
        {sadaat && <Body muted>The committee checks your Aadhaar card before confirming this.</Body>}

        <Heading>The need</Heading>
        <Field label="Short title" value={f.title} onChangeText={set("title")} placeholder="For example: Class 10 fees" />
        <Field label="Amount needed (₹)" value={f.amount} onChangeText={set("amount")} keyboardType="number-pad" />
        <Field label="Tell us about the need" value={f.requirement} onChangeText={set("requirement")} multiline />

        <Heading>About you</Heading>
        <Field label="Full name" value={f.name} onChangeText={set("name")} autoCapitalize="words" />
        <Field label="Phone number" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
        <Field label="Home address" value={f.address} onChangeText={set("address")} multiline />
        <Field label="City" value={f.city} onChangeText={set("city")} />

        <Heading>Your family</Heading>
        <Field label="People in the household" value={f.familyMembers} onChangeText={set("familyMembers")} keyboardType="number-pad" />
        <Field label="People who earn" value={f.earningMembers} onChangeText={set("earningMembers")} keyboardType="number-pad" />
        <Field label="Total monthly household income (₹)" value={f.monthlyIncome} onChangeText={set("monthlyIncome")} keyboardType="number-pad" />
        <Field label="Family background and how things got here" value={f.familyHistory} onChangeText={set("familyHistory")} multiline />

        <Heading>Proof</Heading>
        <Body muted>Clear photos, taken in good light. These are what the committee needs for a {CASE_TYPE_LABELS[type].toLowerCase()} request.</Body>
        <Field label="Last 4 digits of your Aadhaar (optional)" value={f.idLast4} onChangeText={set("idLast4")} keyboardType="number-pad" maxLength={4} />
        {needed.map((k) => (
          <ProofSlot key={k} kind={k} required value={docs[k] ?? null} onChange={(p) => setDocs((d) => ({ ...d, [k]: p }))} />
        ))}

        {err && <Banner error>{err}</Banner>}
        {!ready && <Banner>Please fill in every section and attach each document listed above.</Banner>}
        <Btn label={busy ? "Submitting…" : "Submit application"} onPress={submit} disabled={!ready || busy} />
      </Screen>
    </RequireAuth>
  );
}
