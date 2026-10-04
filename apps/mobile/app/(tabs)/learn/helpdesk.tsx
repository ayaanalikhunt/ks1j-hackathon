import { useState } from "react";
import { Banner, Body, Btn, Card, Field, Heading, Screen } from "@/components/ui";
import { useLang } from "@/lib/i18n";
import { useCollection } from "@/lib/firestore";

const STOP = new Set(["the", "a", "an", "is", "are", "of", "to", "and", "for", "in", "on", "what", "how", "do", "i", "my", "can"]);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w));

/**
 * No open-ended generation: an answer is only ever a Jamaat-approved document,
 * always shown with its source. Otherwise we say plainly that we do not know.
 */
export default function Helpdesk() {
  const { t } = useLang();
  const { rows } = useCollection("kbDocuments");
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<string | null>(null);

  const qw = words(asked ?? "");
  const best = rows
    .map((d) => ({ d, score: qw.filter((w) => words(`${d.title} ${d.body}`).includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  return (
    <Screen eyebrow={t("helpdesk.1")} title={t("helpdesk.2")} intro={t("helpdesk.3")}>
      <Field label={t("helpdesk.4")} value={q} onChangeText={setQ} />
      <Btn label={t("helpdesk.5")} onPress={() => setAsked(q)} disabled={!q.trim()} />
      {asked !== null &&
        (best ? (
          <Card>
            <Heading>{best.d.title}</Heading>
            <Body>{best.d.body}</Body>
            <Body muted>Source: {best.d.source}</Body>
          </Card>
        ) : (
          <Banner>{t("helpdesk.6")}</Banner>
        ))}
    </Screen>
  );
}
