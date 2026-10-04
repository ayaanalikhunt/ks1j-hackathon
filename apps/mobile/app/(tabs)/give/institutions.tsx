import { router } from "expo-router";
import { where } from "firebase/firestore";
import { Banner, Body, Btn, Card, Screen } from "@/components/ui";
import { useCollection } from "@/lib/firestore";

export default function Institutions() {
  // Members can only read verified institutions, so the query must say so.
  const { rows } = useCollection("institutions", [where("ijazahVerified", "==", true)]);
  // Sehme Imam goes only to institutions with a verified ijazah from a Marja'.
  const eligible = rows.filter((i) => i.ijazahVerified === true && i.receiving !== false);

  return (
    <Screen eyebrow="Give" title="Sehme Imam" intro="Only institutions holding a verified ijazah from a Marja' can receive this fund.">
      {eligible.length === 0 && <Banner>No verified institutions yet.</Banner>}
      {eligible.map((i) => (
        <Card key={i.id}>
          <Body bold>{i.name}</Body>
          {i.marja ? <Body muted>Ijazah: {i.marja}</Body> : null}
          <Btn label="Give to this institution" onPress={() => router.push({ pathname: "/give/donate", params: { institutionId: i.id } })} />
        </Card>
      ))}
    </Screen>
  );
}
