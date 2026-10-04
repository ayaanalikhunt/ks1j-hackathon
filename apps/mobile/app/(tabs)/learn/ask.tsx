import { router, useLocalSearchParams, usePathname } from "expo-router";
import { useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { ASK_MARJAS, COMMAND_SUGGESTIONS, GUIDE_SUGGESTIONS, GUIDE_TOPICS, MARJA_CONFIRMATION, getAskMarja, type AskMarja, type MarjaId } from "@ks1j/shared";
import { RichText } from "@/components/RichText";
import { Banner, Body, Btn, Card, Chip, Field, Heading, Screen } from "@/components/ui";
import { BODY, F } from "@/constants/Type";
import { DESTINATIONS, MARJA_PHOTOS } from "@/lib/askGuide";
import { callFn } from "@/lib/functions";
import { useTheme } from "@/lib/theme";

interface ClarifyOption {
  label: string;
  action: { id: string; routeId?: string };
  path: string | null;
}
interface AskResponse {
  answer?: string;
  answers?: Partial<Record<MarjaId, string>>;
  action?: { id: string; routeId: string };
  path?: string;
  speak?: string;
  opened?: string;
  title?: string;
  clarify?: { speak: string; options: ClarifyOption[] };
}
interface Turn {
  role: "user" | "guide";
  text: string;
  navOk?: boolean;
  title?: string;
}

const ask = (body: unknown) => callFn<AskResponse>("askGuide", body);
/** The message only: some runtimes add the HTTP status in brackets. */
const clean = (e: unknown) => (e as Error).message.replace(/\s*\[\d+\]\s*$/, "");

function Avatar({ id, size = 36 }: { id: MarjaId; size?: number }) {
  const t = useTheme();
  return <Image source={MARJA_PHOTOS[id]} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: t.border }} resizeMode="cover" />;
}

function Guardrail({ marja }: { marja?: AskMarja }) {
  const { t: tr } = useLang();
  return (
    <Banner>
      Guidance guardrail: the AI Guide explains published positions in plain words. It does not issue fatwas, and it will say plainly when it is unsure. {MARJA_CONFIRMATION}{" "}
      {marja ? tr("dn.verifyOn", { site: marja.websiteLabel }) : tr("dn.officialAnswers", { sites: ASK_MARJAS.map((m) => m.websiteLabel).join(", ") })}
    </Banner>
  );
}

function Picker({ onPick, onCompare }: { onPick: (m: AskMarja) => void; onCompare: () => void }) {
  const { t: tr } = useLang();
  const t = useTheme();
  return (
    <>
      <Heading>{tr("askUi.12")}</Heading>
      {ASK_MARJAS.map((m) => (
        <Card key={m.id}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Avatar id={m.id} size={64} />
            <View style={{ flex: 1 }}>
              <Body bold>{m.name}</Body>
              <Body muted>b. {m.born} · {m.city}</Body>
            </View>
          </View>
          <Body muted>{m.bio}</Body>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {m.knownFor.map((k) => (
              <Text key={k} style={{ fontSize: 13, fontFamily: F.semi, color: t.text, backgroundColor: t.tintSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" }}>{k}</Text>
            ))}
          </View>
          <Btn label={tr("dn.askWho", { name: m.name.replace("Ayatollah ", "") })} onPress={() => onPick(m)} />
          <Btn quiet label={tr("dn.officialSite", { site: m.websiteLabel })} onPress={() => Linking.openURL(m.website)} />
        </Card>
      ))}
      <Card>
        <Body bold>{tr("askUi.13")}</Body>
        <Body muted>{tr("askUi.14")}</Body>
        <Btn label={tr("askUi.1")} onPress={onCompare} />
      </Card>
      <Guardrail />
    </>
  );
}

function Chat({ marja, onBack, onCompare, goTo }: { marja: AskMarja; onBack: () => void; onCompare: () => void; goTo: (routeId: string, path: string | undefined, openingText: string, title: string | undefined, openedText: string | undefined) => Promise<Turn[]> }) {
  const { t: tr } = useLang();
  const t = useTheme();
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarify, setClarify] = useState<ClarifyOption[] | null>(null);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = turns.map((x) => ({ role: x.role === "user" ? "user" : "assistant", content: x.text }));
    setTurns((p) => [...p, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    setError(null);
    setClarify(null);
    try {
      const r = await ask({ scholar: marja.id, question, history, currentMarja: marja.id });
      if (r.action) {
        setTurns((p) => [...p, { role: "guide", text: r.speak ?? "Opening…" }]);
        const after = await goTo(r.action.routeId, r.path, r.speak ?? "", r.title, r.opened);
        setTurns((p) => [...p, ...after]);
      } else if (r.clarify) {
        setTurns((p) => [...p, { role: "guide", text: r.clarify!.speak }]);
        setClarify(r.clarify.options);
      } else if (r.answer) {
        setTurns((p) => [...p, { role: "guide", text: r.answer! }]);
      } else {
        setError(tr("dn.noAnswer"));
      }
    } catch (e) {
      setError(clean(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Avatar id={marja.id} size={56} />
          <View style={{ flex: 1 }}>
            <Body muted>{tr("askUi.15")}</Body>
            <Body bold>{marja.honorific}</Body>
          </View>
        </View>
        <Body muted>{marja.role}. Answers explain his published rulings and method.</Body>
        <Btn quiet label={tr("askUi.2")} onPress={onBack} />
        {turns.length === 0 && <Btn quiet label={tr("askUi.1")} onPress={onCompare} />}
      </Card>

      {turns.length === 0 && (
        <Card>
          <Body muted>{tr("askUi.16")}</Body>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {GUIDE_SUGGESTIONS.slice(0, 4).map((s) => <Chip key={s} label={s} onPress={() => void send(s)} />)}
          </View>
          <Body muted>{tr("askUi.17")}</Body>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {COMMAND_SUGGESTIONS.map((s) => <Chip key={s} label={s} on onPress={() => void send(s)} />)}
          </View>
        </Card>
      )}

      {turns.map((x, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8, justifyContent: x.role === "user" ? "flex-end" : "flex-start" }}>
          {x.role === "guide" && <Avatar id={marja.id} />}
          <View style={{ maxWidth: "85%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: x.role === "user" ? t.tint : t.tintSoft }}>
            {x.role === "guide" ? <RichText text={x.text} /> : <RichText text={x.text} color={t.onTint} />}
            {x.navOk === true && <Text style={{ marginTop: 6, fontSize: 14, fontFamily: F.semi, color: t.text }}>✓ Verified: you are on the {x.title ?? "destination"} page.</Text>}
            {x.navOk === false && <Text style={{ marginTop: 6, fontSize: 14, fontFamily: F.semi, color: t.danger }}>✕ Navigation failed. Please use the menu.</Text>}
          </View>
        </View>
      ))}
      {busy && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Avatar id={marja.id} />
          <View style={{ borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: t.tintSoft }}>
            <Text style={{ fontSize: BODY, color: t.muted }}>The guide is thinking…</Text>
          </View>
        </View>
      )}
      {clarify && !busy && (
        <View style={{ gap: 8 }}>
          {clarify.map((o) => (
            <Pressable
              key={o.label}
              accessibilityRole="button"
              onPress={() => {
                setClarify(null);
                if (o.action.routeId) {
                  void goTo(o.action.routeId, o.path ?? undefined, tr("dn.opening"), o.label, tr("dn.opened")).then((after) => setTurns((p) => [...p, ...after]));
                }
              }}
              style={{ borderWidth: 1, borderColor: t.border, backgroundColor: t.tintSoft, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16 }}
            >
              <Text style={{ fontSize: BODY, fontFamily: F.semi, color: t.text }}>{o.action.id === "ASK_FIQH" ? "✋ " : "→ "}{o.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Field label={tr("askUi.3")} value={q} onChangeText={setQ} maxLength={600} placeholder={tr("askUi.4")} returnKeyType="send" onSubmitEditing={() => void send(q)} />
      <Btn label={busy ? tr("askUi.22") : tr("askUi.23")} onPress={() => void send(q)} disabled={busy || !q.trim()} />
      {turns.length > 1 && <Btn quiet label={tr("askUi.5")} onPress={() => { setTurns([]); setError(null); setClarify(null); }} />}
      {error && <Banner error>{error}</Banner>}
      <Guardrail marja={marja} />
    </>
  );
}

function Compare({ onBack }: { onBack: () => void }) {
  const { t: tr } = useLang();
  const [q, setQ] = useState("");
  const [answers, setAnswers] = useState<Partial<Record<MarjaId, string>>>({});
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function all(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setQ(question);
    setAnswers({});
    setBusy(true);
    setAsked(true);
    setError(null);
    try {
      const r = await ask({ scholar: "compare", question });
      if (r.answers) setAnswers(r.answers);
      else setError("Compare mode answers questions of fiqh. For a command such as “open donation”, use a single Marja' chat.");
    } catch (e) {
      setError(clean(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <Body muted>{tr("askUi.18")}</Body>
        <Heading>{tr("askUi.19")}</Heading>
        <Body muted>{tr("askUi.20")}</Body>
        <Btn quiet label={tr("askUi.6")} onPress={onBack} />
      </Card>
      <Field label={tr("askUi.7")} value={q} onChangeText={setQ} maxLength={600} placeholder={tr("askUi.8")} returnKeyType="send" onSubmitEditing={() => void all(q)} />
      <Btn label={busy ? tr("askUi.21") : tr("askUi.24")} onPress={() => void all(q)} disabled={busy || !q.trim()} />
      {!asked && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {GUIDE_SUGGESTIONS.slice(0, 4).map((s) => <Chip key={s} label={s} onPress={() => void all(s)} />)}
        </View>
      )}
      {error && <Banner error>{error}</Banner>}
      {ASK_MARJAS.map((m) => (
        <Card key={m.id}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Avatar id={m.id} size={44} />
            <View style={{ flex: 1 }}>
              <Body bold>{m.name}</Body>
              <Body muted>{m.city}</Body>
            </View>
          </View>
          {busy ? <Body muted>{tr("askUi.21")}</Body> : answers[m.id] ? <RichText text={answers[m.id] as string} /> : asked ? <Body muted>This guide could not answer just now. Please ask again or check {m.websiteLabel}.</Body> : <Body muted>Ask a question above to see {m.name}&apos;s position here.</Body>}
          <Btn quiet label={`Verify on ${m.websiteLabel}`} onPress={() => Linking.openURL(m.website)} />
        </Card>
      ))}
      <Guardrail />
    </>
  );
}

export default function Ask() {
  const { t: tr } = useLang();
  const params = useLocalSearchParams<{ marja?: string; mode?: string }>();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [marja, setMarja] = useState<AskMarja | undefined>(getAskMarja(params.marja));
  const [compare, setCompare] = useState(params.mode === "compare");

  /**
   * Open a page, check we really arrived, and only then say so. Pages the guide handles itself (another Marja', compare)
   * switch the view here. Pages that exist only on the website open there.
   */
  async function goTo(routeId: string, path: string | undefined, _opening: string, title: string | undefined, openedText: string | undefined): Promise<Turn[]> {
    const dest = DESTINATIONS[routeId];
    const done = (ok: boolean): Turn[] => [ok ? { role: "guide", text: openedText ?? "Opened.", navOk: true, title } : { role: "guide", text: "I couldn't open that page right now.", navOk: false }];
    if (!dest) {
      if (path) {
        await Linking.openURL(`https://ks1j-8a2e3.web.app${path}`).catch(() => {});
        return done(true);
      }
      return done(false);
    }
    if ("stay" in dest) {
      if (dest.stay === "select") { setMarja(undefined); setCompare(false); }
      else if (dest.stay === "compare") { setMarja(undefined); setCompare(true); }
      else if (dest.stay !== "here") { setCompare(false); setMarja(getAskMarja(dest.stay)); }
      return done(true);
    }
    if ("web" in dest) {
      try {
        await Linking.openURL(dest.web);
        return done(true);
      } catch {
        return done(false);
      }
    }
    router.push(dest.screen as never);
    await new Promise((r) => setTimeout(r, 450));
    return done(pathRef.current === dest.screen);
  }

  return (
    <Screen eyebrow={tr("askUi.9")} title={tr("askUi.10")} intro={tr("askUi.11")}>
      {!marja && !compare && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {GUIDE_TOPICS.map((tp) => <Chip key={tp} label={tp} onPress={() => {}} />)}
        </View>
      )}
      {compare ? (
        <Compare onBack={() => setCompare(false)} />
      ) : marja ? (
        <Chat key={marja.id} marja={marja} onBack={() => setMarja(undefined)} onCompare={() => { setMarja(undefined); setCompare(true); }} goTo={goTo} />
      ) : (
        <Picker onPick={setMarja} onCompare={() => setCompare(true)} />
      )}
    </Screen>
  );
}
