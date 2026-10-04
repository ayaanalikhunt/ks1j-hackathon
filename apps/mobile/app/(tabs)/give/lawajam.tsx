import { addDoc, collection, serverTimestamp, where } from "firebase/firestore";
import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { formatRupees } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore";

export default function Lawajam() {
  const { t } = useLang();
  const { user, member } = useAuth();
  const uid = user?.uid ?? "";
  const hid = (member as { householdId?: string } | null)?.householdId;
  const records = useCollection(hid ? "lawajamRecords" : null, [where("householdId", "==", hid ?? "")], [hid]);
  const payments = useCollection(user ? "lawajamPayments" : null, [where("payerId", "==", uid)], [uid]);
  const [msg, setMsg] = useState<string | null>(null);

  // Money never moves here: this records a PENDING payment, and the Jamaat office confirms it.
  const pay = (r: { id: string; householdId: string; year: string; amount: number }) =>
    addDoc(collection(db, "lawajamPayments"), {
      recordId: r.id,
      householdId: r.householdId,
      year: r.year,
      amount: r.amount,
      payerId: uid,
      status: "pending",
      createdAt: serverTimestamp(),
    })
      .then(() => setMsg("Recorded. It shows as paid once the Jamaat office confirms your payment."))
      .catch((e) => setMsg((e as Error).message));

  const pendingFor = (rid: string) => payments.rows.some((p) => p.recordId === rid && p.status === "pending");
  const rows = [...records.rows].sort((a, b) => String(b.year).localeCompare(String(a.year)));

  return (
    <RequireAuth eyebrow={t("lawajamUi.1")} title={t("lawajamUi.2")}>
      <Screen eyebrow={t("lawajamUi.1")} title={t("lawajamUi.2")} intro={t("lawajamUi.3")}>
        {!hid && (
          <Banner>{t("lawajamUi.4")}</Banner>
        )}
        {hid && rows.length === 0 && <Banner>{t("lawajamUi.5")}</Banner>}
        {rows.map((r) => (
          <Card key={r.id}>
            <Body bold>{r.year}</Body>
            <Body muted>
              {r.householdName} · {formatRupees(r.amount)}
            </Body>
            <Body>{r.status === "paid" ? "Paid. Thank you." : pendingFor(r.id) ? t("lawajamUi.6") : t("lawajamUi.7")}</Body>
            {r.status === "due" && !pendingFor(r.id) && <Btn label={`Pay ${formatRupees(r.amount)}`} onPress={() => pay(r as never)} />}
          </Card>
        ))}
        {msg && <Banner>{msg}</Banner>}
      </Screen>
    </RequireAuth>
  );
}
