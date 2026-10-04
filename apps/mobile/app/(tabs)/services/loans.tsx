import { addDoc, collection, doc, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { useState } from "react";
import { View } from "react-native";
import { LOAN_STATUS_LABELS, formatRupees, minEmi } from "@ks1j/shared";
import { ProofSlot } from "@/components/ProofSlot";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Chip, Field, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore";
import type { ProofPhoto } from "@/lib/photo";

const num = (s: string) => Math.max(0, Math.trunc(Number(s) || 0));
const nice = (d?: string) => (d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }) : "");

/** Asking for a pause or a lower monthly amount. Reminders stop until a trustee decides. */
function Hardship({ loan, onDone }: { loan: any; onDone: (m: string) => void }) {
  const { user } = useAuth();
  const [type, setType] = useState<"pause" | "lower">("pause");
  const [months, setMonths] = useState(2);
  const [newEmi, setNewEmi] = useState("");
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState<ProofPhoto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ok = reason.trim().length >= 10 && (type === "pause" || num(newEmi) > 0);

  async function send() {
    setErr(null);
    try {
      await addDoc(collection(db, "hardships"), {
        loanId: loan.id,
        borrowerId: user!.uid,
        type,
        ...(type === "pause" ? { months } : { newEmi: num(newEmi) }),
        reason: reason.trim(),
        ...(proof ? { proofDataUrl: proof.dataUrl } : {}),
        status: "pending",
        createdAt: serverTimestamp(),
      });
      onDone("Sent. Reminders are paused until a trustee decides. Nothing is added to what you owe.");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Body bold>What would help?</Body>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Chip label="Pause for a few months" on={type === "pause"} onPress={() => setType("pause")} />
        <Chip label="Pay a lower amount" on={type === "lower"} onPress={() => setType("lower")} />
      </View>
      {type === "pause" ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5, 6].map((m) => (
            <Chip key={m} label={`${m} month${m > 1 ? "s" : ""}`} on={months === m} onPress={() => setMonths(m)} />
          ))}
        </View>
      ) : (
        <Field label="The monthly amount you can manage (₹)" value={newEmi} onChangeText={setNewEmi} keyboardType="number-pad" />
      )}
      <Field label="What has changed?" value={reason} onChangeText={setReason} multiline />
      <ProofSlot label="Income proof, if you have it (optional)" value={proof} onChange={setProof} />
      {err && <Banner error>{err}</Banner>}
      <Btn label="Send the request" onPress={send} disabled={!ok} />
    </View>
  );
}

export default function Loans() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const loans = useCollection(user ? "loans" : null, [where("borrowerId", "==", uid)], [uid]);
  const hardships = useCollection(user ? "hardships" : null, [where("borrowerId", "==", uid)], [uid]);
  const repayments = useCollection(user ? "repayments" : null, [where("borrowerId", "==", uid)], [uid]);
  const [msg, setMsg] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Record<string, string>>({});
  const [help, setHelp] = useState<string | null>(null);

  const guard = (p: Promise<unknown>, ok: string) => p.then(() => setMsg(ok)).catch((e) => setMsg((e as Error).message));

  // Money never moves here: this records a PENDING repayment, and the Jamaat office confirms it.
  const repay = (loan: any, amount: number) =>
    guard(
      addDoc(collection(db, "repayments"), { loanId: loan.id, borrowerId: uid, amount, status: "pending", createdAt: serverTimestamp() }),
      "Recorded. It counts once the Jamaat office confirms your payment.",
    );

  return (
    <RequireAuth eyebrow="Services" title="My loans">
      <Screen eyebrow="Services" title="My loans" intro="No interest. No late fees. If you fall behind, a person will reach out kindly.">
        {(loans.error || hardships.error) && <Banner error>{loans.error ?? hardships.error}</Banner>}
        {msg && <Banner>{msg}</Banner>}
        {loans.rows.length === 0 && <Banner>No loans yet.</Banner>}
        {loans.rows.map((l) => {
          const min = minEmi(l.principal);
          const left = l.principal - (l.repaid ?? 0);
          const pendingPay = repayments.rows.some((r) => r.loanId === l.id && r.status === "pending");
          const myHardships = hardships.rows.filter((h) => h.loanId === l.id);
          const waitingHardship = myHardships.some((h) => h.status === "pending");
          return (
            <Card key={l.id}>
              <Body bold>
                {formatRupees(l.principal)} · {l.studentName || "Education loan"}
              </Body>
              <Body muted>
                {l.course}
                {l.institution ? `, ${l.institution}` : ""}
              </Body>
              <Body>{LOAN_STATUS_LABELS[l.status] ?? l.status}</Body>

              {l.status === "applied" && (
                <Body muted>
                  The committee is checking your documents and the details you gave.
                  {l.orphan ? " Because the student is an orphan, someone will also visit your home and call your references." : ""}
                </Body>
              )}

              {l.status === "declined" && <Banner error>Not approved. {l.declineNote}</Banner>}

              {l.status === "emi_pending_agreement" && (
                <View style={{ gap: 8 }}>
                  <Body>The smallest monthly amount is {formatRupees(min)}. A trustee suggested {formatRupees(l.trusteeEmi ?? min)}.</Body>
                  {l.familyEmi ? (
                    <Banner>
                      You proposed {formatRupees(l.familyEmi)} a month.{" "}
                      {l.familyEmi === l.trusteeEmi ? "It matches the trustee's amount. The trustee will now confirm the plan." : "Waiting for the trustee to accept it."}
                    </Banner>
                  ) : null}
                  <Btn
                    label={`Accept ${formatRupees(l.trusteeEmi ?? min)} a month`}
                    onPress={() => guard(updateDoc(doc(db, "loans", l.id), { familyEmi: l.trusteeEmi ?? min }), "Thank you. The trustee will confirm the plan.")}
                    disabled={l.familyEmi === l.trusteeEmi}
                  />
                  <Field
                    label="Or propose your own amount (₹ a month)"
                    value={proposal[l.id] ?? ""}
                    onChangeText={(v) => setProposal((p) => ({ ...p, [l.id]: v }))}
                    keyboardType="number-pad"
                  />
                  <Btn
                    quiet
                    label="Propose this amount"
                    disabled={num(proposal[l.id] ?? "") < min}
                    onPress={() => guard(updateDoc(doc(db, "loans", l.id), { familyEmi: num(proposal[l.id] ?? "") }), "Sent. The trustee will accept it or suggest another amount.")}
                  />
                </View>
              )}

              {l.status === "agreed" && <Body>Agreed: {formatRupees(l.emi)} a month. Waiting for the payout.</Body>}

              {(l.status === "disbursed" || l.status === "repaying") && (
                <View style={{ gap: 8 }}>
                  <Body>
                    {formatRupees(l.emi)} a month · {formatRupees(left)} left
                  </Body>
                  {l.nextDue ? <Body>Next instalment: {nice(l.nextDue)}</Body> : null}
                  {waitingHardship && <Banner>Your request for help is with a trustee. Reminders are paused until they decide.</Banner>}
                  <Btn label={`Pay ${formatRupees(Math.min(l.emi, left))}`} onPress={() => repay(l, Math.min(l.emi, left))} disabled={pendingPay} />
                  {pendingPay && <Body muted>A payment is waiting for the office to confirm.</Body>}
                  <Btn quiet label={help === l.id ? "Close" : "I am finding it hard to pay"} onPress={() => setHelp(help === l.id ? null : l.id)} />
                  {help === l.id && <Hardship loan={l} onDone={(m) => { setMsg(m); setHelp(null); }} />}
                </View>
              )}

              {myHardships.map((h) => (
                <Body key={h.id} muted>
                  {h.type === "pause" ? `Pause for ${h.months} month${h.months > 1 ? "s" : ""}` : `Lower amount ${formatRupees(h.newEmi)}`}:{" "}
                  {h.status === "pending" ? "waiting" : h.status === "approved" ? "approved" : "not approved"}
                </Body>
              ))}
            </Card>
          );
        })}
        <Heading>Need a loan?</Heading>
        <Body muted>Start from Services, Education loan.</Body>
      </Screen>
    </RequireAuth>
  );
}
