"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ASK_MARJAS, COMMAND_SUGGESTIONS, GUIDE_SUGGESTIONS, GUIDE_TOPICS, MARJA_CONFIRMATION, getAskMarja, type AskMarja, type MarjaId } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Button, Card } from "@/components/ui";
import { auth } from "@/lib/firebase";

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
  lang?: string;
}
interface Turn {
  role: "user" | "guide";
  text: string;
  navOk?: boolean;
  title?: string;
}

const ask = httpsCallable<unknown, AskResponse>(getFunctions(auth.app, "asia-south1"), "askGuide");

// ---- a tiny markdown-ish renderer: paragraphs, **bold**, *italic*, bullets, numbered lines. React nodes only, never raw HTML. ----
function inline(text: string, key: string) {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={`${key}b${i}`}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={`${key}i${i}`}>{part.slice(1, -1)}</em>;
      return <span key={`${key}t${i}`}>{part}</span>;
    });
}

function RichText({ text }: { text: string }) {
  const blocks: { type: "p" | "ul" | "ol"; items: string[] }[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.type === "ul") last.items.push(bullet[1]);
      else blocks.push({ type: "ul", items: [bullet[1]] });
    } else if (numbered) {
      if (last?.type === "ol") last.items.push(numbered[2]);
      else blocks.push({ type: "ol", items: [numbered[2]] });
    } else {
      blocks.push({ type: "p", items: [line.replace(/^#+\s*/, "")] });
    }
  }
  return (
    <div className="space-y-2">
      {blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i} className="leading-relaxed">{inline(b.items[0], `p${i}`)}</p>
        ) : (
          (() => {
            const Tag = b.type === "ul" ? "ul" : "ol";
            return (
              <Tag key={i} className={`ml-5 space-y-1 leading-relaxed ${b.type === "ul" ? "list-disc" : "list-decimal"}`}>
                {b.items.map((it, j) => <li key={j}>{inline(it, `l${i}${j}`)}</li>)}
              </Tag>
            );
          })()
        ),
      )}
    </div>
  );
}

const chip = "min-h-9 rounded-full border border-line bg-card px-3.5 text-left text-sm hover:bg-brand/10";
const gold = "min-h-9 rounded-full border border-gold/50 bg-gold/10 px-3.5 text-left text-sm hover:bg-gold/20";
const scriptOf = (s: string) => (/[઀-૿]/.test(s) ? "gu" : /[ऀ-ॿ]/.test(s) ? "hi" : /[؀-ۿ]/.test(s) ? "ur" : undefined);

function Guardrail({ marja }: { marja?: AskMarja }) {
  return (
    <div className="mt-4">
      <Banner>
        <strong className="text-fg">Guidance guardrail.</strong> The AI Guide explains published positions in plain words. It does not issue fatwas, and it will say plainly when it is unsure. {MARJA_CONFIRMATION}{" "}
        {marja ? (
          <>Verify on <a className="font-medium underline" href={marja.website} target="_blank" rel="noreferrer">{marja.websiteLabel}</a>.</>
        ) : (
          <>Official answers: {ASK_MARJAS.map((m, i) => <span key={m.id}><a className="font-medium underline" href={m.website} target="_blank" rel="noreferrer">{m.websiteLabel}</a>{i < ASK_MARJAS.length - 1 ? ", " : "."}</span>)}</>
        )}
      </Banner>
    </div>
  );
}

function Picker({ onPick, onCompare }: { onPick: (m: AskMarja) => void; onCompare: () => void }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Choose your Marja&apos;</p>
      <h2 className="mt-1 font-display text-2xl sm:text-3xl">Three sources, one guide</h2>
      <div className="mb-6 mt-2.5 h-[3px] w-16 rounded bg-gold" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ASK_MARJAS.map((m) => (
          <div key={m.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.photo} alt={`Portrait of ${m.honorific}`} className="aspect-[4/3] w-full object-cover object-top" loading="lazy" />
            <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
              <p className="text-sm text-muted" dir="rtl" lang="ar">{m.arabicName}</p>
              <h3 className="font-display text-xl leading-tight">{m.name}</h3>
              <p className="mt-0.5 text-sm text-muted">b. {m.born} · {m.city}</p>
              <p className="mt-2.5 line-clamp-3 text-[0.95rem] leading-relaxed text-muted">{m.bio}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Known for">
                {m.knownFor.map((k) => <li key={k} className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium">{k}</li>)}
              </ul>
              <div className="mt-auto flex items-center gap-2 pt-4">
                <Button className="flex-1" onClick={() => onPick(m)}>Ask {m.name.replace("Ayatollah ", "")}</Button>
                <a href={m.website} target="_blank" rel="noreferrer" aria-label={`Official website of ${m.honorific}`} title={`Official website: ${m.websiteLabel}`} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:text-brand">↗</a>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Card className="mt-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-semibold">Not sure whose answer to follow?</p>
          <p className="text-[0.95rem] leading-snug text-muted">Ask all three at once and see each Marja&apos;s position side by side, so you can see where they agree and where they differ.</p>
        </div>
        <Button className="shrink-0 !bg-gold" onClick={onCompare}>★ Compare all three</Button>
      </Card>
      <Guardrail />
      <section className="mt-8" aria-labelledby="how-guide-works">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">How the guide works</p>
        <h2 id="how-guide-works" className="mt-1 font-display text-2xl">Careful by design</h2>
        <div className="mb-6 mt-2.5 h-[3px] w-16 rounded bg-gold" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Grounded in published rulings", "Each answer is framed from the Marja's widely published practical laws, official portals and Q&A services, and the guide will not invent a ruling."],
            ["Honest about uncertainty", "When the guide is not confident of a published position, it says so and points you to the office that can answer for certain."],
            ["Where they differ, you see it", "Compare mode lays all three positions side by side, so taqlid stays an informed choice."],
          ].map(([t, b]) => (
            <Card key={t}><p className="font-semibold">{t}</p><p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{b}</p></Card>
          ))}
        </div>
      </section>
    </>
  );
}

function Avatar({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="mt-0.5 h-9 w-9 shrink-0 rounded-full border border-line object-cover object-top" />;
}

function Chat({ marja, onBack, onCompare }: { marja: AskMarja; onBack: () => void; onCompare: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarify, setClarify] = useState<ClarifyOption[] | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const near = useRef(true);

  // follow new messages only while the reader is already near the bottom
  useEffect(() => {
    if (near.current) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, busy]);

  /** Go to a page, check we really arrived, and only then say so. The guide never claims success for a failed jump. */
  async function go(path: string, openingText: string, title: string | undefined, openedText: string | undefined) {
    setTurns((t) => [...t, { role: "guide", text: openingText }]);
    if (path.startsWith("/member")) {
      window.location.assign(path); // the member app is a separate app: this leaves the page
      return;
    }
    router.push(path);
    await new Promise((r) => setTimeout(r, 450));
    const here = window.location.pathname + window.location.search;
    const same = (a: string, b: string) => a.replace(/\/$/, "").replace("/?", "?") === b.replace(/\/$/, "").replace("/?", "?");
    const ok = same(here, path);
    setTurns((t) => [...t, ok ? { role: "guide", text: openedText ?? "Opened.", navOk: true, title } : { role: "guide", text: "I couldn't open that page right now.", navOk: false }]);
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = turns.map((t) => ({ role: t.role === "user" ? "user" : "assistant", content: t.text }));
    setTurns((t) => [...t, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    setError(null);
    setClarify(null);
    try {
      const r = (await ask({ scholar: marja.id, question, history, currentMarja: marja.id })).data;
      if (r.action && r.path) await go(r.path, r.speak ?? "Opening…", r.title, r.opened);
      else if (r.clarify) {
        setTurns((t) => [...t, { role: "guide", text: r.clarify!.speak }]);
        setClarify(r.clarify.options);
      } else if (r.answer) setTurns((t) => [...t, { role: "guide", text: r.answer! }]);
      else setError("The guide could not answer just now.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={marja.photo} alt={`Portrait of ${marja.honorific}`} className="h-16 w-16 rounded-2xl border border-line object-cover object-top" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Guided by</p>
          <h2 className="font-display text-xl leading-tight">{marja.honorific}</h2>
          <p className="mt-0.5 text-sm text-muted">{marja.role}. Answers explain his published rulings and method.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button className="!min-h-9 !bg-card !px-4 !text-fg border border-line" onClick={onBack}>← Change Marja&apos;</Button>
          {turns.length === 0 && <Button className="!min-h-9 !bg-gold !px-4" onClick={onCompare}>★ Compare all three</Button>}
        </div>
      </Card>

      <Card className="mt-4">
        <div ref={box} onScroll={() => { const el = box.current; if (el) near.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="max-h-[26rem] space-y-3 overflow-y-auto pr-1" aria-live="polite">
          {turns.length === 0 && (
            <div className="py-4">
              <p className="text-center text-muted">Ask about Khums, prayer, fasting, halal income, music, taqlid, or anything from daily life.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {GUIDE_SUGGESTIONS.slice(0, 4).map((s) => <button key={s} type="button" className={chip} onClick={() => void send(s)}>{s}</button>)}
              </div>
              <p className="mt-5 text-center text-sm text-muted">The guide also understands commands in your own words:</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {COMMAND_SUGGESTIONS.map((s) => <button key={s} type="button" lang={scriptOf(s)} className={gold} onClick={() => void send(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={`flex gap-2.5 ${t.role === "user" ? "justify-end" : ""}`}>
              {t.role === "guide" && <Avatar src={marja.photo} />}
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${t.role === "user" ? "rounded-br-md bg-brand text-[var(--bg)]" : "rounded-tl-md bg-brand/10"}`}>
                {t.role === "guide" ? <RichText text={t.text} /> : <p className="whitespace-pre-wrap">{t.text}</p>}
                {t.navOk === true && <p className="mt-2 text-sm font-medium text-brand">✓ Verified: you are on the {t.title ?? "destination"} page.</p>}
                {t.navOk === false && <p className="mt-2 text-sm font-medium text-red-600">✕ Navigation failed. Please use the menu.</p>}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-2.5">
              <Avatar src={marja.photo} />
              <div className="rounded-2xl bg-brand/10 px-4 py-3 text-muted"><span className="inline-flex gap-1" aria-label="Thinking">{[0, 180, 360].map((d) => <span key={d} className="inline-block h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />)}</span></div>
            </div>
          )}
          {clarify && !busy && (
            <div className="flex flex-wrap gap-2" aria-label="Clarification options">
              {clarify.map((o) => (
                <button key={o.label} type="button" className="min-h-10 rounded-full border border-gold bg-gold/10 px-4 text-sm font-semibold" onClick={() => { setClarify(null); if (o.path) void go(o.path, "Opening…", o.label, "Opened."); }}>
                  {o.action.id === "ASK_FIQH" ? "✋ " : "→ "}{o.label}
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(q); }}>
          <input aria-label="Your question" value={q} onChange={(e) => setQ(e.target.value)} maxLength={600} placeholder="Ask in English, ગુજરાતી, हिन्दी, اردو or Roman Urdu…" className="min-h-12 flex-1 rounded-full border border-line bg-bg px-4" />
          <Button type="submit" disabled={busy || !q.trim()} aria-label="Send">{busy ? "…" : "Send"}</Button>
        </form>
        {turns.length > 1 && <button type="button" className="mt-2.5 text-sm text-muted hover:text-fg" onClick={() => { setTurns([]); setError(null); setClarify(null); }}>✕ Start a fresh conversation</button>}
        {error && <div className="mt-3"><Banner kind="error">{error}</Banner></div>}
      </Card>
      <Guardrail marja={marja} />
    </>
  );
}

function Compare({ onBack }: { onBack: () => void }) {
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
      const r = (await ask({ scholar: "compare", question })).data;
      if (r.answers) setAnswers(r.answers);
      else setError("Compare mode answers questions of fiqh. For a command such as “open donation”, use a single Marja' chat.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <div className="flex items-start gap-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">All three, side by side</p>
            <h2 className="mt-0.5 font-display text-xl">One question, three answers</h2>
            <p className="mt-1 text-[0.95rem] leading-snug text-muted">Each guide answers from his own Marja&apos;s published position. Where they differ, you will see it plainly.</p>
          </div>
          <Button className="!min-h-9 shrink-0 !bg-card !px-4 !text-fg border border-line" onClick={onBack}>← Back</Button>
        </div>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void all(q); }}>
          <input aria-label="Your question for all three Maraji" value={q} onChange={(e) => setQ(e.target.value)} maxLength={600} placeholder="e.g. Is listening to music permissible?" className="min-h-12 flex-1 rounded-full border border-line bg-bg px-4" />
          <Button type="submit" className="!bg-gold" disabled={busy || !q.trim()}>{busy ? "Asking…" : "Ask all three"}</Button>
        </form>
        {!asked && <div className="mt-3 flex flex-wrap gap-2">{GUIDE_SUGGESTIONS.slice(0, 4).map((s) => <button key={s} type="button" className={chip} onClick={() => void all(s)}>{s}</button>)}</div>}
        {error && <div className="mt-3"><Banner kind="error">{error}</Banner></div>}
      </Card>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {ASK_MARJAS.map((m) => (
          <Card key={m.id} className="flex min-w-0 flex-col">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.photo} alt={`Portrait of ${m.honorific}`} className="h-11 w-11 rounded-full border border-line object-cover object-top" />
              <div className="min-w-0"><p className="truncate font-semibold">{m.name}</p><p className="text-xs text-muted">{m.city}</p></div>
            </div>
            <div className="mt-3 min-w-0 text-[0.95rem]">
              {busy ? (
                <div className="space-y-2.5" aria-label="Loading answer">{[92, 70, 70, 92, 70].map((w, i) => <div key={i} className="h-3.5 animate-pulse rounded-full bg-brand/10" style={{ width: `${w}%` }} />)}</div>
              ) : answers[m.id] ? (
                <RichText text={answers[m.id] as string} />
              ) : asked ? (
                <p className="text-sm text-muted">This guide could not answer just now. Please ask again or check {m.websiteLabel}.</p>
              ) : (
                <p className="text-sm text-muted">Ask a question above to see {m.name}&apos;s position here.</p>
              )}
            </div>
            <a href={m.website} target="_blank" rel="noreferrer" className="mt-auto inline-flex items-center gap-1 border-t border-line pt-3 text-sm font-medium text-brand hover:underline">Verify on {m.websiteLabel} ↗</a>
          </Card>
        ))}
      </div>
      <Guardrail />
    </>
  );
}

function Guide() {
  const router = useRouter();
  const params = useSearchParams();
  const marja = getAskMarja(params.get("marja"));
  const compare = params.get("mode") === "compare";
  return (
    <>
      <section className="pb-8 pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Ask AI Guide</p>
        <h1 className="mt-2 font-display text-3xl font-bold leading-[1.1] sm:text-4xl">Everyday rulings, explained in plain words</h1>
        <div className="mt-3 h-[3px] w-16 rounded bg-gold" />
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted">
          Ask a question and the AI Guide answers in the voice of one of the three most-followed Maraji&apos; of our time, drawing on their published rulings and methods. Ask in Gujarati, Hindi, Urdu, Roman Urdu, Arabic, Persian or English, or just say what you need:{" "}
          <span className="font-medium text-fg">“દાન ખોલો”</span>, <span className="font-medium text-fg">“donation kholo”</span> or <span className="font-medium text-fg">“mera donation kahan gaya?”</span>, and the guide takes you there. Honest where the Maraji&apos; differ, and clear about what is certain.
        </p>
        {!marja && !compare && (
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Topics the guide covers">
            {GUIDE_TOPICS.map((t) => <span key={t} className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm text-muted">{t}</span>)}
          </div>
        )}
      </section>
      {compare ? (
        <Compare onBack={() => router.push("/ask/")} />
      ) : marja ? (
        <Chat key={marja.id} marja={marja} onBack={() => router.push("/ask/")} onCompare={() => router.push("/ask/?mode=compare")} />
      ) : (
        <Picker onPick={(m) => router.push(`/ask/?marja=${m.id}`)} onCompare={() => router.push("/ask/?mode=compare")} />
      )}
      <p className="mt-8 text-sm text-muted">Looking for something else? <Link className="underline" href="/donate">Donate</Link> · <Link className="underline" href="/transparency">Transparency</Link> · <Link className="underline" href="/contact">Contact</Link></p>
    </>
  );
}

export default function AskPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Suspense fallback={<p className="text-muted">Loading…</p>}>
          <Guide />
        </Suspense>
      </main>
    </>
  );
}
