import { addDoc, collection, serverTimestamp, where } from "firebase/firestore";
import { router } from "expo-router";
import { useState } from "react";
import { KHUMS_DISCLAIMER, formatRupees, isoToDmy, khumsDue, khumsSplit, parseDmy } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Field, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore";

export default function Khums() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const [yearEnd, setYearEnd] = useState("");
  const [savings, setSavings] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const saved = useCollection(user ? "khumsCalculations" : null, [where("memberId", "==", uid)], [uid]);
  const gifts = useCollection(user ? "donations" : null, [where("payerId", "==", uid)], [uid]);

  const n = Math.trunc(Number(savings));
  const valid = savings !== "" && Number.isFinite(n) && n >= 0;
  const due = valid ? khumsDue(n) : 0;
  const split = khumsSplit(due);
  const isoEnd = parseDmy(yearEnd);
  const okDate = isoEnd !== null;

  // The latest saved calculation, and what has been paid since it was saved.
  const latest = [...saved.rows].sort((a, b) => (b.createdAt?.seconds ?? 9e9) - (a.createdAt?.seconds ?? 9e9))[0];
  const since = latest?.createdAt?.seconds ?? 0;
  const paid = (fund: string) =>
    gifts.rows.filter((g) => g.fund === fund && g.status === "paid" && (g.createdAt?.seconds ?? 0) >= since).reduce((s, g) => s + g.amount, 0);
  const left = latest
    ? { imam: Math.max(0, (latest.imam ?? 0) - paid("sehme_imam")), sadaat: Math.max(0, (latest.sadaat ?? 0) - paid("sehme_sadaat")) }
    : null;

  async function save() {
    try {
      await addDoc(collection(db, "khumsCalculations"), {
        memberId: uid,
        yearEnd: isoEnd,
        surplus: n,
        due,
        imam: split.imam,
        sadaat: split.sadaat,
        createdAt: serverTimestamp(),
      });
      setMsg("Saved. Pay it from the buttons below and it counts off what is left.");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <RequireAuth eyebrow="Give" title="Khums calculator">
      <Screen
        eyebrow="Give"
        title="Khums calculator"
        intro="Enter what is left in savings at your Khums year-end. Khums is one fifth, shared equally between Sehme Imam and Sehme Sadaat."
      >
        <Field label="Your Khums year-end (DD/MM/YYYY)" value={yearEnd} onChangeText={setYearEnd} placeholder="30/09/2026" />
        <Field label="Savings left at year-end (₹)" value={savings} onChangeText={setSavings} keyboardType="number-pad" />
        {valid && (
          <Card>
            <Body muted>Khums due (20%)</Body>
            <Heading>{formatRupees(due)}</Heading>
            <Body>Sehme Imam: {formatRupees(split.imam)}</Body>
            <Body>Sehme Sadaat: {formatRupees(split.sadaat)}</Body>
          </Card>
        )}
        <Banner>{KHUMS_DISCLAIMER}</Banner>
        <Btn label="Save this calculation" onPress={save} disabled={!valid || !okDate} />
        {msg && <Banner>{msg}</Banner>}

        {latest && left && (
          <>
            <Heading>What is left to pay</Heading>
            <Card>
              <Body muted>From your calculation for the year ending {isoToDmy(latest.yearEnd)}</Body>
              <Body>
                Sehme Imam left: {formatRupees(left.imam)} of {formatRupees(latest.imam ?? 0)}
              </Body>
              <Body>
                Sehme Sadaat left: {formatRupees(left.sadaat)} of {formatRupees(latest.sadaat ?? 0)}
              </Body>
            </Card>
            <Btn label="Pay Sehme Imam" onPress={() => router.push("/give/institutions")} />
            <Btn label="Pay Sehme Sadaat" onPress={() => router.push("/give/cases?filter=sadaat&fund=sehme_sadaat")} />
          </>
        )}
      </Screen>
    </RequireAuth>
  );
}
