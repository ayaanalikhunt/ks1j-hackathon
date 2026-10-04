// Currency conversion and the forex markup. Pure functions, so they can be tested without a network or a database.
//
// Donations are recorded in whole rupees. A donor can choose another currency; we convert it with the day's exchange
// rate plus an admin-set markup, and show every number so nothing is hidden. The original amount is never overwritten.

/** Decimal places Razorpay uses for each currency (most are 2; KWD is 3). */
const EXPONENT = { KWD: 3 };
const exponent = (cur) => EXPONENT[cur] ?? 2;

const SUPPORTED = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "SGD", "QAR", "KWD"];

/** Smallest-unit integer for an amount in major units, or null if it has more decimals than the currency allows. */
function toMinor(amount, currency) {
  const exp = exponent(currency);
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  const minor = Math.round(amount * 10 ** exp);
  // reject 10.005 USD: it has more precision than the currency can carry
  if (Math.abs(minor / 10 ** exp - amount) > 1e-9) return null;
  return minor;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {object} p
 * @param {number} p.amount           what the donor chose, in major units of `currency` (for example 100 for $100)
 * @param {string} p.currency         the donor's display currency
 * @param {number} p.rateToInr        base exchange rate: how many rupees one unit of `currency` is worth (1 for INR)
 * @param {number} [p.markupPercent]  forex markup, for example 2.5. Ignored for INR.
 * @param {number} [p.fixedInr]       a fixed rupee adjustment added after conversion (0 by default). Ignored for INR.
 * @param {"nearest"|"up"|"down"} [p.rounding]  how the rupee total is rounded to a whole rupee
 * @param {boolean} [p.coverFees]     the donor chooses to cover the payment fee so the fund receives the full amount
 * @param {number} [p.feeRate]        estimated gateway fee including tax, as a fraction (0.0236 = 2.36%)
 */
function computeQuote(p) {
  const currency = p.currency;
  if (!SUPPORTED.includes(currency)) throw new Error(`Unsupported currency: ${currency}`);
  const minor = toMinor(p.amount, currency);
  if (minor === null) throw new Error("That amount is not valid for this currency.");
  if (!(p.rateToInr > 0)) throw new Error("No exchange rate is available.");

  const inr = currency === "INR";
  const markupPercent = inr ? 0 : Math.max(0, p.markupPercent ?? 0);
  const fixedInr = inr ? 0 : Math.max(0, p.fixedInr ?? 0);
  const baseRate = inr ? 1 : p.rateToInr;
  const effectiveRate = baseRate * (1 + markupPercent / 100);

  const major = minor / 10 ** exponent(currency);
  const atBase = major * baseRate;
  const markupInr = major * baseRate * (markupPercent / 100);
  const raw = major * effectiveRate + fixedInr;
  const rounding = p.rounding ?? "nearest";
  const donationInr = rounding === "up" ? Math.ceil(raw) : rounding === "down" ? Math.floor(raw) : Math.round(raw);
  if (donationInr < 1) throw new Error("That amount is too small.");

  // If the donor covers the fee, charge enough that the fund still receives the full donation after the fee.
  const feeRate = p.coverFees ? Math.min(Math.max(p.feeRate ?? 0, 0), 0.2) : 0;
  const chargeInr = feeRate > 0 ? Math.ceil(donationInr / (1 - feeRate)) : donationInr;

  return {
    baseCurrency: "INR",
    displayCurrency: currency,
    displayAmountMinor: minor,
    displayAmount: major,
    exchangeRate: baseRate,
    fxMarkupPercent: markupPercent,
    effectiveRate: round2(effectiveRate * 10000) / 10000,
    convertedAtBaseRate: round2(atBase),
    fxMarkupAmount: round2(markupInr),
    fixedAdjustment: fixedInr,
    rounding,
    /** What the fund receives, whole rupees. This is the amount the donation is recorded at. */
    donationInr,
    /** The estimated payment fee the donor chose to cover (0 if they did not). */
    estimatedFee: chargeInr - donationInr,
    /** What the donor is charged, whole rupees. */
    chargeInr,
    chargePaise: chargeInr * 100,
  };
}

/** Is a currency usable at all for a method? UPI works for INR payments only. */
function methodsFor(currency, settings = {}) {
  if (currency === "INR") return ["upi", "card", "netbanking"];
  // International payments depend on what the Razorpay account has enabled; the admin lists it in settings.
  return (settings.internationalMethods ?? ["card"]).filter((m) => m !== "upi");
}

/**
 * Read a rate from the free open.er-api.com provider: how many rupees one unit of `currency` is worth.
 * `fetchImpl` is injectable so tests never touch the network.
 */
async function fetchRateToInr(currency, fetchImpl = fetch, base = "https://open.er-api.com/v6/latest") {
  if (currency === "INR") return 1;
  const res = await fetchImpl(`${base}/${currency}`);
  if (!res.ok) throw new Error(`Exchange-rate provider returned ${res.status}`);
  const body = await res.json();
  const rate = body?.rates?.INR;
  if (!(rate > 0)) throw new Error("Exchange-rate provider returned no INR rate.");
  return rate;
}

module.exports = { SUPPORTED, exponent, toMinor, computeQuote, methodsFor, fetchRateToInr };
