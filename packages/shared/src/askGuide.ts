// The Ask AI Guide, website side: the public details of the three Maraji' and the suggestion chips.
// The server keeps the full prompts (functions/lib/ask/marja.js); a test checks that the two copies of this data agree.

export type MarjaId = "sistani" | "khamenei" | "makarem";

export interface AskMarja {
  id: MarjaId;
  name: string;
  honorific: string;
  arabicName: string;
  role: string;
  city: string;
  born: string;
  photo: string;
  website: string;
  websiteLabel: string;
  bio: string;
  knownFor: string[];
}

export const ASK_MARJAS: AskMarja[] = [
  {
    id: "sistani",
    name: "Ayatollah Sistani",
    honorific: "Grand Ayatollah Sayyid Ali al-Husayni al-Sistani",
    arabicName: "السيّد علي الحسيني السيستاني",
    role: "Marja' al-Taqlid · Najaf, Iraq",
    city: "Najaf",
    born: "1930",
    photo: "/marjas/sistani.jpg",
    website: "https://www.sistani.org/english/",
    websiteLabel: "sistani.org",
    bio: "Born in Mashhad in 1930, he studied in Qom and Najaf under Grand Ayatollah Khoei, whose hawza he now leads. His office answers thousands of written questions every year.",
    knownFor: ["Khums & Islamic finance", "Contemporary Q&A service", "Cautious, case-by-case rulings"],
  },
  {
    id: "khamenei",
    name: "Ayatollah Khamenei",
    honorific: "Grand Ayatollah Sayyid Ali Khamenei",
    arabicName: "السيّد علي الخامنئي",
    role: "Marja' al-Taqlid · Tehran, Iran",
    city: "Tehran",
    born: "1939",
    photo: "/marjas/khamenei.jpg",
    website: "https://www.khamenei.ir/",
    websiteLabel: "khamenei.ir",
    bio: "Born in Mashhad in 1939 into a family of scholars, he studied in the hawzas of Mashhad and Najaf. His practical laws and answers to contemporary questions are published on his official portal.",
    knownFor: ["Accessible practical rulings", "Modern-life questions", "Friday prayer & public ethics"],
  },
  {
    id: "makarem",
    name: "Ayatollah Makarem Shirazi",
    honorific: "Grand Ayatollah Naser Makarem Shirazi",
    arabicName: "ناصر مکارم شیرازی",
    role: "Marja' al-Taqlid · Qom, Iran",
    city: "Qom",
    born: "1926",
    photo: "/marjas/makarem.jpg",
    website: "https://www.makaremshirazi.ir/",
    websiteLabel: "makaremshirazi.ir",
    bio: "Born in Shiraz in 1926, he has taught in Qom for decades. He is the author of the thirty-volume Tafsir Nemuneh commentary of the Quran and answers contemporary questions through his office.",
    knownFor: ["Tafsir Nemuneh (30 volumes)", "Clear, decisive answers", "Islamic culture & education"],
  },
];

export const getAskMarja = (id: string | null | undefined) => ASK_MARJAS.find((m) => m.id === id);

/** Opening questions (plain, everyday matters). */
export const GUIDE_SUGGESTIONS: string[] = [
  "How do I calculate Khums on my salary?",
  "How do I pay Khums on savings I have had for years?",
  "How do I pray when travelling?",
  "What makes income halal in my job?",
  "Can I pray in a place without wudu facilities?",
  "What is taqlid and how do I follow a Marja'?",
  "How do I make up prayers I have missed?",
  "How is khums applied on savings that keep growing?",
];

export const GUIDE_TOPICS: string[] = ["Khums", "Salat", "Sawm", "Halal income", "Qada prayers", "Taharah", "Taqlid", "Modern life"];

/** One-tap commands in several languages. */
export const COMMAND_SUGGESTIONS: string[] = ["Open donation", "દાન ખોલો", "Donation kholo", "मुझे दान करना है", "مراجع دکھاؤ", "Sistani dikhao", "Mera donation kahan gaya?"];

/** Shown wherever the guide speaks about Khums or rulings. */
export const MARJA_CONFIRMATION = "Confirm with your Marja' or the Jamaat's alim.";
