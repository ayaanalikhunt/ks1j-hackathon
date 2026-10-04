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
import { useLang } from "@/lib/i18n";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "SGD", "QAR", "KWD"];
const VISIBILITY = ["private", "public", "anonymous"] as const;

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
  const { t } = useLang();
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
      setMsg({ error: true, text: t("dn.confirmFail", { error: (e as Error).message }) });
    } finally {
      setBusy(false);
    }
  }

  const target = card ? `${t("dn.case", { ref: card.publicCaseId ?? "#" + card.number })}${card.title ? ": " + card.title : ""}` : inst ? inst.name : null;

  return (
    <RequireAuth eyebrow={t("give.eyebrow")} title={t("dn.title")}>
      <Screen eyebrow={t("give.eyebrow")} title={t("dn.title")} intro={t("dn.intro")}>
        {target && <Banner>{t("dn.target", { target })}</Banner>}
        {caseId && card?.sadaat && (
          <View style={{ gap: 8 }}>
            <Body bold>{t("dn.whichFund")}</Body>
            <Chip label={t("dn.fundGeneral")} on={fund === "general"} onPress={() => setFund("general")} />
            <Chip label={t("dn.fundSadaat")} on={fund === "sehme_sadaat"} onPress={() => setFund("sehme_sadaat")} />
          </View>
        )}

        <Heading>{t("dn.amount")}</Heading>
        <Field label={t("dn.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CURRENCIES.map((c) => (
            <Chip key={c} label={c} on={currency === c} onPress={() => setCurrency(c)} />
          ))}
        </View>

        {!caseId && !institutionId && (
          <>
            <Heading>{t("dn.forWhat")}</Heading>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                <Chip key={k} label={v} on={purpose === k} onPress={() => setPurpose(k)} />
              ))}
            </View>
            {RESTRICTED_PURPOSES.includes(purpose) && (
              <Body muted>{t("dn.restricted", { purpose: PURPOSE_LABELS[purpose] })}</Body>
            )}
          </>
        )}

        <Heading>{t("dn.whoSees")}</Heading>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {VISIBILITY.map((k) => (
            <Chip key={k} label={t(`dn.vis.${k}`)} on={visibility === k} onPress={() => setVisibility(k)} />
          ))}
        </View>
        <Body muted>
          {t(`dn.visNote.${visibility}`)}
        </Body>
        {visibility === "public" && <Field label={t("dn.nameShow")} value={displayName} onChangeText={setDisplayName} />}

        <Chip label={t("dn.coverFee")} on={coverFees} onPress={() => setCoverFees(!coverFees)} />

        {quote && (
          <Card>
            {quote.displayCurrency !== "INR" && (
              <>
                <Body>{t("dn.q.donation", { amount: quote.displayAmount, currency: quote.displayCurrency })}</Body>
                <Body>{t("dn.q.rate", { currency: quote.displayCurrency, rate: quote.exchangeRate.toFixed(2), stale: quote.rateStale ? t("dn.q.latest") : "" })}</Body>
                <Body>{t("dn.q.margin", { percent: quote.fxMarkupPercent, amount: quote.fxMarkupAmount })}</Body>
                <Body>{t("dn.q.effective", { rate: quote.effectiveRate.toFixed(2) })}</Body>
              </>
            )}
            <Body bold>{t("dn.q.receives", { amount: formatRupees(quote.donationInr) })}</Body>
            {quote.estimatedFee > 0 && <Body>{t("dn.q.fee", { amount: formatRupees(quote.estimatedFee) })}</Body>}
            <Heading>{t("dn.q.pay", { amount: formatRupees(quote.chargeInr) })}</Heading>
            <Body muted>{t("dn.q.options", { methods: quote.methods.map((m) => (m === "upi" ? t("dn.m.upi") : m === "netbanking" ? t("dn.m.netbanking") : t("dn.m.cards"))).join(", ") })}</Body>
          </Card>
        )}

        <Chip
          label={t("dn.consent")}
          on={consent}
          onPress={() => setConsent(!consent)}
        />

        {msg && <Banner error={msg.error}>{msg.text}</Banner>}
        <Btn label={busy ? t("dn.opening") : t("dn.paySecurely")} onPress={start} disabled={!quote || !consent || busy} />
        <Body muted>{t("dn.razorpayNote")}</Body>
      </Screen>

      {order && (
        <RazorpayCheckout
          visible
          keyId={order.keyId}
          orderId={order.orderId}
          description={t("dn.paymentDesc", { reference: order.reference })}
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
