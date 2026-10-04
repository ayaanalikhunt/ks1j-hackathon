import { addDoc, collection, doc, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { useState } from "react";
import { emiSchedule, formatRupees } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore";

const STATUS: Record<string, string> = {
  applied: "Waiting for a trustee to propose a monthly amount",
  emi_pending_agreement: "Monthly amount proposed. Please review.",
  agreed: "Agreed. Waiting for payout.",
  disbursed: "Paid out",
  repaying: "Repaying",
  closed: "Closed",
  declined: "Declined",
};

export default function Loans() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const { rows, error } = useCollection(user ? "loans" : null, [where("borrowerId", "==", uid)], [uid]);
  const [msg, setMsg] = useState<string | null>(null);

  // accept_loan_emi (family side). The trustee side is recorded by staff on the dashboard.
  const accept = (id: string) =>
    updateDoc(doc(db, "loans", id), { familyAccepted: true }).catch((e) => setMsg((e as Error).message));

  // Money never moves here: this only records a PENDING repayment for the server to confirm.
  const repay = (id: string, amount: number) =>
    addDoc(collection(db, "repayments"), { loanId: id, borrowerId: uid, amount, status: "pending", createdAt: serverTimestamp() })
      .then(() => setMsg("Repayment recorded as pending until payment is confirmed."))
      .catch((e) => setMsg((e as Error).message));

  return (
    <RequireAuth eyebrow="Services" title="My loans">
      <Screen eyebrow="Services" title="My loans" intro="No interest. No late fees. If you fall behind, a person will reach out kindly.">
        {error && <Banner error>{error}</Banner>}
        {msg && <Banner>{msg}</Banner>}
        {rows.length === 0 && <Banner>No loans yet.</Banner>}
        {rows.map((l) => {
          const emi = l.months ? emiSchedule(l.principal, l.months)[0] : null;
          return (
            <Card key={l.id}>
              <Body bold>{formatRupees(l.principal)}</Body>
              <Body muted>{STATUS[l.status] ?? l.status}</Body>
              {emi && (
                <Body>
                  {formatRupees(emi)} a month for {l.months} months
                </Body>
              )}
              {l.status === "emi_pending_agreement" && !l.familyAccepted && <Btn label="I agree to this monthly amount" onPress={() => accept(l.id)} />}
              {["disbursed", "repaying"].includes(l.status) && emi && <Btn label={`Pay ${formatRupees(emi)}`} onPress={() => repay(l.id, emi)} />}
            </Card>
          );
        })}
      </Screen>
    </RequireAuth>
  );
}
