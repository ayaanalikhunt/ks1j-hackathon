import { where } from "firebase/firestore";
import { formatRupees } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Card, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/firestore";

const STATUS: Record<string, string> = {
  draft: "Draft",
  submitted: "Waiting for a verifier",
  verified: "Verified, waiting for a trustee",
  approved: "Approved",
  disbursed: "Paid out",
  declined: "Declined",
};

export default function Mine() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const { rows, loading, error } = useCollection(user ? "cases" : null, [where("applicantId", "==", uid)], [uid]);
  return (
    <RequireAuth eyebrow="Services" title="My applications">
      <Screen eyebrow="Services" title="My applications">
        {error && <Banner error>{error}</Banner>}
        {!loading && rows.length === 0 && <Banner>You have not applied for anything yet.</Banner>}
        {rows.map((c) => (
          <Card key={c.id}>
            <Body bold>{c.category}</Body>
            <Body>{c.description}</Body>
            <Body muted>
              {formatRupees(c.amountRequested ?? 0)} · {STATUS[c.status] ?? c.status}
            </Body>
          </Card>
        ))}
      </Screen>
    </RequireAuth>
  );
}
