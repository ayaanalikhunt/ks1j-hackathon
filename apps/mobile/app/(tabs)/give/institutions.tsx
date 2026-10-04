import { addDoc, collection, serverTimestamp, where } from "firebase/firestore";
import { useState } from "react";
import { formatRupees } from "@ks1j/shared";
import { Banner, Body, Btn, Card, Field, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore";

export default function Institutions() {
  const { user } = useAuth();
  // Members can only read verified institutions, so the query must say so.
  const { rows } = useCollection("institutions", [where("ijazahVerified", "==", true)]);
  const [amount, setAmount] = useState("1000");
  const [msg, setMsg] = useState<string | null>(null);
  // Sehme Imam goes only to institutions with a verified ijazah from a Marja'.
  const eligible = rows.filter((i) => i.ijazahVerified === true && i.receiving !== false);

  const give = (institutionId: string) =>
    addDoc(collection(db, "donations"), {
      fund: "sehme_imam",
      institutionId,
      amount: Math.trunc(Number(amount)),
      status: "pending",
      payerId: user?.uid ?? null,
      createdAt: serverTimestamp(),
    })
      .then(() => setMsg("Thank you. Your gift is pending until payment is confirmed."))
      .catch((e) => setMsg((e as Error).message));

  return (
    <Screen eyebrow="Give" title="Sehme Imam" intro="Only institutions holding a verified ijazah from a Marja' can receive this fund.">
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      {eligible.length === 0 && <Banner>No verified institutions yet.</Banner>}
      {eligible.map((i) => (
        <Card key={i.id}>
          <Body bold>{i.name}</Body>
          {i.marja ? <Body muted>Ijazah: {i.marja}</Body> : null}
          <Btn label={`Give ${formatRupees(Math.trunc(Number(amount)) || 0)}`} onPress={() => give(i.id)} disabled={!(Number(amount) > 0)} />
        </Card>
      ))}
      {msg && <Banner>{msg}</Banner>}
    </Screen>
  );
}
