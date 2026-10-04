import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { KHUMS_DISCLAIMER, formatRupees, khumsDue } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Field, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";

export default function Khums() {
  const { user } = useAuth();
  const [surplus, setSurplus] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const n = Math.trunc(Number(surplus));
  const valid = Number.isFinite(n) && n >= 0 && surplus !== "";
  const due = valid ? khumsDue(n) : null;

  async function save() {
    try {
      await addDoc(collection(db, "khumsCalculations"), { memberId: user!.uid, surplus: n, due, createdAt: serverTimestamp() });
      setMsg("Saved.");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <RequireAuth eyebrow="Give" title="Khums calculator">
      <Screen eyebrow="Give" title="Khums calculator" intro="Enter your net surplus for the year, after your expenses.">
        <Field label="Net surplus (₹)" value={surplus} onChangeText={setSurplus} keyboardType="number-pad" />
        {due !== null && (
          <Card>
            <Body muted>Khums due (one fifth)</Body>
            <Heading>{formatRupees(due)}</Heading>
          </Card>
        )}
        <Banner>{KHUMS_DISCLAIMER}</Banner>
        <Btn label="Save this calculation" onPress={save} disabled={due === null} />
        {msg && <Banner>{msg}</Banner>}
      </Screen>
    </RequireAuth>
  );
}
