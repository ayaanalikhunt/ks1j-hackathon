import { where } from "firebase/firestore";
import { formatRupees } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Card, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/firestore";

const FUND: Record<string, string> = { sehme_sadaat: "Sehme Sadaat", sehme_imam: "Sehme Imam", general: "General" };

export default function Receipts() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const { rows, error } = useCollection(user ? "donations" : null, [where("payerId", "==", uid)], [uid]);
  return (
    <RequireAuth eyebrow="Services" title="Receipts">
      <Screen eyebrow="Services" title="Receipts" intro="A gift shows as pending until the payment is confirmed.">
        {error && <Banner error>{error}</Banner>}
        {rows.length === 0 && <Banner>No donations yet.</Banner>}
        {rows.map((d) => (
          <Card key={d.id}>
            <Body bold>{formatRupees(d.amount)}</Body>
            <Body muted>
              {FUND[d.fund] ?? d.fund} · {d.status === "paid" ? "Received" : "Pending"}
            </Body>
          </Card>
        ))}
      </Screen>
    </RequireAuth>
  );
}
