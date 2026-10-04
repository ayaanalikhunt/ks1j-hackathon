import { useState } from "react";
import { Banner, Body, Btn, Card, Field, Heading, Screen } from "@/components/ui";
import { useCollection } from "@/lib/firestore";
import { useLang } from "@/lib/i18n";

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
    <Screen eyebrow={t("learn.eyebrow")} title={t("hd.title")} intro={t("hd.intro")}>
      <Field label={t("hd.question")} value={q} onChangeText={setQ} />
      <Btn label={t("hd.ask")} onPress={() => setAsked(q)} disabled={!q.trim()} />
      {asked !== null &&
        (best ? (
          <Card>
            <Heading>{best.d.title}</Heading>
            <Body>{best.d.body}</Body>
            <Body muted>{t("hd.source", { source: best.d.source })}</Body>
          </Card>
        ) : (
          <Banner>{t("hd.unknown")}</Banner>
        ))}
    </Screen>
  );
}
