// Case review vocabulary shared by the dashboard and the rules tests.
export const DECLINE_REASONS = ["insufficient_information", "missing_sources", "insufficient_proof", "other"] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export const DECLINE_LABELS: Record<DeclineReason, string> = {
  insufficient_information: "Not enough information",
  missing_sources: "Sources cannot be confirmed",
  insufficient_proof: "Not enough proof or documents",
  other: "Other reason",
};

export const CASE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Waiting for verification",
  verified: "Verified, waiting for approval",
  approved: "Approved, ready for payout",
  disbursed: "Paid out",
  declined: "Denied",
};

export const CATEGORY_LABELS: Record<string, string> = {
  welfare: "Welfare",
  scholarship: "Scholarship",
  education_loan: "Education support",
};

/** A cancel needs a listed reason and a real note (matches firestore.rules). */
export const MIN_DECLINE_NOTE = 5;

// Proof documents attached to a case. Stored as compressed images in cases/{id}/documents.
export const DOC_KINDS = ["aadhaar", "address_proof", "income_proof", "other"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_LABELS: Record<DocKind, string> = {
  aadhaar: "Aadhaar card",
  address_proof: "Address proof",
  income_proof: "Income or other proof",
  other: "Other document",
};

/** Aadhaar and address proof are required before a case can be submitted. */
export const REQUIRED_DOCS: DocKind[] = ["aadhaar", "address_proof"];

/** Firestore documents are capped at 1 MiB; keep each compressed photo well under it (matches firestore.rules). */
export const MAX_DOC_CHARS = 900_000;
