import { where } from "firebase/firestore";
import { Share } from "react-native";
import { FUND_LABELS, formatDateTime, formatRupees } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/firestore";

interface Receipt {
  id: string;
  what: string;
  amount: number;
  paid: boolean;
  at: number;
}

const dateOf = (s?: { seconds: number }) => formatDateTime(s);

export default function Receipts() {
  const { user, member } = useAuth();
  const uid = user?.uid ?? "";
  const gifts = useCollection(user ? "donations" : null, [where("payerId", "==", uid)], [uid]);
  const dues = useCollection(user ? "lawajamPayments" : null, [where("payerId", "==", uid)], [uid]);
  const error = gifts.error ?? dues.error;

  const all: Receipt[] = [
    ...gifts.rows.map((d) => ({ id: d.id, what: FUND_LABELS[d.fund] ?? d.fund, amount: d.amount, paid: d.status === "paid", at: d.createdAt?.seconds ?? 0, date: dateOf(d.createdAt) })),
    ...dues.rows.map((d) => ({ id: d.id, what: `Lawajam ${d.year}`, amount: d.amount, paid: d.status === "paid", at: d.createdAt?.seconds ?? 0, date: dateOf(d.createdAt) })),
  ]
    .map((r) => r as Receipt & { date: string })
    .sort((a, b) => b.at - a.at);

  // A receipt is only a receipt once the office has confirmed the money. Until then it is a pledge.
  const share = (r: Receipt & { date: string }) =>
    Share.share({
      message: `KS1J receipt\nReceipt no: ${r.id.slice(0, 8).toUpperCase()}\nFor: ${r.what}\nAmount: ${formatRupees(r.amount)}\nFrom: ${member?.fullName ?? ""}\nDate: ${r.date}\nReceived with thanks by the Jamaat.`,
    });

  return (
    <RequireAuth eyebrow="Services" title="Receipts">
      <Screen eyebrow="Services" title="Receipts" intro="A gift shows as pending until the office confirms the payment. Then you can share your receipt.">
        {error && <Banner error>{error}</Banner>}
        {all.length === 0 && <Banner>No payments yet.</Banner>}
        {all.map((r) => (
          <Card key={r.id}>
            <Body bold>{formatRupees(r.amount)}</Body>
            <Body muted>
              {r.what} · {r.paid ? "Received" : "Pending"} · {(r as Receipt & { date: string }).date}
            </Body>
            {r.paid && <Btn quiet label="Share receipt" onPress={() => share(r as Receipt & { date: string })} />}
          </Card>
        ))}
      </Screen>
    </RequireAuth>
  );
}
