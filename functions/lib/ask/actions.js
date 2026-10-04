// The deterministic action engine of the Ask AI Guide: a registry of the ONLY places the guide can open, and a keyword
// classifier (no LLM) that decides whether a message is a command, an ambiguous command or a fiqh question.
// The classifier returns registry ids only, never free text, so an unknown or unsafe destination is impossible.
const { normalizeForMatch } = require("./lang");
const { MARJAS } = require("./marja");

/** Real pages of this website. `memberOnly` pages send a signed-out visitor to sign in first. */
const ROUTES = [
  { id: "home", path: "/", title: "Home" },
  { id: "ask", path: "/ask/", title: "Ask AI Guide (Maraji')" },
  { id: "ask_sistani", path: "/ask/?marja=sistani", title: "Ask — Ayatollah Sistani" },
  { id: "ask_khamenei", path: "/ask/?marja=khamenei", title: "Ask — Ayatollah Khamenei" },
  { id: "ask_makarem", path: "/ask/?marja=makarem", title: "Ask — Ayatollah Makarem Shirazi" },
  { id: "ask_compare", path: "/ask/?mode=compare", title: "Compare all three Maraji'" },
  { id: "cases", path: "/cases/", title: "Cases to support" },
  { id: "mosques", path: "/mosques/", title: "Mosque finder" },
  { id: "donate", path: "/donate/", title: "Donate" },
  { id: "transparency", path: "/transparency/", title: "Donation transparency" },
  { id: "contact", path: "/contact/", title: "Contact the Jamaat office" },
  { id: "login", path: "/login/", title: "Sign in" },
  { id: "get_app", path: "/app/", title: "Get the app" },
  { id: "member_app", path: "/member/", title: "Member app", memberOnly: true },
  { id: "give", path: "/member/give", title: "Give (Khums, Lawajam, donate)", memberOnly: true },
  { id: "khums", path: "/member/give/khums", title: "Khums calculator", memberOnly: true },
  { id: "my_donations", path: "/donations/", title: "My donations", memberOnly: true },
];

const routeById = (id) => ROUTES.find((r) => r.id === id);

const VERBS =
  /(open|show|go to|goto|take me|navigate|kholo|khol|kholna|khol do|kholna hai|dikhao|dikha|dikha do|dikhado|batao|bata|chahiye|dekhna|दिखाओ|दिखाओ|खोलो|खोल दो|खोलना|ખોલો|ખોલી આપો|બતાવો|જોવું|افتح|افتحو|أرني|نشون|دکھاؤ|دکھاو|کھولو|کھول دو)/;

const DONATION_WORDS = /(donation|donate|donating|give|giving|daan|dan|daana|paisa|paise|दान|दाना|દાન|صدقہ|خیرات|كفارة|صدقه|donat)/;
const CASES_WORDS = /(case|cases|need|needs|family|families|madad|help|stories|کیس|کیسیز|मामला|કેસ|حالة|حالات)/;
const CONTACT_WORDS = /(contact|phone|call|office|address|reach|संपर्क|સંપર્ક|رابطہ|اتصال|تماس)/;
const HOME_WORDS = /(home|homepage|front|main page|landing|गृह|होम|ઘર|હોમ|गहर|मुख्य पृष्ठ|الرئيسية|الصفحة الرئيسية|ہوم)/;
const MARAJI_WORDS = /(maraji|marja|marja'|scholar|scholars|taqlid|all three|top three|मरजा|मरजाअ|મરજા|مراجع|مرجع|علماء|بزرگان)/;
const COMPARE_WORDS = /(compare|comparison|difference|differences|side by side|versus|vs\.?|all three|teeno|teen|सबके|फर्क|संतुलन|ત્રણેય|તુલના|مقابل|فرق|موازنة|تقابل)/;
const STATUS_WORDS =
  /(status|where|kahan|kaha|gaya|gayi|tracking|track|receipt|receipts|history|record|पहुंचा|कहाँ|कहा|गया|गयी|रसीद|स्थिति|ક્યાં|ગયું|રસીદ|સ્થિતિ|کہاں|گیا|رسید|حالت|أين|وصل)/;
const KHUMS_WORDS = /(khums|khumsa|কুমস|خمس|खुम्स|ખુમ્સ|fifth)/;
const SIGNIN_WORDS = /(sign in|login|log in|signin|account|साइन|लॉगिन|સાઇન|لاگ ان|سائن|داخل)/;
const APP_WORDS = /(app|application|member app|एप|એપ|ऐप| ایپ|تطبيق)/;
const TRANSPARENCY_WORDS = /(transparency|open books|financial report|पारदर्शिता|ટ્રાન્સપરન્સી|شفافیت|شفافية)/;

// Mosque finder. A venue word is enough on its own; a Friday word only counts together with a "near me" word, so a
// fiqh question about Friday prayer is still a question. The page itself parses the query (packages/shared mosqueSearch).
const MOSQUE_WORDS = /(masjid|masajid|mosque|imambargah|imambara|imambada|azakhana|mehfil|मस्जिद|इमामबाड़ा|महफ़िल|महफिल|મસ્જિદ|ઇમામબર્ગાહ|ઇમામબાડા|મેહફિલ|મહેફિલ|مسجد|مساجد|امام بارگاہ|محفل)/;
const FRIDAY_WORDS = /(friday|jummah|jumuah|jumma|juma|जुम्मा|जुमा|जुमे|જુમ્મા|જુમા|શુક્રવાર|جمعہ|جمعه|الجمعة)/;
const WHERE_WORDS = /(where|kahan|kaha|kidhar|कहाँ|कहां|ક્યાં|کہاں|أين|کجا)/;
const NEAR_WORDS = /(near|nearest|nearby|closest|paas|nazdeek|nazdik|पास|नज़दीक|नजदीक|નજીક|قریب|أقرب|نزدیک)/;

const MARJA_NAMES = [
  { id: "sistani", re: /(sistani|sistany|seestani|sayyid sistani|سستانی|سیستانی|सिस्तानी|सीस्तानी|સિસ્તાની|સીસ્તાની|सिस्तानि)/i },
  { id: "khamenei", re: /(khamenei|khamenai|khamanai|khameini|خامنئی|خامنہ|खामेनई|खामेनी|ખામેનઈ|کھامنے|khaman)/i },
  { id: "makarem", re: /(makarem|makarm|makkarem|shirazi|مکارم|شیرازی|मकारम|शिराज़ी|મકારમ|શિરાજી|مکررم)/i },
];

const matches = (words, text) => words.test(text);

/**
 * Confidence: >= 0.85 execute; 0.65 to 0.84 ambiguous (the page offers one-tap choices); below that it is a fiqh question.
 * @returns {{action: {id: string, routeId?: string, marjaId?: string, requiresAuth?: boolean}, confidence: number, matched: string[]}}
 */
function classify(rawInput, ctx = {}) {
  const text = normalizeForMatch(rawInput);
  if (!text) return { action: { id: "ASK_FIQH" }, confidence: 0, matched: [] };

  const hasVerb = VERBS.test(text);
  const marjaHit = MARJA_NAMES.find((m) => m.re.test(text));
  const matched = [];

  // a question about MY donation needs a signed-in member, checked on the server
  const isStatus = matches(STATUS_WORDS, text) && matches(DONATION_WORDS, text);
  if (isStatus) {
    matched.push("donation-status");
    return { action: { id: "GET_DONATION_STATUS", requiresAuth: true }, confidence: 0.95, matched };
  }

  // before donation, so "દાન નહીં, મસ્જિદ બતાવો" opens mosques; "donation kholo" has no venue word and is untouched
  const wantsMosque = matches(MOSQUE_WORDS, text) || (matches(FRIDAY_WORDS, text) && (matches(NEAR_WORDS, text) || matches(WHERE_WORDS, text)));
  if (wantsMosque && (hasVerb || matches(NEAR_WORDS, text) || matches(FRIDAY_WORDS, text) || text.split(" ").length <= 5)) {
    matched.push("mosques");
    return { action: { id: "OPEN_MOSQUE_FINDER", routeId: "mosques", query: String(rawInput).slice(0, 200) }, confidence: 0.92, matched };
  }

  if ((matches(COMPARE_WORDS, text) && (matches(MARAJI_WORDS, text) || marjaHit)) || (matches(MARAJI_WORDS, text) && matches(COMPARE_WORDS, text))) {
    matched.push("compare");
    return { action: { id: "COMPARE_MARAJI", routeId: "ask_compare" }, confidence: 0.93, matched };
  }

  if (marjaHit) {
    matched.push(`marja:${marjaHit.id}`);
    if (hasVerb || matches(MARAJI_WORDS, text) || text.split(" ").length <= 3 || ctx.currentMarja) {
      return { action: { id: "OPEN_MARJA", routeId: `ask_${marjaHit.id}`, marjaId: marjaHit.id }, confidence: 0.9, matched };
    }
  }

  if (matches(MARAJI_WORDS, text) && hasVerb) {
    matched.push("maraji");
    return { action: { id: "OPEN_MARAJI", routeId: "ask" }, confidence: 0.9, matched };
  }

  if (matches(KHUMS_WORDS, text) && (hasVerb || matches(/(calculate|calculator|calc|nikalo|calcu|گنتی)/, text))) {
    // "how do I calculate khums" without a navigation verb is a QUESTION for the guide
    const questionish = /(kaise|how|what|kyu|why|kya|categor|hukm|ruling|masla|mas'ala|قال|حکم|कैसे|કેવી રીતે)/.test(text);
    if (!questionish || hasVerb) {
      matched.push("khums");
      return { action: { id: "OPEN_KHUMS", routeId: "khums", requiresAuth: true }, confidence: 0.88, matched };
    }
  }

  if (matches(TRANSPARENCY_WORDS, text) && hasVerb) {
    matched.push("transparency");
    return { action: { id: "OPEN_TRANSPARENCY", routeId: "transparency" }, confidence: 0.9, matched };
  }

  if (matches(DONATION_WORDS, text) && hasVerb) {
    matched.push("donation");
    return { action: { id: "OPEN_DONATION", routeId: "donate" }, confidence: 0.95, matched };
  }

  // "mujhe donation karna hai": an intent with no verb. \b only works for Latin, so other scripts are matched plainly.
  const donateIntentLatin = /\b(want to|wanna|like to|dena|dene|karna|karana)\b/i;
  const donateIntentOther = /(देना|करना|આપવું|કરવું|دینا|کرنا|أريد|اريد)/;
  if ((donateIntentLatin.test(text) || donateIntentOther.test(text)) && matches(DONATION_WORDS, text)) {
    matched.push("donation-intent");
    return { action: { id: "OPEN_DONATION", routeId: "donate" }, confidence: 0.92, matched };
  }

  if (matches(SIGNIN_WORDS, text) && hasVerb) {
    matched.push("login");
    return { action: { id: "OPEN_LOGIN", routeId: "login" }, confidence: 0.9, matched };
  }
  if (matches(CONTACT_WORDS, text) && hasVerb) {
    matched.push("contact");
    return { action: { id: "OPEN_CONTACT", routeId: "contact" }, confidence: 0.9, matched };
  }
  if (matches(CASES_WORDS, text) && hasVerb) {
    matched.push("cases");
    return { action: { id: "OPEN_CASES", routeId: "cases" }, confidence: 0.88, matched };
  }
  if (matches(APP_WORDS, text) && (hasVerb || matches(/(member|اپ)/, text))) {
    matched.push("member-app");
    return { action: { id: "OPEN_MEMBER_APP", routeId: "member_app", requiresAuth: true }, confidence: 0.87, matched };
  }
  if (matches(HOME_WORDS, text) && hasVerb) {
    matched.push("home");
    return { action: { id: "OPEN_HOME", routeId: "home" }, confidence: 0.86, matched };
  }

  // an elderly or voice-typed bare noun: very short input with one donation-ish word
  const words = text.split(" ").filter(Boolean);
  if (words.length <= 3) {
    if (matches(DONATION_WORDS, text) || /\b(daan|dan|paise|paisa|money|rupees)\b/.test(text)) {
      matched.push("bare-donation");
      return { action: { id: "OPEN_DONATION", routeId: "donate" }, confidence: 0.7, matched };
    }
    if (matches(CASES_WORDS, text)) {
      matched.push("bare-cases");
      return { action: { id: "OPEN_CASES", routeId: "cases" }, confidence: 0.7, matched };
    }
  }

  return { action: { id: "ASK_FIQH" }, confidence: 0, matched };
}

/** 0.65 to 0.84: the page offers one-tap choices instead of guessing. */
const isAmbiguous = (c) => c.confidence >= 0.65 && c.confidence < 0.85 && c.action.id !== "ASK_FIQH";
const isValidMarjaId = (id) => !!id && MARJAS.some((m) => m.id === id);

module.exports = { ROUTES, routeById, classify, isAmbiguous, isValidMarjaId };
