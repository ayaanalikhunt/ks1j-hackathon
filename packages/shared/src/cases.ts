// Case lifecycle and review vocabulary shared by the dashboard, the app, the functions and the rules tests.

/** The steps a case moves through. `declined` sits outside the line ("Not approved"). */
export const STAGES = ["submitted", "verified", "approved", "published", "funded", "disbursed", "closed"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  submitted: "Submitted",
  verified: "Verified",
  approved: "Approved",
  published: "Published",
  funded: "Fully funded",
  disbursed: "Paid out",
  closed: "Closed",
};

/** Position of a status on the tracker, or -1 for draft/declined. */
export const stageIndex = (status: string) => STAGES.indexOf(status as Stage);

export const CASE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Waiting for verification",
  verified: "Verified, waiting for approval",
  approved: "Approved, waiting to be published",
  published: "Live for donors",
  funded: "Fully funded, waiting for payout",
  disbursed: "Paid out",
  closed: "Closed",
  declined: "Not approved",
};

/** Who acts next, for the dashboard queues. */
export const QUEUES = [
  ["submitted", "To verify", "Verifier or admin"],
  ["verified", "To approve", "Trustee or admin"],
  ["approved", "To publish", "Trustee or admin"],
  ["published", "Live for donors", "Donors"],
  ["funded", "Funded, to pay out", "Admin"],
  ["disbursed", "Paid out", "To close"],
  ["closed", "Closed", "Done"],
  ["declined", "Not approved", "Done"],
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  welfare: "Welfare",
  scholarship: "Scholarship",
  education_loan: "Education loan",
};

/** What the person needs help with. Drives which proof documents are expected. */
export const CASE_TYPES = ["medical", "education", "ration", "scholarship", "education_loan"] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  medical: "Medical",
  education: "Education",
  ration: "Ration",
  scholarship: "Scholarship",
  education_loan: "Education loan",
};

export const DECLINE_REASONS = ["insufficient_information", "missing_sources", "insufficient_proof", "other"] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const DECLINE_LABELS: Record<DeclineReason, string> = {
  insufficient_information: "Not enough information",
  missing_sources: "Sources cannot be confirmed",
  insufficient_proof: "Not enough proof or documents",
  other: "Other reason",
};

/** A denial needs a listed reason and a real note (matches firestore.rules). */
export const MIN_DECLINE_NOTE = 5;

// ---- Proof documents: compressed images in cases/{id}/documents ----
export const DOC_KINDS = [
  "aadhaar",
  "address_proof",
  "income_proof",
  "fee_receipt",
  "mark_sheet",
  "medical_report",
  "other",
] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_LABELS: Record<DocKind, string> = {
  aadhaar: "Aadhaar card (masked)",
  address_proof: "Address proof",
  income_proof: "Income proof",
  fee_receipt: "Fee receipt",
  mark_sheet: "Mark sheet",
  medical_report: "Medical report or bill",
  other: "Other document",
};

/** Always required, whatever the case is about. */
export const BASE_DOCS: DocKind[] = ["aadhaar", "address_proof"];

/** Extra proof expected for each kind of case. */
export const DOCS_BY_TYPE: Record<CaseType, DocKind[]> = {
  medical: ["medical_report", "income_proof"],
  education: ["fee_receipt", "mark_sheet", "income_proof"],
  ration: ["income_proof"],
  scholarship: ["mark_sheet", "fee_receipt", "income_proof"],
  education_loan: ["fee_receipt", "mark_sheet", "income_proof"],
};

export const requiredDocs = (type: string | undefined): DocKind[] => [
  ...BASE_DOCS,
  ...(DOCS_BY_TYPE[type as CaseType] ?? []),
];

/** Kept for the apply form: the two proofs every case needs. */
export const REQUIRED_DOCS = BASE_DOCS;

/** Firestore documents are capped at 1 MiB; keep each compressed photo well under it (matches firestore.rules). */
export const MAX_DOC_CHARS = 900_000;

// ---- Case events: the history log, and the member's "Updates for you" ----
export const EVENT_KINDS = [
  "submitted",
  "verified",
  "approved",
  "published",
  "funded",
  "paid_out",
  "closed",
  "declined",
  "document_added",
  "gift_received",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** What the applicant is told, in plain words. */
export const MEMBER_EVENT_TEXT: Record<EventKind, string> = {
  submitted: "Your request has been received. The committee will check it.",
  verified: "Your request has been verified. A trustee will look at it next.",
  approved: "Your request has been approved.",
  published: "Your request is now open for donors. Your name and contact details are hidden.",
  funded: "Your request is fully funded. The Jamaat will now pay the hospital, school or family.",
  paid_out: "The Jamaat has made the payment for your request.",
  closed: "Your request is closed.",
  declined: "Your request was not approved. Please contact the Jamaat office if you have questions.",
  document_added: "A document was added to your request.",
  gift_received: "A donor has given to your request.",
};

/** What the committee sees in the history log. */
export const STAFF_EVENT_TEXT: Record<EventKind, string> = {
  submitted: "Submitted",
  verified: "Verified",
  approved: "Approved",
  published: "Published to donors",
  funded: "Fully funded",
  paid_out: "Money handed over",
  closed: "Closed",
  declined: "Denied",
  document_added: "Document added",
  gift_received: "Gift received",
};

// ---- Funds ----
export const FUND_LABELS: Record<string, string> = {
  sehme_sadaat: "Sehme Sadaat",
  sehme_imam: "Sehme Imam",
  general: "General donation",
  lawajam: "Lawajam",
  loan_repayment: "Loan repayment",
};

/** The fund a case is paid from: Sadaat cases use Sehme Sadaat, others the general fund. */
export const caseFund = (sadaat: boolean | undefined) => (sadaat ? "sehme_sadaat" : "general");
