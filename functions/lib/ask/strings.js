// Localized one-line confirmations. The APP, never the model, writes these, and only after the destination is known.
const S = {
  en: {
    opening: (t) => `Opening the ${t} page…`,
    opened: (t) => `${t} page opened.`,
    denied: "This needs your member account first — opening the sign-in page.",
    clarify: "I want to make sure I understood you correctly. Please tap one of these:",
  },
  gu: {
    opening: (t) => `${t} પેજ ખોલી રહ્યું છે…`,
    opened: (t) => `${t} પેજ ખુલી ગયું.`,
    denied: "આ માટે તમારું સભ્ય ખાતું જોઈએ — સાઇન-ઇન પેજ ખોલી રહ્યું છે.",
    clarify: "મેં તમને બરાબર સમજ્યો છે કે નહીં એ ખાતરી કરવી છે. આમાંથી એક પર ટેપ કરો:",
  },
  hi: {
    opening: (t) => `${t} पेज खोल रहा हूँ…`,
    opened: (t) => `${t} पेज खुल गया।`,
    denied: "इसके लिए आपका सदस्य खाता चाहिए — साइन-इन पेज खोल रहा हूँ।",
    clarify: "मैंने आपको सही समझा है या नहीं, इसकी पुष्टि करनी है। इनमें से एक पर टैप करें:",
  },
  ur: {
    opening: (t) => `${t} کا صفحہ کھول رہا ہوں…`,
    opened: (t) => `${t} کا صفحہ کھل گیا۔`,
    denied: "اس کے لیے آپ کا ممبر اکاؤنٹ درکار ہے — سائن ان صفحہ کھول رہا ہوں۔",
    clarify: "میں نے آپ کو درست سمجھا ہے یا نہیں، اس کی تصدیق کرنا ہے۔ ان میں سے ایک پر ٹیپ کریں:",
  },
  roman: {
    opening: (t) => `${t} page khol raha hoon…`,
    opened: (t) => `${t} page khul gaya.`,
    denied: "Iske liye aap ka member account chahiye — sign-in page khol raha hoon.",
    clarify: "Maine aap ko theek samjha hoon ya nahin, ye pakka karna hai. In mein se ek par tap karein:",
  },
  ar: {
    opening: (t) => `جارٍ فتح صفحة ${t}…`,
    opened: (t) => `تم فتح صفحة ${t}.`,
    denied: "يتطلب هذا حسابك كعضو — جارٍ فتح صفحة تسجيل الدخول.",
    clarify: "أريد التأكد من فهمي لطلبك. اختر أحد الخيارات:",
  },
  fa: {
    opening: (t) => `در حال باز کردن صفحه ${t}…`,
    opened: (t) => `صفحه ${t} باز شد.`,
    denied: "این کار به حساب عضوی شما نیاز دارد — صفحه ورود باز می‌شود.",
    clarify: "می‌خواهم مطمئن شوم درست متوجه شدم. یکی از این گزینه‌ها را انتخاب کنید:",
  },
  mixed: {
    opening: (t) => `Opening the ${t} page…`,
    opened: (t) => `${t} page opened.`,
    denied: "This needs your member account first — opening the sign-in page.",
    clarify: "I want to make sure I understood you correctly. Please tap one of these:",
  },
};

function speak(lang, key, title = "") {
  const v = (S[lang] ?? S.en)[key];
  return typeof v === "function" ? v(title) : v;
}

const LABELS = {
  OPEN_HOME: "Home",
  OPEN_DONATION: "Donate",
  OPEN_MARAJI: "Maraji'",
  OPEN_MARJA: "Marja'",
  COMPARE_MARAJI: "Compare all three",
  OPEN_CASES: "Cases",
  OPEN_CONTACT: "Contact",
  OPEN_LOGIN: "Sign in",
  OPEN_MEMBER_APP: "Member app",
  OPEN_KHUMS: "Khums calculator",
  OPEN_TRANSPARENCY: "Donation transparency",
  GET_DONATION_STATUS: "My donation status",
  ASK_FIQH: "Ask a question",
};
const actionLabel = (action) => LABELS[action.id];

module.exports = { speak, actionLabel };
