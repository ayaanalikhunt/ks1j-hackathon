import { useState } from "react";
import { KHUMS_DISCLAIMER, formatRupees, khumsDue, khumsSplit } from "@ks1j/shared";
import { Banner, Body, Card, Field, FeatureCard, Heading, Screen } from "@/components/ui";

export default function Give() {
  const [savings, setSavings] = useState("");
  const n = Math.trunc(Number(savings));
  const valid = savings !== "" && Number.isFinite(n) && n >= 0;
  const due = valid ? khumsDue(n) : 0;
  const { imam, sadaat } = khumsSplit(due);
  return (
    <Screen hero eyebrow="Give" title="Give" intro="Every rupee goes through the Jamaat's account and is recorded.">
      <Heading>Khums estimate</Heading>
      <Card>
        <Field label="Savings left at your Khums year-end (₹)" value={savings} onChangeText={setSavings} keyboardType="number-pad" />
        <Body muted>Khums due (20%)</Body>
        <Heading>{formatRupees(due)}</Heading>
        <Body>Sehme Imam: {formatRupees(imam)}</Body>
        <Body>Sehme Sadaat: {formatRupees(sadaat)}</Body>
        <Banner>{KHUMS_DISCLAIMER} This is a guide only.</Banner>
      </Card>
      <FeatureCard icon="calculator" title="Full Khums calculator" desc="Set your year-end, save your calculation, track what is left to pay." href="/give/khums" />
      <FeatureCard icon="shield" title="Pay Sehme Imam" desc="Goes only to institutions holding ijazah from a Marja'." href="/give/institutions" />
      <FeatureCard icon="heart" title="Pay Sehme Sadaat" desc="Goes only to verified Sadaat (Syed) cases. Pick a case to give." href="/give/cases?filter=sadaat&fund=sehme_sadaat" />

      <Heading>Support a case</Heading>
      <FeatureCard icon="heart" title="Sadaat cases" desc="Verified needs, approved by two Jamaat admins." href="/give/cases?filter=sadaat" />
      <FeatureCard icon="heart" title="Non-Sadaat cases" desc="Verified needs, approved by two Jamaat admins." href="/give/cases?filter=other" />

      <Heading>Dues</Heading>
      <FeatureCard icon="file" title="Lawajam" desc="See what is due, pay and see receipts." href="/give/lawajam" />
    </Screen>
  );
}
