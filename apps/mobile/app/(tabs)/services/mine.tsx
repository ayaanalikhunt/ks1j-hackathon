import { where } from "firebase/firestore";
import { CASE_STATUS_LABELS, CATEGORY_LABELS, DECLINE_LABELS, formatRupees, type DeclineReason } from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Card, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useCollection } from "@/lib/firestore";

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
            <Body bold>{CATEGORY_LABELS[c.category] ?? c.category}</Body>
            <Body>{c.requirement ?? c.description}</Body>
            <Body muted>
              {formatRupees(c.amountRequested ?? 0)} · {CASE_STATUS_LABELS[c.status] ?? c.status}
            </Body>
            {c.status === "declined" && (
              <Banner error>
                Not approved: {DECLINE_LABELS[c.declineReason as DeclineReason] ?? "see note"}. {c.declineNote}
              </Banner>
            )}
          </Card>
        ))}
      </Screen>
    </RequireAuth>
  );
}
