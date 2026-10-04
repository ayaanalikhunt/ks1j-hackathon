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
  declined: "Cancelled",
};

export const CATEGORY_LABELS: Record<string, string> = {
  welfare: "Welfare",
  scholarship: "Scholarship",
  education_loan: "Education support",
};

/** A cancel needs a listed reason and a real note (matches firestore.rules). */
export const MIN_DECLINE_NOTE = 5;
