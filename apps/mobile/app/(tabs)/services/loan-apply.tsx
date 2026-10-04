import { router } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Btn, Field, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";

export default function LoanApply() {
  const { user, member } = useAuth();
  const [principal, setPrincipal] = useState("");
  const [purpose, setPurpose] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    try {
      // No interest or fee fields exist on a loan, by design.
      await addDoc(collection(db, "loans"), {
        borrowerId: user!.uid,
        borrowerName: member?.fullName ?? "",
        principal: Math.trunc(Number(principal)),
        purpose: purpose.trim(),
        status: "applied",
        familyAccepted: false,
        trusteeAccepted: false,
        createdAt: serverTimestamp(),
      });
      router.replace("/services/loans");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <RequireAuth eyebrow="Services" title="Education loan">
      <Screen
        eyebrow="Services"
        title="Education loan"
        intro="Zero interest and no late fees, ever. You and a trustee agree the monthly amount before anything is paid out."
      >
        <Field label="Amount (₹)" value={principal} onChangeText={setPrincipal} keyboardType="number-pad" />
        <Field label="What is it for?" value={purpose} onChangeText={setPurpose} multiline />
        {err && <Banner error>{err}</Banner>}
        <Btn label="Apply" onPress={submit} disabled={!(Number(principal) > 0) || !purpose.trim()} />
      </Screen>
    </RequireAuth>
  );
}
