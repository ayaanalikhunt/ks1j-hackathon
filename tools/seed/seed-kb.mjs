// The Jamaat helpdesk's starting knowledge: how KS1J itself works, taken from the app's own rules and screens. These are
// procedures, not religious rulings; questions of fiqh go to the Ask AI Guide and, for certainty, to a Marja's office.
// The committee can edit or add entries at /admin/helpdesk. Fixed ids, so re-running updates rather than duplicates.
//
//   node tools/seed/seed-kb.mjs        (from the repo root, after gcloud auth application-default login)
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const SOURCE = "KS1J: how the app works (committee rules, October 2026)";
const KB = [
  ["apply", "How to apply for help (welfare, medical, education, ration)", "Open the app, go to Services and tap Apply for help. Choose what you need help with, describe the need and the amount, and attach the documents asked for. You can follow every step of your application in Services, My applications."],
  ["privacy", "Who can see my application and my name", "Only the Jamaat committee assigned to your case sees your details. Donors never see your name, your address or what you wrote. Public case pages show only a reference number, a category and the amounts."],
  ["approval", "How a case is checked and approved", "A verifier first checks the case, its sources and its proof. A different committee member then approves it. The same person can never verify and approve the same case: the system refuses it."],
  ["no-id", "I do not have an ID document", "You will not be turned away. The committee will verify your situation another way. Tell them briefly why there is no ID."],
  ["loan", "How education loans work (Qard-e-Hasana)", "Education loans are interest-free, with no late fees, ever. You and a trustee agree a monthly amount before anything is paid out. Repayment starts six months after the course ends, and the monthly amount must repay the loan within 48 months. An orphan loan includes a fuller background check with a home visit."],
  ["loan-hardship", "I am finding it hard to repay my loan", "Open Services, My loans and tap I am finding it hard to pay. You can ask to pause for a few months or to pay a lower amount. Reminders stop while a trustee decides, and a person will reach out kindly. There are never late fees."],
  ["khums-split", "Where my Khums goes", "Khums is one fifth (20%) of your surplus at your Khums year-end, shared equally between Sehme Imam and Sehme Sadaat. In KS1J, Sehme Imam goes only to institutions holding a verified ijazah from a Marja', and Sehme Sadaat goes only to verified Sadaat cases. The calculator is a guide only: confirm with your Marja' or the Jamaat's alim."],
  ["sadaat", "How Sadaat status is checked", "When a case is marked Sadaat (Syed), the committee checks the Aadhaar card before confirming it. Only confirmed Sadaat cases can receive Sehme Sadaat."],
  ["funds", "Are the funds kept separate", "Yes. Sehme Imam, Sehme Sadaat, general donations, loan repayments and Lawajam each have their own account. Money is only paid from a fund for what that fund allows, and a loan repayment is never counted as a donation."],
  ["donation-status", "Where did my donation go", "Open Give, My donations and tap the donation. It shows whether the payment is verified, how much the committee has allocated, to which case reference, and what has been paid out. The app never says a donation has helped someone before the committee has actually allocated it."],
  ["receipt", "When do I get a receipt", "A receipt is available once the payment is verified. Open the donation and tap Share receipt (PDF). Until then the donation shows as pending. My donations also has a statement of all your donations as a PDF."],
  ["name-shown", "Will my name be shown when I donate", "You choose: Private (only the committee sees who you are), Anonymous (hidden from every public page), or Show my name."],
  ["lawajam", "Lawajam (household dues)", "Lawajam is the yearly due for your household, kept in its own account and never mixed with Khums or cases. You see it once the Jamaat office has linked your household, after checking who you are. A payment shows as pending until the office confirms it."],
  ["transparency", "How can I check how money is used", "The Transparency page on the website shows totals added up from verified payments, committee allocations and recorded payouts, plus recent case and loan references. No donor or family is named."],
  ["mosques", "Finding a Shia masjid and Friday prayer", "Open Services, Mosques (or Mosques on the website). Search by name or area, or use your location for the nearest. Distances are approximate. On Friday it shows masajid reported to hold Jummah; exact times are only shown once confirmed, so check the time before you travel."],
  ["language", "Changing the app language", "Open your profile and choose English, Gujarati, Hindi or Urdu. The menus change straight away. Notices from the Jamaat stay in the language they were written in."],
  ["contact", "How to contact the Jamaat office", "Use the Contact page on the website for the office's details. Updates about your own application or donation also appear as notifications in the app."],
];

initializeApp({ credential: applicationDefault(), projectId: "ks1j-8a2e3" });
const db = getFirestore();
const batch = db.batch();
for (const [id, title, body] of KB) {
  batch.set(db.doc(`kbDocuments/ks1j-${id}`), { title, body, source: SOURCE, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
await batch.commit();
console.log(`${KB.length} helpdesk entries written.`);
