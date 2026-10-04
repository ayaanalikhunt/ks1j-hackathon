import { router, useLocalSearchParams } from "expo-router";
import { CASE_TYPE_LABELS, casePublicId, formatRupees, type CaseType } from "@ks1j/shared";
import { Banner, Body, Btn, Card, Screen } from "@/components/ui";
import { useDocument } from "@/lib/firestore";

export default function CaseGive() {
  const { id, fund } = useLocalSearchParams<{ id: string; fund?: string }>();
  const c = useDocument(`publicCases/${id}`);

  if (c === undefined) return <Screen eyebrow="Give" title="Case" />;
  if (c === null)
    return (
      <Screen eyebrow="Give" title="Case">
        <Banner>This case is no longer open for gifts.</Banner>
      </Screen>
    );
  return (
    <Screen
      eyebrow={`${casePublicId(c as { publicCaseId?: string; number?: number })} · ${CASE_TYPE_LABELS[c.type as CaseType] ?? c.category}${c.sadaat ? " · Sadaat" : ""}${c.emergency ? " · Emergency" : ""}`}
      title={`${c.number ? `#${c.number} ` : ""}${c.title || "Give to this case"}`}
      intro={c.description}
    >
      <Card>
        <Body muted>
          {formatRupees(c.amountRaised ?? 0)} raised of {formatRupees(c.amountNeeded ?? 0)}
        </Body>
        <Body muted>A donation: money given without any expectation of repayment.</Body>
      </Card>
      <Btn label="Give to this case" onPress={() => router.push({ pathname: "/give/donate", params: { caseId: c.caseId, fund: fund ?? "" } })} />
    </Screen>
  );
}
