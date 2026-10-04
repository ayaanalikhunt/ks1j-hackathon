import { router } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { CASE_CATEGORIES } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Btn, Chip, Field, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { View } from "react-native";

const LABEL: Record<string, string> = { welfare: "Welfare", scholarship: "Scholarship", education_loan: "Education support" };

export default function Apply() {
  const { user, member } = useAuth();
  const [category, setCategory] = useState<string>("welfare");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    try {
      await addDoc(collection(db, "cases"), {
        applicantId: user!.uid,
        applicantName: member?.fullName ?? "",
        category,
        description: description.trim(),
        amountRequested: Math.trunc(Number(amount)),
        status: "submitted",
        createdAt: serverTimestamp(),
      });
      router.replace("/services/mine");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <RequireAuth eyebrow="Services" title="Ask for help">
      <Screen eyebrow="Services" title="Ask for help" intro="Tell us what you need. A verifier and a trustee will review it. Your details stay private.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CASE_CATEGORIES.map((c) => (
            <Chip key={c} label={LABEL[c]} on={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
        <Field label="What is the need?" value={description} onChangeText={setDescription} multiline />
        <Field label="Amount needed (₹)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
        {err && <Banner error>{err}</Banner>}
        <Btn label="Submit application" onPress={submit} disabled={!description.trim() || !(Number(amount) > 0)} />
      </Screen>
    </RequireAuth>
  );
}
