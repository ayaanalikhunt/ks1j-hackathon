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
  "pan",
  "passport",
  "driving_licence",
  "voter_id",
  "ration_card",
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
  pan: "PAN card",
  passport: "Passport",
  driving_licence: "Driving licence",
  voter_id: "Voter ID",
  ration_card: "Ration card",
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

/**
 * Proof needed for a case. The identity document follows what the applicant chose. "None" means no identity upload and
 * no address-proof demand: the committee verifies another way instead of turning the family away.
 */
export const requiredDocs = (type: string | undefined, idProofType: IdProofType = "aadhaar"): DocKind[] => [
  ...(idProofType === "none" ? [] : [...(idDocKind(idProofType) ? [idDocKind(idProofType)!] : []), "address_proof" as DocKind]),
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
  "gift_allocated",
  "gift_refunded",
  "verification_recorded",
  "emergency_exception",
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
  gift_allocated: "A donor's donation was allocated to your request.",
  gift_refunded: "A donation to your request was refunded.",
  verification_recorded: "The committee recorded a verification step on your request.",
  emergency_exception: "The committee marked your request as urgent.",
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
  gift_received: "Donation received",
  gift_allocated: "Donation allocated",
  gift_refunded: "Donation refunded",
  verification_recorded: "Verification recorded",
  emergency_exception: "Emergency exception granted",
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

// ---- Identity proof: "None" is a real, allowed answer ----
export const ID_PROOF_TYPES = ["aadhaar", "pan", "passport", "driving_licence", "voter_id", "ration_card", "other", "none"] as const;
export type IdProofType = (typeof ID_PROOF_TYPES)[number];
export const ID_PROOF_LABELS: Record<IdProofType, string> = {
  aadhaar: "Aadhaar", pan: "PAN", passport: "Passport", driving_licence: "Driving licence", voter_id: "Voter ID",
  ration_card: "Ration card", other: "Other", none: "None",
};
/** The upload slot an identity choice fills. "Other" has no dedicated slot; "None" has no upload at all. */
export const idDocKind = (t: IdProofType): DocKind | null => (t === "none" ? null : t === "other" ? "other" : t);

export const NO_ID_REASONS = ["no_government_id", "document_lost", "minor", "emergency", "displaced", "privacy", "unable_to_obtain", "other"] as const;
export type NoIdReason = (typeof NO_ID_REASONS)[number];
export const NO_ID_REASON_LABELS: Record<NoIdReason, string> = {
  no_government_id: "No government ID available", document_lost: "Document lost", minor: "Minor beneficiary",
  emergency: "Emergency situation", displaced: "Refugee or displaced person", privacy: "Privacy concern",
  unable_to_obtain: "Unable to obtain a document", other: "Other",
};

/** How the committee verifies someone with no ID. "none_available" is only acceptable with an emergency exception. */
export const VERIFICATION_METHODS = [
  "committee_interview", "home_visit", "authorized_representative", "reference_check", "institution_document",
  "school_verification", "hospital_verification", "local_organization", "other", "none_available",
] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];
export const VERIFICATION_LABELS: Record<VerificationMethod, string> = {
  committee_interview: "Committee interview", home_visit: "Home visit", authorized_representative: "Authorised representative",
  reference_check: "Reference check", institution_document: "Document from an institution", school_verification: "School verification",
  hospital_verification: "Hospital verification", local_organization: "Local organisation verification", other: "Other",
  none_available: "None available",
};

/** Mirrors the approve rule: a case with no ID needs another verification, or a recorded emergency exception. */
export function identityCleared(c: { idProofType?: string; verificationMethod?: string; emergencyException?: unknown }): boolean {
  if ((c.idProofType ?? "aadhaar") !== "none") return true;
  if (c.emergencyException) return true;
  return !!c.verificationMethod && c.verificationMethod !== "none_available";
}

// ---- Need categories (the committee can add more) ----
export const NEED_CATEGORIES: Record<string, string> = {
  ration: "Ration", food: "Food", education_fees: "Education fees", school_fees: "School fees", college_fees: "College fees",
  healthcare: "Healthcare", medical_emergency: "Medical emergency", medicines: "Medicines", surgery: "Surgery", housing: "Housing",
  rent: "Rent", utility_bills: "Utility bills", clothing: "Clothing", travel: "Travel", funeral: "Funeral",
  disability_support: "Disability support", elderly_support: "Elderly support", children_support: "Children support",
  special_need: "Special need", other: "Other",
};
export const CATEGORY_FOR_TYPE: Record<string, string> = {
  medical: "healthcare", education: "education_fees", ration: "ration", scholarship: "education_fees", education_loan: "college_fees",
};

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

/** CASE-2026-000184: readable, sequential, and never the person's name. Year is the Indian calendar year. */
export function publicCaseId(number: number, when: Date = new Date()): string {
  const year = new Date(when.getTime() + 5.5 * 3600_000).getUTCFullYear();
  return `CASE-${year}-${String(number).padStart(6, "0")}`;
}
/** The stored id, or one derived from the case number for older cases. */
export const casePublicId = (c: { publicCaseId?: string; number?: number }) => c.publicCaseId ?? (c.number ? publicCaseId(c.number) : "");

// ---- Donation or loan: never confused ----
export const FINANCIAL_TYPES = {
  donation: { label: "Donation", note: "Money given without any expectation of repayment." },
  loan: { label: "Loan", note: "Money provided with an agreed repayment plan. Zero interest, zero late fees." },
} as const;
