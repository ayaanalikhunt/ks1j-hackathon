"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { Suspense, useEffect, useState } from "react";
import { PURPOSE_LABELS, RESTRICTED_PURPOSES, VISIBILITY_LABELS, formatDateTime, formatRupees } from "@ks1j/shared";
import { SiteHeader } from "@/components/SiteHeader";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { auth, db } from "@/lib/firebase";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "SGD", "QAR", "KWD"];
const fns = getFunctions(auth.app, "asia-south1");
const quoteFn = httpsCallable<unknown, Quote>(fns, "quoteDonation");
const orderFn = httpsCallable<unknown, { donationId: string; orderId: string; keyId: string; reference: string }>(fns, "createDonationOrder");
const verifyFn = httpsCallable<unknown, { ok: boolean; reference: string }>(fns, "verifyRazorpayPayment");

interface Quote {
  displayCurrency: string;
  displayAmount: number;
  exchangeRate: number;
  fxMarkupPercent: number;
  fxMarkupAmount: number;
  effectiveRate: number;
  convertedAtBaseRate: number;
  donationInr: number;
  estimatedFee: number;
  chargeInr: number;
  methods: string[];
  rateAsOf: string;
  rateStale: boolean;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay?: new (o: any) => { open(): void; on(e: string, f: (r: any) => void): void };
  }
}

function loadCheckout(): Promise<boolean> {
  return new Promise((ok) => {
    if (window.Razorpay) return ok(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => ok(true);
    s.onerror = () => ok(false);
    document.body.appendChild(s);
  });
}

function Form() {
  const { user, member } = useAuth();
  const router = useRouter();
  const caseId = useSearchParams().get("caseId");
  const [profile, setProfile] = useState<{ preferredCurrency?: string; displayName?: string } | null>(null);
  useEffect(() => (user ? onSnapshot(doc(db, "donors", user.uid), (d) => setProfile(d.exists() ? (d.data() as typeof profile) : null), () => {}) : undefined), [user]);
  const [pickedCurrency, setCurrency] = useState<string | null>(null);
  const currency = pickedCurrency ?? profile?.preferredCurrency ?? "INR";
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("general_support");
  const [visibility, setVisibility] = useState("private");
  const [typedName, setDisplayName] = useState<string | null>(null);
  const displayName = typedName ?? profile?.displayName ?? "";
  const [coverFees, setCoverFees] = useState(false);
  const [consent, setConsent] = useState(false);
  const [card, setCard] = useState<{ publicCaseId?: string; title?: string; sadaat?: boolean; number?: number } | null>(null);
  const [fund, setFund] = useState<"general" | "sehme_sadaat">("general");
  useEffect(() => (caseId ? onSnapshot(doc(db, "publicCases", `pub-${caseId}`), (d) => setCard(d.exists() ? (d.data() as typeof card) : null), () => {}) : undefined), [caseId]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [msg, setMsg] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const n = Number(amount);
    if (!(n > 0)) return;
    const t = setTimeout(() => {
      quoteFn({ amount: n, currency, coverFees })
        .then((r) => {
          setQuote(r.data);
          setMsg(null);
        })
        .catch((e) => setMsg({ kind: "error", text: (e as Error).message }));
    }, 400);
    return () => clearTimeout(t);
  }, [amount, currency, coverFees]);

  async function pay() {
    if (!quote || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      if (!(await loadCheckout())) throw new Error("Could not load the payment window. Check your connection.");
      const o = await orderFn({ amount: Number(amount), currency, coverFees, purpose, visibility, displayName, consent, caseId: caseId ?? undefined, fund: caseId && card?.sadaat ? fund : undefined });
      const { donationId, orderId, keyId, reference } = o.data;
      const rz = new window.Razorpay!({
        key: keyId,
        order_id: orderId,
        name: "KS1J",
        description: `Donation ${reference}`,
        prefill: { name: member?.fullName, email: user?.email ?? undefined },
        theme: { color: "#0b4d3a" },
        handler: async (r: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await verifyFn({ donationId, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
            setMsg({ kind: "info", text: `Thank you. Your donation ${reference} is verified.` });
            router.push(`/donations/detail/?id=${donationId}`);
          } catch (e) {
            setMsg({ kind: "error", text: `We could not confirm the payment yet: ${(e as Error).message}. If money left your account, it will still be counted automatically.` });
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.on("payment.failed", (r: { error: { description: string } }) => setMsg({ kind: "error", text: r.error.description }));
      rz.open();
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!user) return <Banner>Please <Link className="underline" href="/login">sign in</Link> to donate, so you can see where your gift goes.</Banner>;

  return (
    <Card>
      {caseId && (
        <div className="mb-3 text-sm text-muted">
          <p>This gift goes to {card ? `case ${card.publicCaseId ?? "#" + card.number}: ${card.title ?? ""}` : "the case you chose"}. A donation is money given without repayment.</p>
          {card?.sadaat && (
            <fieldset className="mt-2 space-y-1">
              <legend className="text-sm font-medium text-fg">Which fund?</legend>
              {([["general", "General donation"], ["sehme_sadaat", "Sehme Sadaat (only for verified Sadaat cases)"]] as const).map(([v, label]) => (
                <label key={v} className="flex min-h-11 items-center gap-2"><input type="radio" name="fund" checked={fund === v} onChange={() => setFund(v)} />{label}</label>
              ))}
            </fieldset>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Field label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" />
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Currency</span>
          <select className="min-h-12 w-full rounded-xl border border-line bg-bg px-3" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium">What is it for?</span>
        <select className="min-h-12 w-full rounded-xl border border-line bg-bg px-3" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
          {Object.entries(PURPOSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {RESTRICTED_PURPOSES.includes(purpose) && (
        <p className="mt-2 text-sm text-muted">{PURPOSE_LABELS[purpose]} is kept separate and goes only to cases the committee has marked eligible for it.</p>
      )}

      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium">Who can see my name?</span>
        <select className="min-h-12 w-full rounded-xl border border-line bg-bg px-3" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          {Object.entries(VISIBILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {visibility === "public" && <div className="mt-3"><Field label="Name to show" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>}

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={coverFees} onChange={(e) => setCoverFees(e.target.checked)} />
        I will cover the payment fee so the fund receives the full amount.
      </label>

      {quote && Number(amount) > 0 && (
        <div className="mt-4 rounded-xl border border-line p-4 text-sm">
          {quote.displayCurrency !== "INR" && (
            <>
              <p>Donation: {quote.displayAmount} {quote.displayCurrency}</p>
              <p>Exchange rate: 1 {quote.displayCurrency} = ₹{quote.exchangeRate.toFixed(2)} (as of {formatDateTime(new Date(quote.rateAsOf))}){quote.rateStale ? ", the latest we could fetch" : ""}</p>
              <p>Currency conversion margin: {quote.fxMarkupPercent}% (₹{quote.fxMarkupAmount.toLocaleString("en-IN")})</p>
              <p>Rate you pay: ₹{quote.effectiveRate.toFixed(2)}</p>
            </>
          )}
          <p className="font-semibold">The fund receives: {formatRupees(quote.donationInr)}</p>
          {quote.estimatedFee > 0 && <p>Estimated payment fee you cover: {formatRupees(quote.estimatedFee)}</p>}
          <p className="num text-lg font-semibold">You pay: {formatRupees(quote.chargeInr)}</p>
          <p className="text-muted">Payment options: {quote.methods.map((m) => (m === "upi" ? "UPI" : m === "netbanking" ? "Net banking" : "Cards")).join(", ")}</p>
        </div>
      )}

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input className="mt-1" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          I understand the committee may allocate my donation to eligible cases matching the purpose I chose, and that allocation details may be shown using anonymised case references that protect beneficiary privacy.
        </span>
      </label>

      {msg && <div className="mt-3"><Banner kind={msg.kind}>{msg.text}</Banner></div>}
      <div className="mt-4">
        <Button disabled={!quote || !consent || busy} onClick={pay}>{busy ? "Opening payment…" : "Pay securely"}</Button>
      </div>
      <p className="mt-3 text-xs text-muted">Payments are processed by Razorpay. A donation is counted only after the payment is verified by our server.</p>
    </Card>
  );
}

export default function Donate() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader eyebrow="Give" title="Donate" intro="Choose a purpose, see every number before you pay, and follow your gift afterwards." />
        <Suspense fallback={null}>
          <Form />
        </Suspense>
      </main>
    </>
  );
}
