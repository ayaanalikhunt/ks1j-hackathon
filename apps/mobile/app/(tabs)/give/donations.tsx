import { Link, router } from "expo-router";
import { where } from "firebase/firestore";
import { useState } from "react";
import { Pressable } from "react-native";
import { PURPOSE_LABELS, donationStage, formatDate, formatDateTime, formatRupees } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/firestore";
import { useLang } from "@/lib/i18n";
import { esc, page, sharePdf } from "@/lib/pdf";

export default function MyDonations() {
  const { user } = useAuth();
  const { t, rtl } = useLang();
  const [pdfError, setPdfError] = useState<string | null>(null);
  const uid = user?.uid ?? "";
  const gifts = useCollection(user ? "donations" : null, [where("payerId", "==", uid)], [uid]);
  const notes = useCollection(user ? "notifications" : null, [where("userId", "==", uid)], [uid]);
  const mine = [...gifts.rows].sort((a, b) => (b.createdAt?.seconds ?? 9e9) - (a.createdAt?.seconds ?? 9e9));
  const updates = [...notes.rows].sort((a, b) => (b.at?.seconds ?? 9e9) - (a.at?.seconds ?? 9e9)).slice(0, 5);

  async function statement() {
    setPdfError(null);
    const paid = mine.filter((d) => d.status === "paid");
    const rows = mine
      .map((d) => `<tr><td>${esc(d.publicReference ?? "")}</td><td>${d.createdAt ? esc(formatDate(d.createdAt.toDate())) : ""}</td><td>${esc(formatRupees(d.amount))}</td><td>${esc(PURPOSE_LABELS[d.purpose] ?? "")}</td><td>${esc(donationStage(d as unknown as Parameters<typeof donationStage>[0]))}</td></tr>`)
      .join("");
    const head = [t("pdf.colRef"), t("pdf.colDate"), t("pdf.colAmount"), t("pdf.colPurpose"), t("pdf.colStatus")].map((h) => `<th>${esc(h)}</th>`).join("");
    const body = `<p class="m">${esc(t("pdf.generated", { date: formatDateTime(new Date()) }))}</p><table><tr>${head}</tr>${rows}</table><p><b>${esc(t("pdf.total", { amount: formatRupees(paid.reduce((n, d) => n + (d.amount ?? 0), 0)) }))}</b></p><p class="m">${esc(t("dd.zeroInterest"))}</p>`;
    try {
      await sharePdf(page(t("pdf.statementTitle"), body, rtl), t("pdf.statementTitle"));
    } catch (e) {
      setPdfError(t("pdf.failed", { error: (e as Error).message }));
    }
  }

  return (
    <RequireAuth eyebrow={t("give.eyebrow")} title={t("md.title")}>
      <Screen eyebrow={t("give.eyebrow")} title={t("md.title")} intro={t("md.intro")}>
        {gifts.error && <Banner error>{gifts.error}</Banner>}
        {!gifts.loading && mine.length === 0 && <Banner>{t("md.none")}</Banner>}
        {mine.map((d) => (
          <Link key={d.id} href={{ pathname: "/give/donation", params: { id: d.id } }} asChild>
            <Pressable>
              <Card>
                <Body muted>{d.publicReference ?? t("md.donation")}</Body>
                <Heading>{formatRupees(d.amount)}</Heading>
                <Body>
                  {PURPOSE_LABELS[d.purpose] ?? t("md.donation")}
                  {d.createdAt ? ` · ${formatDate(d.createdAt.toDate())}` : ""}
                </Body>
                <Body bold>{donationStage(d as unknown as Parameters<typeof donationStage>[0])}</Body>
                <Body muted>
                  {t("md.allocPaid", { allocated: formatRupees(d.allocatedAmount ?? 0), paid: formatRupees(d.disbursedAmount ?? 0) })}
                </Body>
              </Card>
            </Pressable>
          </Link>
        ))}
        {updates.length > 0 && (
          <>
            <Heading>{t("md.updates")}</Heading>
            {updates.map((n) => (
              <Card key={n.id}>
                <Body>{n.text}</Body>
                {n.at ? <Body muted>{formatDate(n.at.toDate())}</Body> : null}
              </Card>
            ))}
          </>
        )}
        {mine.length > 0 && <Btn quiet label={t("pdf.statement")} onPress={statement} />}
        {pdfError ? <Banner error>{pdfError}</Banner> : null}
        <Btn label={t("md.again")} onPress={() => router.push("/give/donate")} />
        <Btn quiet label={t("md.profile")} onPress={() => router.push("/give/donor-profile")} />
      </Screen>
    </RequireAuth>
  );
}
