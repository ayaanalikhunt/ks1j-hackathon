import { Link, router } from "expo-router";
import { where } from "firebase/firestore";
import { useLang } from "@/lib/i18n";
import { Pressable } from "react-native";
import { PURPOSE_LABELS, donationStage, formatDate, formatRupees, statementHtml } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/firestore";
import { sharePdf } from "@/lib/pdf";

export default function MyDonations() {
  const { t } = useLang();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const gifts = useCollection(user ? "donations" : null, [where("payerId", "==", uid)], [uid]);
  const notes = useCollection(user ? "notifications" : null, [where("userId", "==", uid)], [uid]);
  const mine = [...gifts.rows].sort((a, b) => (b.createdAt?.seconds ?? 9e9) - (a.createdAt?.seconds ?? 9e9));
  const updates = [...notes.rows].sort((a, b) => (b.at?.seconds ?? 9e9) - (a.at?.seconds ?? 9e9)).slice(0, 5);

  return (
    <RequireAuth eyebrow={t("donations.1")} title={t("donations.2")}>
      <Screen eyebrow={t("donations.1")} title={t("donations.2")} intro={t("donations.3")}>
        {gifts.error && <Banner error>{gifts.error}</Banner>}
        {!gifts.loading && mine.length === 0 && <Banner>{t("donations.6")}</Banner>}
        {mine.map((d) => (
          <Link key={d.id} href={{ pathname: "/give/donation", params: { id: d.id } }} asChild>
            <Pressable>
              <Card>
                <Body muted>{d.publicReference ?? t("donation.2")}</Body>
                <Heading>{formatRupees(d.amount)}</Heading>
                <Body>
                  {PURPOSE_LABELS[d.purpose] ?? t("donation.2")}
                  {d.createdAt ? ` · ${formatDate(d.createdAt.toDate())}` : ""}
                </Body>
                <Body bold>{donationStage(d as unknown as Parameters<typeof donationStage>[0])}</Body>
                <Body muted>
                  {t("dn.listLine", { a: formatRupees(d.allocatedAmount ?? 0), p: formatRupees(d.disbursedAmount ?? 0) })}
                </Body>
              </Card>
            </Pressable>
          </Link>
        ))}
        {updates.length > 0 && (
          <>
            <Heading>{t("donations.7")}</Heading>
            {updates.map((n) => (
              <Card key={n.id}>
                <Body>{n.text}</Body>
                {n.at ? <Body muted>{formatDate(n.at.toDate())}</Body> : null}
              </Card>
            ))}
          </>
        )}
        <Btn label={t("donations.4")} onPress={() => router.push("/give/donate")} />
        {mine.length > 0 && (
          <Btn
            quiet
            label={t("dn.statement")}
            onPress={() =>
              void sharePdf(
                statementHtml(
                  mine.map((d) => ({
                    reference: d.publicReference ?? d.id,
                    createdAt: d.createdAt?.toDate?.() ?? null,
                    amount: d.amount,
                    displayCurrency: d.displayCurrency,
                    displayAmount: d.displayAmount ?? null,
                    purpose: PURPOSE_LABELS[d.purpose] ?? "Donation",
                    status: d.status,
                    allocatedAmount: d.allocatedAmount ?? 0,
                    disbursedAmount: d.disbursedAmount ?? 0,
                  })),
                ),
                t("dn.statement"),
              ).catch(() => {})
            }
          />
        )}
        <Btn quiet label={t("donations.5")} onPress={() => router.push("/give/donor-profile")} />
      </Screen>
    </RequireAuth>
  );
}
