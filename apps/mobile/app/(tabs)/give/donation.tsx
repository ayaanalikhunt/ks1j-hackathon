import { useLocalSearchParams } from "expo-router";
import { where } from "firebase/firestore";
import { useState } from "react";
import { Share, View } from "react-native";
import { PURPOSE_LABELS, donationStage, formatDate, formatRupees } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection, useDocument } from "@/lib/firestore";

const METHOD: Record<string, string> = { bank_transfer: "Bank transfer", upi: "UPI", cash: "Cash", direct_to_provider: "Paid directly to the provider", other: "Other" };

function Step({ done, title, children }: { done: boolean; title: string; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 6, backgroundColor: done ? "#0b4d3a" : "transparent", borderWidth: 1, borderColor: "#0b4d3a" }} />
      <View style={{ flex: 1 }}>
        <Body bold>{title}</Body>
        {children}
      </View>
    </View>
  );
}

export default function DonationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const d = useDocument(id ? `donations/${id}` : null);
  const allocs = useCollection(user && id ? "allocations" : null, [where("donationId", "==", id), where("donorId", "==", uid)], [id, uid]);
  const disbs = useCollection(user && id ? "disbursements" : null, [where("donationId", "==", id), where("donorId", "==", uid)], [id, uid]);
  const [shown, setShown] = useState(false);

  if (d === undefined) return <RequireAuth eyebrow="Give" title="Donation"><Screen eyebrow="Give" title="Donation" /></RequireAuth>;
  if (d === null)
    return (
      <RequireAuth eyebrow="Give" title="Donation">
        <Screen eyebrow="Give" title="Donation"><Banner>We could not find that donation.</Banner></Screen>
      </RequireAuth>
    );

  const paid = d.status === "paid";
  const live = allocs.rows.filter((a) => a.status === "allocated");
  const complete = paid && (d.disbursedAmount ?? 0) >= d.amount;
  const proofPending = disbs.rows.some((x) => x.status === "completed" && x.proofStatus !== "verified");
  const receipt = [
    "KS1J donation receipt",
    `Reference: ${d.publicReference}`,
    d.createdAt ? `Date: ${formatDate(d.createdAt.toDate())}` : "",
    `Amount: ${formatRupees(d.amount)}${d.displayCurrency && d.displayCurrency !== "INR" ? ` (${d.displayAmount} ${d.displayCurrency})` : ""}`,
    `Purpose: ${PURPOSE_LABELS[d.purpose] ?? "Donation"}`,
    `Payment: ${paid ? "Verified" : d.status === "refunded" ? "Refunded" : "Pending"}`,
    (d.allocatedAmount ?? 0) > 0 ? `Allocated: ${formatRupees(d.allocatedAmount)}` : "Allocation pending",
  ].filter(Boolean).join("\n");

  return (
    <RequireAuth eyebrow="Give" title="Donation">
      <Screen eyebrow={d.publicReference ?? "Donation"} title={formatRupees(d.amount)} intro={`${PURPOSE_LABELS[d.purpose] ?? "Donation"} · ${donationStage(d as unknown as Parameters<typeof donationStage>[0])}`}>
        <Btn label="Where did my donation go?" onPress={() => setShown(!shown)} />
        <Btn quiet label="Share receipt" onPress={() => Share.share({ message: receipt })} />

        <Card>
          <Heading>Receipt</Heading>
          <Body>Reference: {d.publicReference}</Body>
          {d.createdAt ? <Body>Date: {formatDate(d.createdAt.toDate())}</Body> : null}
          <Body>Amount: {formatRupees(d.amount)}</Body>
          {d.displayCurrency && d.displayCurrency !== "INR" ? <Body>Original: {d.displayAmount} {d.displayCurrency}</Body> : null}
          <Body>Payment: {paid ? "Verified" : d.status === "refunded" ? "Refunded" : "Pending"}</Body>
          <Body>{(d.allocatedAmount ?? 0) > 0 ? `${formatRupees(d.allocatedAmount)} allocated` : "Allocation pending"}</Body>
          <Body muted>Zero interest, zero late fees. This shows only what the committee has recorded.</Body>
        </Card>

        {shown && (
          <Card>
            <Heading>Where did my donation go?</Heading>
            {!paid ? (
              <Body muted>This payment has not been verified yet, so nothing has been allocated.</Body>
            ) : (
              <View style={{ gap: 14 }}>
                <Step done title={`${formatRupees(d.amount)} donated and verified`} />
                {live.length === 0 ? (
                  <Step done={false} title="Allocation pending">
                    <Body muted>The committee has not allocated this donation yet. We never say it has helped someone before it has.</Body>
                  </Step>
                ) : (
                  live.map((a) => (
                    <Step key={a.id} done title={`${formatRupees(a.amount)} allocated to ${a.caseRef ?? (a.caseNumber ? `Case #${a.caseNumber}` : "the committee's fund")}`}>
                      <Body muted>{PURPOSE_LABELS[a.category] ?? ""}</Body>
                      {disbs.rows
                        .filter((x) => x.status === "completed" && x.allocationId === a.id)
                        .map((x) => (
                          <Body key={x.id} muted>
                            {formatRupees(x.amount)} paid out{x.completedAt ? ` on ${formatDate(x.completedAt.toDate())}` : ""} ({METHOD[x.method] ?? x.method}) ·{" "}
                            {x.proofStatus === "verified" ? "proof verified by the committee" : "supporting documentation pending committee verification"}
                          </Body>
                        ))}
                    </Step>
                  ))
                )}
                <Step done={(d.disbursedAmount ?? 0) > 0} title={`${formatRupees(d.disbursedAmount ?? 0)} of ${formatRupees(d.amount)} paid out`} />
                <Step done={complete && !proofPending} title={complete ? "Complete" : "In progress"}>
                  {complete && proofPending ? <Body muted>Paid out in full. Supporting documentation is awaiting committee verification.</Body> : null}
                </Step>
              </View>
            )}
            <Body muted>Family names, addresses and documents are private. A donation does not give access to a beneficiary&apos;s details.</Body>
          </Card>
        )}
      </Screen>
    </RequireAuth>
  );
}
