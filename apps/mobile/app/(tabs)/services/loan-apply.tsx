import { router } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { View } from "react-native";
import {
  LOAN_DOC_KINDS,
  LOAN_DOC_LABELS,
  PARENT_STATUS,
  PARENT_STATUS_LABELS,
  formatRupees,
  minEmi,
  requiredLoanDocs,
  firstEmiDate,
  isoToDmy,
  parseDmy,
  type LoanDocKind,
  type ParentStatus,
} from "@ks1j/shared";
import { ProofSlot } from "@/components/ProofSlot";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Chip, Field, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import type { ProofPhoto } from "@/lib/photo";

const num = (s: string) => Math.max(0, Math.trunc(Number(s) || 0));
const emptyRef = { name: "", phone: "", relation: "" };

export default function LoanApply() {
  const { user, member } = useAuth();
  const [f, setF] = useState({
    studentName: "",
    course: "",
    institution: "",
    courseEnd: "",
    principal: "",
    purpose: "",
    guarantorName: "",
    guarantorPhone: "",
    guarantorRelation: "",
    guardianName: "",
    guardianRelation: "",
    guardianPhone: "",
    guardianAddress: "",
    guardianOccupation: "",
    guardianIncome: "",
  });
  const [orphan, setOrphan] = useState(false);
  const [parentStatus, setParentStatus] = useState<ParentStatus>("both_deceased");
  const [refs, setRefs] = useState([{ ...emptyRef }, { ...emptyRef }]);
  const [docs, setDocs] = useState<Partial<Record<LoanDocKind, ProofPhoto | null>>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const setRef = (i: number, k: keyof typeof emptyRef) => (v: string) => setRefs((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const principal = num(f.principal);
  const needed = requiredLoanDocs(orphan);
  const courseEndIso = parseDmy(f.courseEnd);
  const dateOk = courseEndIso !== null;
  const refsOk = !orphan || refs.every((r) => r.name.trim() && r.phone.trim().length >= 8 && r.relation.trim());
  const guardianOk = !orphan || (f.guardianName.trim() && f.guardianRelation.trim() && f.guardianPhone.trim().length >= 8 && f.guardianAddress.trim());
  const ready =
    f.studentName.trim() && f.course.trim() && f.institution.trim() && dateOk && principal > 0 && f.purpose.trim() &&
    f.guarantorName.trim() && f.guarantorPhone.trim().length >= 8 && refsOk && guardianOk && needed.every((k) => docs[k]);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      // No interest or fee field exists on a loan, by design. The rules only accept this exact list of fields.
      const ref = await addDoc(collection(db, "loans"), {
        borrowerId: user!.uid,
        borrowerName: member?.fullName ?? "",
        studentName: f.studentName.trim(),
        course: f.course.trim(),
        institution: f.institution.trim(),
        courseEnd: courseEndIso,
        principal,
        purpose: f.purpose.trim(),
        orphan,
        guarantorName: f.guarantorName.trim(),
        guarantorPhone: f.guarantorPhone.trim(),
        guarantorRelation: f.guarantorRelation.trim(),
        ...(orphan
          ? {
              parentStatus,
              guardianName: f.guardianName.trim(),
              guardianRelation: f.guardianRelation.trim(),
              guardianPhone: f.guardianPhone.trim(),
              guardianAddress: f.guardianAddress.trim(),
              guardianOccupation: f.guardianOccupation.trim(),
              guardianIncome: num(f.guardianIncome),
              refs: refs.map((r) => ({ name: r.name.trim(), phone: r.phone.trim(), relation: r.relation.trim() })),
            }
          : {}),
        status: "applied",
        createdAt: serverTimestamp(),
      });
      for (const kind of LOAN_DOC_KINDS) {
        const p = docs[kind];
        if (p) await addDoc(collection(ref, "documents"), { kind, name: p.name, dataUrl: p.dataUrl, uploadedAt: serverTimestamp() });
      }
      router.replace("/services/loans");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequireAuth eyebrow="Services" title="Education loan">
      <Screen
        eyebrow="Services"
        title="Education loan"
        intro="Interest-free. No late fees, ever. You agree a monthly amount with a trustee, and repayment starts six months after the course ends."
      >
        <Heading>The student and the course</Heading>
        <Field label="Student's full name" value={f.studentName} onChangeText={set("studentName")} autoCapitalize="words" />
        <Field label="Course" value={f.course} onChangeText={set("course")} />
        <Field label="School or college" value={f.institution} onChangeText={set("institution")} />
        <Field label="Course ends on (DD/MM/YYYY)" value={f.courseEnd} onChangeText={set("courseEnd")} placeholder="01/10/2027" />
        <Field label="Loan amount needed (₹)" value={f.principal} onChangeText={set("principal")} keyboardType="number-pad" />
        <Field label="What will the money pay for?" value={f.purpose} onChangeText={set("purpose")} multiline />
        {principal > 0 && (
          <Banner>
            The smallest monthly amount is {formatRupees(minEmi(principal))} (the loan spread over 48 months).
            {dateOk ? ` Your first instalment would be on ${isoToDmy(firstEmiDate(courseEndIso!))}.` : ""}
          </Banner>
        )}

        <Heading>Guarantor</Heading>
        <Field label="Guarantor's name" value={f.guarantorName} onChangeText={set("guarantorName")} autoCapitalize="words" />
        <Field label="Guarantor's phone" value={f.guarantorPhone} onChangeText={set("guarantorPhone")} keyboardType="phone-pad" />
        <Field label="Relation to you" value={f.guarantorRelation} onChangeText={set("guarantorRelation")} />

        <Heading>Is the student an orphan?</Heading>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip label="No" on={!orphan} onPress={() => setOrphan(false)} />
          <Chip label="Yes, one or both parents have passed away" on={orphan} onPress={() => setOrphan(true)} />
        </View>

        {orphan && (
          <>
            <Banner>For an orphan loan the committee does a fuller background check, including a visit to the home. These details make it faster.</Banner>
            <Heading>Which parent has passed away?</Heading>
            <View style={{ gap: 8 }}>
              {PARENT_STATUS.map((s) => (
                <Chip key={s} label={PARENT_STATUS_LABELS[s]} on={parentStatus === s} onPress={() => setParentStatus(s)} />
              ))}
            </View>

            <Heading>The guardian looking after the student</Heading>
            <Field label="Guardian's full name" value={f.guardianName} onChangeText={set("guardianName")} autoCapitalize="words" />
            <Field label="Relation to the student" value={f.guardianRelation} onChangeText={set("guardianRelation")} />
            <Field label="Guardian's phone" value={f.guardianPhone} onChangeText={set("guardianPhone")} keyboardType="phone-pad" />
            <Field label="Guardian's home address" value={f.guardianAddress} onChangeText={set("guardianAddress")} multiline />
            <Field label="What does the guardian do for work?" value={f.guardianOccupation} onChangeText={set("guardianOccupation")} />
            <Field label="Household income each month (₹)" value={f.guardianIncome} onChangeText={set("guardianIncome")} keyboardType="number-pad" />

            <Heading>Two people who know the family</Heading>
            <Body muted>A teacher, an imam or a neighbour. The committee will call them.</Body>
            {refs.map((r, i) => (
              <View key={i} style={{ gap: 8 }}>
                <Field label={`Reference ${i + 1}: name`} value={r.name} onChangeText={setRef(i, "name")} autoCapitalize="words" />
                <Field label="Phone" value={r.phone} onChangeText={setRef(i, "phone")} keyboardType="phone-pad" />
                <Field label="How they know the family" value={r.relation} onChangeText={setRef(i, "relation")} />
              </View>
            ))}
          </>
        )}

        <Heading>Proof</Heading>
        <Body muted>Clear photos, taken in good light.</Body>
        {needed.map((k) => (
          <ProofSlot key={k} label={LOAN_DOC_LABELS[k]} required value={docs[k] ?? null} onChange={(p) => setDocs((d) => ({ ...d, [k]: p }))} />
        ))}

        {err && <Banner error>{err}</Banner>}
        {!ready && <Banner>Please fill in every section and attach each document listed above.</Banner>}
        <Btn label={busy ? "Applying…" : "Apply for the loan"} onPress={submit} disabled={!ready || busy} />
      </Screen>
    </RequireAuth>
  );
}
