// Language detection for the Ask AI Guide: script-first (Gujarati / Devanagari / Arabic / Latin), then disambiguation inside
// a script (Arabic -> ur | ar | fa, Latin -> en | roman-urdu), with mixed-language tolerance. The original input is never changed.

const GU_RANGE = /[઀-૿]/g;
const DEVA_RANGE = /[ऀ-ॿ]/g;
const ARAB_RANGE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const LATIN_RANGE = /[A-Za-z]/g;

const count = (text, re) => (text.match(re) ?? []).length;

const URDU_MARKERS = /[ھہےںۂ]|(ہے|ہوں|کیا|کھولو|دکھاؤ|کیوں|نہیں|میں|آپ|والی)/;
const PERSIAN_MARKERS = /(است|هست|کنید|باز|خوب|این|آن|های|می‌|برای|شود|بودن)/;
const ARABIC_MARKERS = /(افتح|أرني|أريد|هل|ماذا|كيف|يمكن|الصفحة|السيد|السيستاني|الخامنئي)/;

const ROMAN_URDU_WORDS =
  /\b(kholo|khol|kholna|dikhao|dikha|dikhado|batao|bata|mujhe|mera|meri|mere|kya|hai|hain|nahi|karna|karne|kar|dena|dene|wala|wali|ka|ki|ke|kaam|paisa|paise|sahab|sahib|masla|masle|jana|jata|kahan|gay|gaya|kaise|kyu|kyun|acha|theek|thik|chahiye|samjhao|samjao)\b/i;

/** Lowercase and punctuation-light, for matching only. */
function normalizeForMatch(input) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[،؛؟!.,'"()\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectLanguage(raw) {
  const text = raw ?? "";
  const counts = [
    { s: "gu", n: count(text, GU_RANGE) },
    { s: "deva", n: count(text, DEVA_RANGE) },
    { s: "arab", n: count(text, ARAB_RANGE) },
    { s: "latin", n: count(text, LATIN_RANGE) },
  ].filter((c) => c.n > 0);
  counts.sort((a, b) => b.n - a.n);

  const scripts = counts.map((c) => c.s);
  const dominant = counts[0]?.s ?? "latin";
  const total = counts.reduce((s, c) => s + c.n, 0) || 1;
  const dominantShare = (counts[0]?.n ?? 0) / total;

  const second = counts[1];
  if (second && second.n >= 3 && second.n / total >= 0.2 && dominantShare < 0.85) {
    return { lang: "mixed", script: dominant, scripts, romanUrduLikely: false };
  }

  switch (dominant) {
    case "gu":
      return { lang: "gu", script: "gu", scripts, romanUrduLikely: false };
    case "deva":
      return { lang: "hi", script: "deva", scripts, romanUrduLikely: false };
    case "arab":
      if (URDU_MARKERS.test(text)) return { lang: "ur", script: "arab", scripts, romanUrduLikely: false };
      if (PERSIAN_MARKERS.test(text)) return { lang: "fa", script: "arab", scripts, romanUrduLikely: false };
      if (ARABIC_MARKERS.test(text)) return { lang: "ar", script: "arab", scripts, romanUrduLikely: false };
      return { lang: "ur", script: "arab", scripts, romanUrduLikely: false }; // the community default for Arabic script
    default: {
      const romanUrduLikely = ROMAN_URDU_WORDS.test(text);
      return { lang: romanUrduLikely ? "roman" : "en", script: "latin", scripts: scripts.length ? scripts : ["latin"], romanUrduLikely };
    }
  }
}

/** The line added to the prompt so the answer comes back in the asker's language. */
function languageInstruction(lang) {
  switch (lang) {
    case "gu":
      return "Answer in simple Gujarati script (ગુજરાતી). Keep technical fiqh terms in Arabic with a short Gujarati explanation in brackets.";
    case "hi":
      return "Answer in simple Hindi (Devanagari). Keep technical fiqh terms in Arabic with a short Hindi explanation in brackets.";
    case "ur":
      return "Answer in simple Urdu (Arabic script). Keep sentences short and respectful.";
    case "roman":
      return "Answer in Roman Urdu — the same mixed Urdu-English style the questioner used (e.g. 'aap ka sawal ka jawab…'). Keep it warm and simple.";
    case "ar":
      return "Answer in simple Modern Standard Arabic.";
    case "fa":
      return "Answer in simple Persian (Farsi).";
    case "mixed":
      return "Answer mainly in the dominant language of the question, mirroring how the questioner mixed languages.";
    default:
      return "Answer in English.";
  }
}

module.exports = { detectLanguage, languageInstruction, normalizeForMatch };
