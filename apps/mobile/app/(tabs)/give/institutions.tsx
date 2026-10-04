import { router } from "expo-router";
import { where } from "firebase/firestore";
import { useLang } from "@/lib/i18n";
import { Banner, Body, Btn, Card, Screen } from "@/components/ui";
import { useCollection } from "@/lib/firestore";

export default function Institutions() {
  const { t } = useLang();
  // Members can only read verified institutions, so the query must say so.
  const { rows } = useCollection("institutions", [where("ijazahVerified", "==", true)]);
  // Sehme Imam goes only to institutions with a verified ijazah from a Marja'.
  const eligible = rows.filter((i) => i.ijazahVerified === true && i.receiving !== false);

  return (
    <Screen eyebrow={t("instUi.1")} title={t("instUi.2")} intro={t("instUi.3")}>
      {eligible.length === 0 && <Banner>{t("instUi.5")}</Banner>}
      {eligible.map((i) => (
        <Card key={i.id}>
          <Body bold>{i.name}</Body>
          {i.marja ? <Body muted>Ijazah: {i.marja}</Body> : null}
          <Btn label={t("instUi.4")} onPress={() => router.push({ pathname: "/give/donate", params: { institutionId: i.id } })} />
        </Card>
      ))}
    </Screen>
  );
}
