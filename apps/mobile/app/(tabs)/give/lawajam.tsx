import { where } from "firebase/firestore";
import { formatRupees } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Card, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/firestore";

export default function Lawajam() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const { rows, error } = useCollection(user ? "lawajamRecords" : null, [where("memberId", "==", uid)], [uid]);
  return (
    <RequireAuth eyebrow="Give" title="Lawajam">
      <Screen eyebrow="Give" title="Lawajam" intro="Your household's recurring dues, as recorded by the Jamaat office.">
        {error && <Banner error>{error}</Banner>}
        {rows.length === 0 && <Banner>Nothing recorded for you yet.</Banner>}
        {rows.map((r) => (
          <Card key={r.id}>
            <Body bold>{r.period ?? "Due"}</Body>
            <Body muted>
              {formatRupees(r.amount)} · {r.status ?? "due"}
            </Body>
          </Card>
        ))}
      </Screen>
    </RequireAuth>
  );
}
