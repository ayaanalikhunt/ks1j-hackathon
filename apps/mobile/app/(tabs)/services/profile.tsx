import { router } from "expo-router";
import { LanguagePicker } from "@/components/LanguagePicker";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useDocument } from "@/lib/firestore";
import { useLang } from "@/lib/i18n";

interface Household {
  name: string;
  area: string;
  memberNames?: string[];
}

export default function Profile() {
  const { user, member, signOut } = useAuth();
  const { t } = useLang();
  const m = member as (typeof member & { householdId?: string; membershipVerified?: boolean }) | null;
  const household = useDocument<Household>(m?.householdId ? `households/${m.householdId}` : null);

  return (
    <RequireAuth eyebrow={t("profile.eyebrow")} title={t("profile.title")}>
      <Screen eyebrow={t("profile.eyebrow")} title={t("profile.title")} intro={t("profile.intro")}>
        <Heading>{t("profile.details")}</Heading>
        <Card>
          <Body bold>{m?.fullName}</Body>
          <Body muted>{user?.email}</Body>
          <Body>{t("profile.mobile", { phone: m?.phone ?? "" })}</Body>
          <Body>{m?.membershipVerified ? t("profile.verified") : t("profile.waiting")}</Body>
        </Card>

        <Heading>{t("profile.household")}</Heading>
        {!m?.householdId && <Banner>{t("profile.notLinked")}</Banner>}
        {household && (
          <Card>
            <Body bold>
              {household.name} · {household.area}
            </Body>
            {(household.memberNames ?? []).map((n) => (
              <Body key={n}>
                {n}
                {n === m?.fullName ? ` ${t("profile.you")}` : ""}
              </Body>
            ))}
          </Card>
        )}

        <Heading>{t("profile.language")}</Heading>
        <LanguagePicker />
        <Body muted>{t("profile.languageNote")}</Body>

        <Btn quiet label={t("common.signOut")} onPress={() => signOut().then(() => router.replace("/home"))} />
      </Screen>
    </RequireAuth>
  );
}
