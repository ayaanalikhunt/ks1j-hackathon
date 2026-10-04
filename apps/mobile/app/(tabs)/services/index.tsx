import { FeatureCard, Screen } from "@/components/ui";

export default function Services() {
  return (
    <Screen eyebrow="Services" title="How can we help?" intro="Welfare, scholarships and education loans. Every application is checked by two different people.">
      <FeatureCard icon="heart" title="Ask for help" desc="Welfare or scholarship application" href="/services/apply" />
      <FeatureCard icon="file" title="My applications" desc="See where each one stands" href="/services/mine" />
      <FeatureCard icon="coin" title="Education loan" desc="Zero interest, no late fees" href="/services/loan-apply" />
      <FeatureCard icon="shield" title="My loans" desc="Agree your EMI and repay" href="/services/loans" />
      <FeatureCard icon="receipt" title="Receipts" desc="Your donations and their status" href="/services/receipts" />
    </Screen>
  );
}
