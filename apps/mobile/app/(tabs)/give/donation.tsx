import { useLocalSearchParams } from "expo-router";
import { where } from "firebase/firestore";
import { useState } from "react";
import { Share, View } from "react-native";
import { PURPOSE_LABELS, donationStage, formatDate, formatRupees, type MessageKey } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection, useDocument } from "@/lib/firestore";
import { useLang } from "@/lib/i18n";

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
  const { t } = useLang();
  const uid = user?.uid ?? "";
  const d = useDocument(id ? `donations/${id}` : null);
  const allocs = useCollection(user && id ? "allocations" : null, [where("donationId", "==", id), where("donorId", "==", uid)], [id, uid]);
  const disbs = useCollection(user && id ? "disbursements" : null, [where("donationId", "==", id), where("donorId", "==", uid)], [id, uid]);
  const [shown, setShown] = useState(false);

  if (d === undefined) return <RequireAuth eyebrow={t("give.eyebrow")} title={t("md.donation")}><Screen eyebrow={t("give.eyebrow")} title={t("md.donation")} /></RequireAuth>;
  if (d === null)
    return (
      <RequireAuth eyebrow={t("give.eyebrow")} title={t("md.donation")}>
        <Screen eyebrow={t("give.eyebrow")} title={t("md.donation")}><Banner>{t("dd.notFound")}</Banner></Screen>
      </RequireAuth>
    );

  const paid = d.status === "paid";
  const live = allocs.rows.filter((a) => a.status === "allocated");
  const complete = paid && (d.disbursedAmount ?? 0) >= d.amount;
  const proofPending = disbs.rows.some((x) => x.status === "completed" && x.proofStatus !== "verified");
  const payment = paid ? t("dd.verified") : d.status === "refunded" ? t("dd.refunded") : t("dd.pending");
  const method = (m: string) => (["bank_transfer", "upi", "cash", "direct_to_provider", "other"].includes(m) ? t(`dd.m.${m}` as MessageKey) : m);
  const receipt = [
    t("dd.receiptTitle"),
    t("dd.reference", { value: d.publicReference }),
    d.createdAt ? t("dd.date", { value: formatDate(d.createdAt.toDate()) }) : "",
    t("dd.amount", { value: `${formatRupees(d.amount)}${d.displayCurrency && d.displayCurrency !== "INR" ? ` (${d.displayAmount} ${d.displayCurrency})` : ""}` }),
    t("dd.purpose", { value: PURPOSE_LABELS[d.purpose] ?? t("md.donation") }),
    t("dd.payment", { value: payment }),
    (d.allocatedAmount ?? 0) > 0 ? t("dd.allocLine", { amount: formatRupees(d.allocatedAmount) }) : t("dd.allocPending"),
  ].filter(Boolean).join("\n");

  return (
    <RequireAuth eyebrow={t("give.eyebrow")} title={t("md.donation")}>
      <Screen eyebrow={d.publicReference ?? t("md.donation")} title={formatRupees(d.amount)} intro={`${PURPOSE_LABELS[d.purpose] ?? t("md.donation")} · ${donationStage(d as unknown as Parameters<typeof donationStage>[0])}`}>
        <Btn label={t("dd.where")} onPress={() => setShown(!shown)} />
        <Btn quiet label={t("dd.share")} onPress={() => Share.share({ message: receipt })} />

        <Card>
          <Heading>{t("dd.receipt")}</Heading>
          <Body>{t("dd.reference", { value: d.publicReference })}</Body>
          {d.createdAt ? <Body>{t("dd.date", { value: formatDate(d.createdAt.toDate()) })}</Body> : null}
          <Body>{t("dd.amount", { value: formatRupees(d.amount) })}</Body>
          {d.displayCurrency && d.displayCurrency !== "INR" ? <Body>{t("dd.original", { value: `${d.displayAmount} ${d.displayCurrency}` })}</Body> : null}
          <Body>{t("dd.payment", { value: payment })}</Body>
          <Body>{(d.allocatedAmount ?? 0) > 0 ? t("dd.allocated", { amount: formatRupees(d.allocatedAmount) }) : t("dd.allocPending")}</Body>
          <Body muted>{t("dd.zeroInterest")}</Body>
        </Card>

        {shown && (
          <Card>
            <Heading>{t("dd.where")}</Heading>
            {!paid ? (
              <Body muted>{t("dd.notVerified")}</Body>
            ) : (
              <View style={{ gap: 14 }}>
                <Step done title={t("dd.donatedVerified", { amount: formatRupees(d.amount) })} />
                {live.length === 0 ? (
                  <Step done={false} title={t("dd.allocPending")}>
                    <Body muted>{t("dd.noAllocYet")}</Body>
                  </Step>
                ) : (
                  live.map((a) => (
                    <Step key={a.id} done title={t("dd.allocatedTo", { amount: formatRupees(a.amount), target: a.caseRef ?? (a.caseNumber ? t("dd.caseNo", { n: a.caseNumber }) : t("dd.committeeFund")) })}>
                      <Body muted>{PURPOSE_LABELS[a.category] ?? ""}</Body>
                      {disbs.rows
                        .filter((x) => x.status === "completed" && x.allocationId === a.id)
                        .map((x) => (
                          <Body key={x.id} muted>
                            {t("dd.paidOutLine", {
                              amount: formatRupees(x.amount),
                              on: x.completedAt ? t("dd.on", { date: formatDate(x.completedAt.toDate()) }) : "",
                              method: method(x.method),
                              proof: x.proofStatus === "verified" ? t("dd.proofVerified") : t("dd.proofPending"),
                            })}
                          </Body>
                        ))}
                    </Step>
                  ))
                )}
                <Step done={(d.disbursedAmount ?? 0) > 0} title={t("dd.paidOfTotal", { paid: formatRupees(d.disbursedAmount ?? 0), total: formatRupees(d.amount) })} />
                <Step done={complete && !proofPending} title={complete ? t("dd.complete") : t("dd.inProgress")}>
                  {complete && proofPending ? <Body muted>{t("dd.paidProofPending")}</Body> : null}
                </Step>
              </View>
            )}
            <Body muted>{t("dd.private")}</Body>
          </Card>
        )}
      </Screen>
    </RequireAuth>
  );
}
