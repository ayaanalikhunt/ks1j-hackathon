import { FeatureCard, Screen } from "@/components/ui";

export default function Give() {
  return (
    <Screen hero eyebrow="Give" title="Giving" intro="Every gift goes to the right fund. Names and contact details of families are never shown.">
      <FeatureCard icon="calculator" title="Khums calculator" desc="Work out what is due" href="/give/khums" />
      <FeatureCard icon="file" title="Lawajam" desc="Your household dues" href="/give/lawajam" />
      <FeatureCard icon="heart" title="Open cases" desc="Give to a family in need" href="/give/cases" />
      <FeatureCard icon="shield" title="Sehme Imam" desc="For verified institutions only" href="/give/institutions" />
    </Screen>
  );
}
