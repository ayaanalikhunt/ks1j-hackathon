import { useLocalSearchParams } from "expo-router";
import { where } from "firebase/firestore";
import { useLang } from "@/lib/i18n";
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
  const { t } = useLang();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const d = useDocument(id ? `donations/${id}` : null);
  const allocs = useCollection(user && id ? "allocations" : null, [where("donationId", "==", id), where("donorId", "==", uid)], [id, uid]);
  const disbs = useCollection(user && id ? "disbursements" : null, [where("donationId", "==", id), where("donorId", "==", uid)], [id, uid]);
  const [shown, setShown] = useState(false);

  if (d === undefined) return <RequireAuth eyebrow={t("donation.1")} title={t("donation.2")}><Screen eyebrow={t("donation.1")} title={t("donation.2")} /></RequireAuth>;
  if (d === null)
    return (
      <RequireAuth eyebrow={t("donation.1")} title={t("donation.2")}>
        <Screen eyebrow={t("donation.1")} title={t("donation.2")}><Banner>{t("donation.6")}</Banner></Screen>
      </RequireAuth>
    );

  const paid = d.status === "paid";
  const live = allocs.rows.filter((a) => a.status === "allocated");
  const complete = paid && (d.disbursedAmount ?? 0) >= d.amount;
  const proofPending = disbs.rows.some((x) => x.status === "completed" && x.proofStatus !== "verified");
  const receipt = [
    t("dn.receiptHead"),
    t("dn.reference", { v: d.publicReference }),
    d.createdAt ? t("dn.date", { v: formatDate(d.createdAt.toDate()) }) : "",
    t("dn.amount", { v: `${formatRupees(d.amount)}${d.displayCurrency && d.displayCurrency !== "INR" ? ` (${d.displayAmount} ${d.displayCurrency})` : ""}` }),
    t("dn.purpose", { v: PURPOSE_LABELS[d.purpose] ?? t("donation.2") }),
    t("dn.payment", { v: paid ? t("dn.verified") : d.status === "refunded" ? t("donation.13") : t("donation.14") }),
    (d.allocatedAmount ?? 0) > 0 ? t("dn.allocated", { amt: formatRupees(d.allocatedAmount) }) : t("donation.5"),
  ].filter(Boolean).join("\n");

  return (
    <RequireAuth eyebrow={t("donation.1")} title={t("donation.2")}>
      <Screen eyebrow={d.publicReference ?? "Donation"} title={formatRupees(d.amount)} intro={`${PURPOSE_LABELS[d.purpose] ?? "Donation"} · ${donationStage(d as unknown as Parameters<typeof donationStage>[0])}`}>
        <Btn label={t("donation.3")} onPress={() => setShown(!shown)} />
        <Btn quiet label={t("donation.4")} onPress={() => Share.share({ message: receipt })} />

        <Card>
          <Heading>{t("donation.7")}</Heading>
          <Body>{t("dn.reference", { v: d.publicReference })}</Body>
          {d.createdAt ? <Body>{t("dn.date", { v: formatDate(d.createdAt.toDate()) })}</Body> : null}
          <Body>{t("dn.amount", { v: formatRupees(d.amount) })}</Body>
          {d.displayCurrency && d.displayCurrency !== "INR" ? <Body>{t("dn.original", { v: `${d.displayAmount} ${d.displayCurrency}` })}</Body> : null}
          <Body>{t("dn.payment", { v: paid ? t("dn.verified") : d.status === "refunded" ? t("donation.13") : t("donation.14") })}</Body>
          <Body>{(d.allocatedAmount ?? 0) > 0 ? t("dn.allocated", { amt: formatRupees(d.allocatedAmount) }) : t("donation.5")}</Body>
          <Body muted>{t("donation.8")}</Body>
        </Card>

        {shown && (
          <Card>
            <Heading>{t("donation.3")}</Heading>
            {!paid ? (
              <Body muted>{t("donation.9")}</Body>
            ) : (
              <View style={{ gap: 14 }}>
                <Step done title={t("dn.donatedVerified", { amt: formatRupees(d.amount) })} />
                {live.length === 0 ? (
                  <Step done={false} title={t("donation.5")}>
                    <Body muted>{t("donation.10")}</Body>
                  </Step>
                ) : (
                  live.map((a) => (
                    <Step key={a.id} done title={t("dn.allocatedTo", { amt: formatRupees(a.amount), to: a.caseRef ?? (a.caseNumber ? t("dn.caseNum", { n: a.caseNumber }) : t("dn.committeeFund")) })}>
                      <Body muted>{PURPOSE_LABELS[a.category] ?? ""}</Body>
                      {disbs.rows
                        .filter((x) => x.status === "completed" && x.allocationId === a.id)
                        .map((x) => (
                          <Body key={x.id} muted>
                            {x.completedAt ? t("dn.paidOutOn", { amt: formatRupees(x.amount), date: formatDate(x.completedAt.toDate()) }) : t("dn.paidOut", { amt: formatRupees(x.amount) })} ({METHOD[x.method] ?? x.method}) ·{" "}
                            {x.proofStatus === "verified" ? t("donation.15") : t("donation.16")}
                          </Body>
                        ))}
                    </Step>
                  ))
                )}
                <Step done={(d.disbursedAmount ?? 0) > 0} title={t("dn.paidOutOf", { paid: formatRupees(d.disbursedAmount ?? 0), total: formatRupees(d.amount) })} />
                <Step done={complete && !proofPending} title={complete ? t("donation.17") : t("donation.18")}>
                  {complete && proofPending ? <Body muted>{t("donation.11")}</Body> : null}
                </Step>
              </View>
            )}
            <Body muted>{t("donation.12")}</Body>
          </Card>
        )}
      </Screen>
    </RequireAuth>
  );
}
