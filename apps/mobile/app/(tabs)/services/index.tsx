import { FeatureCard, Screen } from "@/components/ui";
import { useLang } from "@/lib/i18n";

export default function Services() {
  const { t } = useLang();
  return (
    <Screen hero eyebrow={t("svc.eyebrow")} title={t("svc.title")} intro={t("svc.intro")}>
      <FeatureCard icon="heart" title={t("svc.apply.t")} desc={t("svc.apply.d")} href="/services/apply" />
      <FeatureCard icon="file" title={t("svc.mine.t")} desc={t("svc.mine.d")} href="/services/mine" />
      <FeatureCard icon="coin" title={t("svc.loanApply.t")} desc={t("svc.loanApply.d")} href="/services/loan-apply" />
      <FeatureCard icon="shield" title={t("svc.loans.t")} desc={t("svc.loans.d")} href="/services/loans" />
      <FeatureCard icon="user" title={t("svc.profile.t")} desc={t("svc.profile.d")} href="/services/profile" />
      <FeatureCard icon="pin" title={t("svc.mosques.t")} desc={t("svc.mosques.d")} href="/services/mosques" />
      <FeatureCard icon="receipt" title={t("svc.receipts.t")} desc={t("svc.receipts.d")} href="/services/receipts" />
    </Screen>
  );
}
