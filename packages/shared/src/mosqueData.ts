// Mosque Finder data. The 36 venues come from the KSIJ Mumbai Youth Committee Mosque Finder PDF (Google Maps listings,
// August 2026), which says every entry must be volunteer-verified before going live. All start as PENDING_VERIFICATION.
// The PDF gives NO exact Friday times and NO coordinates: none are invented here.

export type JummahStatus = "YES" | "LIKELY" | "NO" | "UNCONFIRMED";

export type VerificationStatus =
  | "PENDING_VERIFICATION"
  | "VOLUNTEER_VERIFIED"
  | "OFFICIALLY_VERIFIED"
  | "SOURCE_CONFLICT"
  | "MAP_UNVERIFIED"
  | "CLOSED"
  | "RELOCATED"
  | "REMOVED";

export interface JummahSchedule {
  day: "FRIDAY";
  time: string;
  status: "VERIFIED" | "LIKELY" | "UNCONFIRMED";
  source?: string;
  sourceUrl?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface MosqueVenue {
  id: string;
  name: string;
  aliases: string[];
  type: string;
  area: string;
  city: string;
  address: string;
  postalCode?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  /** Where the pin came from, and how exact it is. "venue" is a checked pin on the building; anything else is approximate. */
  pinSource?: string;
  pinPrecision?: "venue" | "postcode" | "area";
  photoUrl?: string;
  jummahStatus: JummahStatus;
  verificationStatus: VerificationStatus;
  source: string;
  sourceNote?: string;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  lastCheckedAt?: string | null;
  jummahSchedules?: JummahSchedule[];
}

export interface PendingMosqueCandidate {
  id: string;
  submittedName: string;
  status: "PENDING_VERIFICATION" | "MATCHED" | "DUPLICATE" | "REJECTED";
  possibleMatchId?: string;
  notes?: string;
}

const SRC = "KSIJ Mumbai Youth Committee Mosque Finder — August 2026";

type Extra = { phone?: string; note?: string };
const v = (
  id: string,
  name: string,
  aliases: string[],
  type: string,
  area: string,
  city: string,
  address: string,
  postalCode: string,
  jummahStatus: JummahStatus,
  extra: Extra = {},
): MosqueVenue => ({
  id,
  name,
  aliases,
  type,
  area,
  city,
  address,
  postalCode,
  ...(extra.phone ? { phone: extra.phone } : {}),
  jummahStatus,
  verificationStatus: "PENDING_VERIFICATION",
  source: SRC,
  ...(extra.note ? { sourceNote: extra.note } : {}),
});

export const MOSQUES: MosqueVenue[] = [
  v("mumbai-khoja-shia-isna-ashari-dongri", "Khoja Shia Isna Ashari Jama Masjid (Dongri)", ["Khoja Masjid, Dongri", "Khoja Masjid Dongri", "Khoja Shia Masjid Dongri", "Dongri Khoja Masjid"], "Masjid", "Dongri / Pydhonie", "Mumbai", "Hazrat Abbas Rd, Katha Bazar, Pydhonie, Mandvi, Mumbai 400009", "400009", "LIKELY"),
  v("mumbai-zainabia-masjid-kumbharwada", "Zainabia Masjid (formerly Babar Ali Imambada)", ["Zainabia Masjid", "Babar Ali Imambada"], "Imambargah", "Kumbharwada", "Mumbai", "122/124, Husainyah Marg, Ajmer, Kumbharwada, Mumbai 400003", "400003", "UNCONFIRMED"),
  v("mumbai-mughal-masjid-iranian", "Mughal Masjid (Masjid-e-Iranian)", ["Mughal Masjid", "Masjid-e-Iranian", "Masjid Iranian"], "Masjid", "Bhendi Bazaar / Umerkhadi", "Mumbai", "Imamwada Road, Bhendi Bazaar, Umerkhadi, Mumbai 400009", "400009", "UNCONFIRMED"),
  v("mumbai-imambada-baqerya", "Imambada Baqerya", ["Baqerya Imambada", "Imambada Baqeriya"], "Imambargah", "Bhendi Bazaar", "Mumbai", "Shop No.1, 26, Khokawala Building, Raudat Tahera St, Bhendi Bazar, Mumbai 400003", "400003", "UNCONFIRMED"),
  v("mumbai-imamia-masjid-umerkhadi", "Imamia Masjid", ["Imamia Masjid", "Imamia"], "Masjid / Imambargah", "Umerkhadi", "Mumbai", "Mirzali St, Umerkhadi, Mumbai 400009", "400009", "UNCONFIRMED", { phone: "+91 22 2375 9408" }),
  v("mumbai-sahebazzaman-sakinaka", "Madrasa-e-Sahebazzaman Shia Jama Masjid", ["Sahebazzaman Shia Jama Masjid", "Madrasa-e-Sahebazzaman", "Sahebuzzaman Masjid"], "Masjid / Imambargah", "Sakinaka", "Mumbai", "Nair Wadi, Asalpha, Mumbai 400072", "400072", "YES"),
  v("mumbai-shia-imambara-govandi", "Shia Imambara (Govandi)", ["Shia Imambara Govandi", "Govandi Shia Imambara"], "Imambargah", "Govandi West", "Mumbai", "25A/C/05, Rd No. 12, Kamalabai Nagar, Baiganwadi, Govandi West, Mumbai 400043", "400043", "UNCONFIRMED"),
  v("mumbai-haidari-jari-mari", "Haidari Shia Masjid", ["Haidari Shia Masjid", "Haidari Masjid", "Jari Mari Shia Masjid"], "Masjid / Imambargah", "Jari Mari", "Mumbai", "Shivaji Nagar, Saki Naka, Mumbai 400072", "400072", "UNCONFIRMED", { phone: "+91 84199 37660" }),
  v("mumbai-haji-nazarali-kurla", "Haji Nazarali Imambargah", ["H Nazarali Imambargah", "Haji Nazarali", "Nazarali Imambargah"], "Imambargah", "Kurla West", "Mumbai", "New Mill Rd, next to Mansi Apartments, BMC Colony, Kurla West, Mumbai 400070", "400070", "UNCONFIRMED"),
  v("mumbai-kurla-shia-jama-masjid", "Kurla Shia Jama Masjid", ["Kurla Shia Masjid", "Kurla Shia Jama Masjid"], "Masjid", "Kurla West", "Mumbai", "Jai Ambika Nagar, Halav Pool, Pipe Line Rd, Friends Colony, Kurla West, Mumbai 400070", "400070", "YES", { phone: "+91 22 2503 8378" }),
  v("mumbai-khoja-shia-bandra", "Khoja Shia Ishna Ashari Jama Masjid (Bandra)", ["Bandra Masjid", "Khoja Masjid Bandra", "Bandra Shia Masjid", "Khoja Shia Bandra"], "Masjid / Imambargah", "Bandra West", "Mumbai", "Bazar Rd, Ranwar, Bandra West, Mumbai 400050", "400050", "YES"),
  v("mumbai-arambaug-khoja-jamaat", "Arambaug - Khoja Shia Ithna Asheri Jamaat", ["Arambaug Mosque, Masgaon", "Arambaug Mosque", "Arambaug", "Arambaug Khoja Shia"], "Imambada / Cemetery", "Byculla", "Mumbai", "52, Mount Road, Byculla East, Rambhau Bhogle Marg, Mumbai 400010", "400010", "UNCONFIRMED", { note: "Source classifies this as Imambada / Cemetery. Do not relabel simply as a mosque without verification." }),
  v("mumbai-shia-jama-masjid-govandi", "Shia Jama Masjid Govandi", ["Govandi Shia Jama Masjid", "Shia Jama Masjid Govandi"], "Masjid", "Govandi West", "Mumbai", "Bada Imambada, Lotus Colony, Abdul Hamid Marg, Govandi West, Mumbai 400043", "400043", "UNCONFIRMED"),
  v("mumbai-baqariya-shia-masjid-malad", "Baqariya Shia Jama Masjid", ["Baqariya Masjid", "Baqariya Shia Masjid"], "Masjid", "Malad West", "Mumbai", "Gate No. 8, Gaikwad Nagar, Malavani, Malad West, Mumbai 400095", "400095", "UNCONFIRMED", { phone: "+91 96192 66195" }),
  v("mumbai-ksij-kabarastan-juhu-versova", "KSIJ Kabarastan Masjid (Juhu-Versova)", ["KSIJ Kabarastan Masjid", "Juhu Versova Kabarastan Masjid", "Kapaswadi Masjid"], "Masjid / Cemetery", "Andheri West", "Mumbai", "2, Juhu Versova Link Rd, Kapaswadi, Andheri West, Mumbai 400053", "400053", "UNCONFIRMED"),
  v("mumbai-gulshan-e-hussaini-jogeshwari", "Shia Masjid Imambada Gulshan-e-Hussaini", ["Gulshan-e-Hussaini", "Gulshan e Hussaini Masjid", "Gulshan Hussaini"], "Masjid / Imambargah", "Jogeshwari East", "Mumbai", "Saraswati Baug, Shivaji Nagar, Shankarwadi, Jogeshwari East, Mumbai 400060", "400060", "YES"),
  v("mumbai-azakhana-e-zainab-andheri-east", "Imambara Azakhana-e-Zainab (S.A.)", ["Azakhana-e-Zainab", "Imambara Zainab Andheri", "Zainab Azakhana"], "Imambargah", "Andheri East", "Mumbai", "20, Chandruday Chawl, Mahakali Caves Rd, near Little Flower School, Andheri East, Mumbai 400093", "400093", "UNCONFIRMED"),
  v("mumbai-bargahe-mahdi-vikhroli", "Mehfil-e-Bargahe Mahdi (A.T.F.S.)", ["Bargahe Mahdi", "Mehfil-e-Bargahe Mahdi", "Bargahe Mehdi"], "Imambargah / Mehfil", "Vikhroli West", "Mumbai", "4/382/4493, Tagore Nagar, Rajiv Gandhi Nagar, Vikhroli West, Mumbai 400083", "400083", "UNCONFIRMED", { phone: "+91 90299 02959" }),
  v("mumbai-shia-imambada-wadala", "Shia Imambada (Wadala)", ["Wadala Shia Imambada", "Shia Imambada Wadala"], "Imambargah", "Wadala", "Mumbai", "New National Market, 20/17, Kidwai Nagar, Wadala, Mumbai 400031", "400031", "UNCONFIRMED", { note: "Low online data — verify." }),
  v("mumbai-mehfile-panjetan-mahim", "Mehfil-e-Panjetan (Mahim)", ["Mehfil-e-Panjetan Mahim", "Mahim Panjetan Mehfil", "Panjetan Mehfil Mahim"], "Mehfil / Imambargah", "Mahim West", "Mumbai", "Dana Gali, Kapad Bazar, Mahim Bazar, Mahim West, Mumbai 400016", "400016", "UNCONFIRMED"),
  v("mumbai-imambada-sion-dharavi", "Imambada Sion Dharavi", ["Sion Dharavi Imambada", "Imambada Dharavi", "Sion Imambada"], "Imambargah", "Dharavi / Sion", "Mumbai", "Ashok Mill Compound Rd, Kala Qila, Dharavi, Mumbai 400017", "400017", "UNCONFIRMED", { note: "Low online data — verify." }),
  v("mumbai-madarsa-haidery-bandra-east", "Madarsa-e-Haidery Shia Masjid", ["Haidery Shia Masjid Bandra", "Madarsa-e-Haidery", "Haidery Masjid BKC"], "Masjid", "Bandra East (BKC)", "Mumbai", "10, G Block BKC, Patthar Nagar, Bharat Nagar, Bandra East, Mumbai 400051", "400051", "UNCONFIRMED"),
  v("mumbai-fatemid-mehfil-jogeshwari-west", "Fatemid Mehfil (Azakhana-e-Zahra S.A.)", ["Fatemid Mehfil", "Azakhana-e-Zahra", "Zahra Azakhana Jogeshwari"], "Mehfil / Imambargah", "Jogeshwari West", "Mumbai", "Lotus Park Wing-C, No.1, Aqsa Masjid Rd, Shastri Nagar, Jogeshwari West, Mumbai 400102", "400102", "UNCONFIRMED"),
  v("mumbai-madarsa-husainiya-khar", "Madarsa-e-Husainiya (Khar Shia Masjid)", ["Khar Shia Masjid", "Madarsa-e-Husainiya", "Husainiya Khar Masjid"], "Masjid / Madrasa", "Khar / Santacruz East", "Mumbai", "Khar, Golibar, Santacruz East, Mumbai 400055", "400055", "UNCONFIRMED", { phone: "+91 90221 22553", note: "Low online data — verify." }),
  v("mumbai-shia-masjid-khar-east", "Shia Masjid (Khar East)", ["Khar East Shia Masjid", "Shia Masjid Khar East"], "Masjid", "Khar East", "Mumbai", "Saiprasad CHSL, 6, Golibar Rd, Mahatma Society, Khar East, Mumbai 400055", "400055", "UNCONFIRMED", { note: "Lowest confidence in source list — verify existence and map." }),
  v("mumbai-bohra-shia-ithnashari-mazgaon", "Bohra Shia Ithnashari Jamaat (Mazgaon)", ["Bohra Shia Ithnashari Jamaat", "Mazgaon Bohra Shia Jamaat"], "Masjid / Jamaat Hall", "Mazgaon", "Mumbai", "4, Nesbit Road, Dholkawala Building, First St, Mazgaon, Mumbai 400010", "400010", "UNCONFIRMED", { phone: "+91 75062 05204", note: "Confirm sect/affiliation before listing publicly." }),
  v("mumbai-husainiya-masjid-sonapur-mulund", "Husainiya Masjid (Sonapur)", ["Husainiya Masjid Sonapur", "Sonapur Shia Masjid"], "Masjid", "Mulund West", "Mumbai", "Near Link Road, Sonapur Road, LBS Marg, Mulund West, Mumbai 400078", "400078", "YES", { note: "Shia affiliation not confirmed in supplied source." }),
  v("mmr-haidery-shia-jama-masjid-mira-road", "Haidery Shia Jama Masjid", ["Haidery Shia Jama Masjid Mira Road", "Haidery Masjid Mira Road", "Mira Road Haidery Masjid"], "Masjid", "Mira Road East", "Mira Road", "Hyderi Chowk Rd, Phase 1, Naya Nagar, Mira Road East 401107", "401107", "LIKELY"),
  v("mmr-saqqa-e-sakina-mira-road", "Saqqa-e-Sakina Masjid & Imambada", ["Mehfile Sakka e Sakina, Mira Road", "Saqa-e-Sakina", "Saqqa-e-Sakina", "Sakka e Sakina", "Saqqa-e-Sakina Masjid"], "Masjid / Imambargah", "Mira Road East", "Mira Road", "54, Naya Nagar Road, Naya Nagar, Mira Road East 401107", "401107", "NO", { note: "Daily jamaat only according to supplied source." }),
  v("mmr-mehfil-panjatani-mira-road", "Mehfil-e-Panjatani (Mira Road)", ["Mira Road Mehfil", "Mehfil-e-Panjatani Mira Road", "Panjatani Mehfil Mira Road"], "Mehfil / Imambargah", "Mira Road East", "Mira Road", "MTNL Rd, Sai Baba Nagar, Mira Road East 401107", "401107", "UNCONFIRMED", { phone: "+91 97023 76561" }),
  v("mmr-dar-e-imam-hussain-nalasopara", "Dar-e-Imam Hussain (a.s.)", ["Dar-e-Imam Hussain", "Dar e Imam Hussain", "Imam Hussain Nalasopara"], "Masjid", "Nalasopara East", "Nalasopara", "101, Siddhi Vinayak Apt, Alkapuri, Achole Rd, opposite R.K. School, Nalasopara East 401203", "401203", "YES", { note: "Re-check map pin." }),
  v("mmr-mehfil-panjatani-vasai", "Imambargah Mehfil-e-Panjatani (Vasai)", ["Vasai Mehfil", "Mehfil-e-Panjatani Vasai", "Panjatani Mehfil Vasai"], "Imambargah / Masjid", "Vasai West", "Vasai", "24, Ambadi Rd, Shastri Nagar, Vishal Nagar, Vasai West 401202", "401202", "YES"),
  v("mmr-shia-imambada-husaini-house-turbhe", "Shia Imambada (Husaini House)", ["Husaini House", "Shia Imambada Turbhe", "Husaini House Turbhe"], "Imambargah", "Turbhe", "Navi Mumbai", "Vashi-Turbhe Rd, opposite ICL School, Sector 21, Turbhe, Navi Mumbai 400703", "400703", "UNCONFIRMED"),
  v("mmr-mehfil-mohibbane-husain-mumbra", "Mehfil-e-Mohibbane Husain", ["Mumbra Mehfil", "Mehfil-e-Mohibbane Husain", "Mohibbane Husain"], "Masjid / Imambargah", "Mumbra East", "Mumbra", "Mumbra East, Mumbra - Kausa, Thane 400612", "400612", "YES"),
  v("mmr-azakhana-abutalib-mumbra", "Azakhana-e-Abutalib (Irani Imambargah)", ["Azakhana-e-Abutalib", "Irani Imambargah", "Abutalib Azakhana", "Suhana Mehfil"], "Imambargah", "Kausa, Mumbra", "Mumbra", "Dar us Salam Rashid Compound, Charnipada, Kausa, Mumbra, Thane 400612", "400612", "UNCONFIRMED", { note: "Low online data — verify. Suhana Mehfil is a user-provided candidate alias; do not treat as a confirmed match without verification." }),
  v("mmr-mehfil-e-masoomeen-mumbra", "Mehfil-e-Masoomeen", ["Mumbra Mehfil", "Mehfil-e-Masoomeen", "Mehfil Masoomeen"], "Mehfil / Masjid", "Kausa, Mumbra", "Mumbra", "15, Mumbai-Pune Rd, Amrut Nagar, Kausa, Mumbra, Thane 400612", "400612", "UNCONFIRMED"),
];

/** User-supplied names not yet matched to a venue. Kept apart from the 36 source rows until verified; never auto-merged. */
export const PENDING_MOSQUE_CANDIDATES: PendingMosqueCandidate[] = [
  { id: "candidate-mehfil-e-mustafa-andheri", submittedName: "Mehfil e Mustafa Andheri", status: "PENDING_VERIFICATION", notes: "Potentially related to a Juhu/Kapaswadi listing; do not merge without verification." },
  { id: "candidate-jannat-ul-hussain-mumbra", submittedName: "Jannat ul Hussain, Mumbra", status: "PENDING_VERIFICATION" },
  { id: "candidate-mumbra-mehfil", submittedName: "Mumbra Mehfil", status: "PENDING_VERIFICATION", notes: "Could refer to one of the Mumbra records; do not auto-merge." },
  { id: "candidate-suhana-mehfil", submittedName: "Suhana Mehfil", status: "PENDING_VERIFICATION" },
  { id: "candidate-vasai-mehfil", submittedName: "Vasai Mehfil", status: "PENDING_VERIFICATION" },
  { id: "candidate-palghar-mosque", submittedName: "Palghar Mosque", status: "PENDING_VERIFICATION", notes: "Not in the 36-row PDF dataset; verify separately." },
];
