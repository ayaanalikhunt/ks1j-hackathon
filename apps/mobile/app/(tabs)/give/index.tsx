import { useState } from "react";
import { formatRupees, khumsDue, khumsSplit } from "@ks1j/shared";
import { useLang } from "@/lib/i18n";
import { Banner, Body, Card, Field, FeatureCard, Heading, Screen } from "@/components/ui";

export default function Give() {
  const { t } = useLang();
  const [savings, setSavings] = useState("");
  const n = Math.trunc(Number(savings));
  const valid = savings !== "" && Number.isFinite(n) && n >= 0;
  const due = valid ? khumsDue(n) : 0;
  const { imam, sadaat } = khumsSplit(due);
  return (
    <Screen hero eyebrow={t("give.eyebrow")} title={t("give.title")} intro={t("give.intro")}>
      <Heading>{t("give.khumsEstimate")}</Heading>
      <Card>
        <Field label={t("give.savings")} value={savings} onChangeText={setSavings} keyboardType="number-pad" />
        <Body muted>{t("give.khumsDue")}</Body>
        <Heading>{formatRupees(due)}</Heading>
        <Body>{t("give.imam", { amount: formatRupees(imam) })}</Body>
        <Body>{t("give.sadaat", { amount: formatRupees(sadaat) })}</Body>
        <Banner>{t("give.disclaimer")} {t("give.guideOnly")}</Banner>
      </Card>
      <FeatureCard icon="heart" title="Donate" desc="Give to the general fund. Choose a purpose and see where it goes." href="/give/donate" />
      <FeatureCard icon="file" title="My donations" desc="Receipts, and where each donation went." href="/give/donations" />
      <FeatureCard icon="calculator" title={t("give.calc.t")} desc={t("give.calc.d")} href="/give/khums" />
      <FeatureCard icon="shield" title={t("give.payImam.t")} desc={t("give.payImam.d")} href="/give/institutions" />
      <FeatureCard icon="heart" title={t("give.paySadaat.t")} desc={t("give.paySadaat.d")} href="/give/cases?filter=sadaat&fund=sehme_sadaat" />

      <Heading>{t("give.supportCase")}</Heading>
      <FeatureCard icon="heart" title={t("give.sadaatCases.t")} desc={t("give.cases.d")} href="/give/cases?filter=sadaat" />
      <FeatureCard icon="heart" title={t("give.nonSadaatCases.t")} desc={t("give.cases.d")} href="/give/cases?filter=other" />

      <Heading>{t("give.dues")}</Heading>
      <FeatureCard icon="file" title={t("give.lawajam.t")} desc={t("give.lawajam.d")} href="/give/lawajam" />
    </Screen>
  );
}
