import { useLocalSearchParams } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { formatRupees } from "@ks1j/shared";
import { Banner, Body, Btn, Card, Field, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useDocument } from "@/lib/firestore";

export default function CaseGive() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const c = useDocument(`publicCases/${id}`);
  const [amount, setAmount] = useState("500");
  const [msg, setMsg] = useState<string | null>(null);

  async function give() {
    setMsg(null);
    try {
      // Money never moves on the client: only a PENDING donation is recorded.
      await addDoc(collection(db, "donations"), {
        fund: "general",
        caseId: id,
        amount: Math.trunc(Number(amount)),
        status: "pending",
        payerId: user?.uid ?? null,
        createdAt: serverTimestamp(),
      });
      setMsg("Thank you. Your gift is pending until payment is confirmed.");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (c === undefined) return <Screen eyebrow="Give" title="Case" />;
  if (c === null)
    return (
      <Screen eyebrow="Give" title="Case">
        <Banner>This case is no longer open.</Banner>
      </Screen>
    );
  return (
    <Screen eyebrow={c.category} title="Give to this case" intro={c.description}>
      <Card>
        <Body muted>
          {formatRupees(c.amountRaised ?? 0)} raised of {formatRupees(c.amountNeeded ?? 0)}
        </Body>
      </Card>
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      <Btn label="Give" onPress={give} disabled={!(Number(amount) > 0)} />
      {msg && <Banner>{msg}</Banner>}
    </Screen>
  );
}
