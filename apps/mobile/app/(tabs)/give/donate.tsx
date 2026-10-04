import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { PURPOSE_LABELS, RESTRICTED_PURPOSES, formatRupees } from "@ks1j/shared";
import { RazorpayCheckout } from "@/components/RazorpayCheckout";
import { RequireAuth } from "@/components/RequireAuth";
import { Banner, Body, Btn, Card, Chip, Field, Heading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useDocument } from "@/lib/firestore";
import { callFn } from "@/lib/functions";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "SGD", "QAR", "KWD"];
const VISIBILITY = [
  ["private", "Private"],
  ["public", "Show my name"],
  ["anonymous", "Anonymous"],
] as const;

interface Quote {
  displayCurrency: string;
  displayAmount: number;
  exchangeRate: number;
  fxMarkupPercent: number;
  fxMarkupAmount: number;
  effectiveRate: number;
  donationInr: number;
  estimatedFee: number;
  chargeInr: number;
  methods: string[];
  rateAsOf: string;
  rateStale: boolean;
}
interface Order {
  donationId: string;
  orderId: string;
  keyId: string;
  reference: string;
}

export default function Donate() {
  const { caseId, institutionId, fund: wantedFund } = useLocalSearchParams<{ caseId?: string; institutionId?: string; fund?: string }>();
  const { user, member } = useAuth();
  const card = useDocument(caseId ? `publicCases/pub-${caseId}` : null);
  const inst = useDocument(institutionId ? `institutions/${institutionId}` : null);
  const profile = useDocument(user ? `donors/${user.uid}` : null);
  const [pickedCurrency, setCurrency] = useState<string | null>(null);
  const currency = pickedCurrency ?? profile?.preferredCurrency ?? "INR";
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("general_support");
  const [visibility, setVisibility] = useState<"private" | "public" | "anonymous">("private");
  const [typedName, setDisplayName] = useState<string | null>(null);
  const displayName = typedName ?? profile?.displayName ?? "";
  const [coverFees, setCoverFees] = useState(false);
  const [consent, setConsent] = useState(false);
  const [fund, setFund] = useState<"general" | "sehme_sadaat">(wantedFund === "sehme_sadaat" ? "sehme_sadaat" : "general");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    const n = Number(amount);
    if (!(n > 0)) {
      setQuote(null);
      return;
    }
    const t = setTimeout(() => {
      callFn<Quote>("quoteDonation", { amount: n, currency, coverFees })
        .then((q) => {
          setQuote(q);
          setMsg(null);
        })
        .catch((e) => {
          setQuote(null);
          setMsg({ error: true, text: (e as Error).message });
        });
    }, 400);
    return () => clearTimeout(t);
  }, [amount, currency, coverFees]);

  async function start() {
    if (!quote || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const o = await callFn<Order>("createDonationOrder", {
        amount: Number(amount),
        currency,
        coverFees,
        purpose,
        visibility,
        displayName,
        consent,
        caseId: caseId || undefined,
        institutionId: institutionId || undefined,
        fund: caseId && card?.sadaat ? fund : undefined,
      });
      setOrder(o);
    } catch (e) {
      setMsg({ error: true, text: (e as Error).message });
      setBusy(false);
    }
  }

  async function paid(r: { paymentId: string; signature: string }) {
    const o = order!;
    setOrder(null);
    try {
      await callFn("verifyRazorpayPayment", { donationId: o.donationId, paymentId: r.paymentId, signature: r.signature });
      router.replace({ pathname: "/give/donation", params: { id: o.donationId } });
    } catch (e) {
      setMsg({ error: true, text: `We could not confirm the payment yet: ${(e as Error).message}. If money left your account it will still be counted automatically.` });
    } finally {
      setBusy(false);
    }
  }

  const target = card ? `case ${card.publicCaseId ?? "#" + card.number}${card.title ? ": " + card.title : ""}` : inst ? inst.name : null;

  return (
    <RequireAuth eyebrow="Give" title="Donate">
      <Screen eyebrow="Give" title="Donate" intro="See every number before you pay, and follow your gift afterwards.">
        {target && <Banner>Your gift goes to {target}. A donation is money given without repayment.</Banner>}
        {caseId && card?.sadaat && (
          <View style={{ gap: 8 }}>
            <Body bold>Which fund?</Body>
            <Chip label="General donation" on={fund === "general"} onPress={() => setFund("general")} />
            <Chip label="Sehme Sadaat (only for verified Sadaat cases)" on={fund === "sehme_sadaat"} onPress={() => setFund("sehme_sadaat")} />
          </View>
        )}

        <Heading>Amount</Heading>
        <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CURRENCIES.map((c) => (
            <Chip key={c} label={c} on={currency === c} onPress={() => setCurrency(c)} />
          ))}
        </View>

        {!caseId && !institutionId && (
          <>
            <Heading>What is it for?</Heading>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                <Chip key={k} label={v} on={purpose === k} onPress={() => setPurpose(k)} />
              ))}
            </View>
            {RESTRICTED_PURPOSES.includes(purpose) && (
              <Body muted>{PURPOSE_LABELS[purpose]} is kept separate and goes only to cases the committee has marked eligible for it.</Body>
            )}
          </>
        )}

        <Heading>Who can see my name?</Heading>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {VISIBILITY.map(([k, label]) => (
            <Chip key={k} label={label} on={visibility === k} onPress={() => setVisibility(k)} />
          ))}
        </View>
        <Body muted>
          {visibility === "public" ? "The name below may be shown." : visibility === "anonymous" ? "Hidden from every public page." : "Only the committee sees who you are."}
        </Body>
        {visibility === "public" && <Field label="Name to show" value={displayName} onChangeText={setDisplayName} />}

        <Chip label="I will cover the payment fee so the fund gets the full amount" on={coverFees} onPress={() => setCoverFees(!coverFees)} />

        {quote && (
          <Card>
            {quote.displayCurrency !== "INR" && (
              <>
                <Body>Donation: {quote.displayAmount} {quote.displayCurrency}</Body>
                <Body>Rate: 1 {quote.displayCurrency} = ₹{quote.exchangeRate.toFixed(2)}{quote.rateStale ? " (latest available)" : ""}</Body>
                <Body>Currency conversion margin: {quote.fxMarkupPercent}% (₹{quote.fxMarkupAmount})</Body>
                <Body>Rate you pay: ₹{quote.effectiveRate.toFixed(2)}</Body>
              </>
            )}
            <Body bold>The fund receives {formatRupees(quote.donationInr)}</Body>
            {quote.estimatedFee > 0 && <Body>Payment fee you cover: {formatRupees(quote.estimatedFee)}</Body>}
            <Heading>You pay {formatRupees(quote.chargeInr)}</Heading>
            <Body muted>Options: {quote.methods.map((m) => (m === "upi" ? "UPI" : m === "netbanking" ? "Net banking" : "Cards")).join(", ")}</Body>
          </Card>
        )}

        <Chip
          label="I understand the committee may allocate my donation to eligible cases matching its purpose, and that allocation details may be shown using anonymised case references that protect beneficiary privacy."
          on={consent}
          onPress={() => setConsent(!consent)}
        />

        {msg && <Banner error={msg.error}>{msg.text}</Banner>}
        <Btn label={busy ? "Opening payment…" : "Pay securely"} onPress={start} disabled={!quote || !consent || busy} />
        <Body muted>Payments are processed by Razorpay. A donation counts only after our server verifies the payment.</Body>
      </Screen>

      {order && (
        <RazorpayCheckout
          visible
          keyId={order.keyId}
          orderId={order.orderId}
          description={`Donation ${order.reference}`}
          prefill={{ name: member?.fullName, email: user?.email ?? undefined }}
          onSuccess={paid}
          onFail={(text) => {
            setOrder(null);
            setBusy(false);
            setMsg({ error: true, text });
          }}
          onDismiss={() => {
            setOrder(null);
            setBusy(false);
          }}
        />
      )}
    </RequireAuth>
  );
}
