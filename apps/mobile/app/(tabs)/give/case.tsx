import { useLocalSearchParams } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { View } from "react-native";
import { CASE_TYPE_LABELS, formatRupees, type CaseType } from "@ks1j/shared";
import { Banner, Body, Btn, Card, Chip, Field, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useDocument } from "@/lib/firestore";

export default function CaseGive() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const c = useDocument(`publicCases/${id}`);
  const [amount, setAmount] = useState("500");
  // A Sadaat case can take Sehme Sadaat or a general gift. Any other case takes general gifts only.
  const [fund, setFund] = useState<"general" | "sehme_sadaat">("general");
  const [msg, setMsg] = useState<string | null>(null);

  async function give() {
    setMsg(null);
    try {
      // Money never moves on the client: only a PENDING donation is recorded.
      await addDoc(collection(db, "donations"), {
        fund: c?.sadaat ? fund : "general",
        caseId: c?.caseId, // the real case id, not the public card id
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
        <Banner>This case is no longer open for gifts.</Banner>
      </Screen>
    );
  return (
    <Screen
      eyebrow={`${CASE_TYPE_LABELS[c.type as CaseType] ?? c.category}${c.sadaat ? " · Sadaat" : ""}`}
      title={`${c.number ? `#${c.number} ` : ""}${c.title || "Give to this case"}`}
      intro={c.description}
    >
      <Card>
        <Body muted>
          {formatRupees(c.amountRaised ?? 0)} raised of {formatRupees(c.amountNeeded ?? 0)}
        </Body>
      </Card>
      {c.sadaat && (
        <View style={{ gap: 8 }}>
          <Body bold>Which fund is this from?</Body>
          <Chip label="General donation" on={fund === "general"} onPress={() => setFund("general")} />
          <Chip label="Sehme Sadaat (only for verified Sadaat cases)" on={fund === "sehme_sadaat"} onPress={() => setFund("sehme_sadaat")} />
        </View>
      )}
      <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      <Btn label="Give" onPress={give} disabled={!(Number(amount) > 0)} />
      {msg && <Banner>{msg}</Banner>}
    </Screen>
  );
}
