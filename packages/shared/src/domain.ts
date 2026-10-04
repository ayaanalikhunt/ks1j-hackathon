// Domain enums/types. Keep in sync with firestore.rules and functions/.
export const ROLES = ["member", "verifier", "trustee", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const CASE_CATEGORIES = ["welfare", "scholarship", "education_loan"] as const;
export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export const CASE_STATUSES = [
  "draft",
  "submitted",
  "verified",
  "approved",
  "disbursed",
  "declined",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const FUND_TYPES = ["sehme_sadaat", "sehme_imam", "general"] as const;
export type FundType = (typeof FUND_TYPES)[number];

export const PAYMENT_STATUSES = ["pending", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const LOAN_STATUSES = [
  "applied",
  "emi_pending_agreement",
  "agreed",
  "disbursed",
  "repaying",
  "closed",
  "declined",
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const KHUMS_DISCLAIMER = "Confirm with your Marja' or the Jamaat's alim.";
export const DUMMY_PHONE = "+91 12345 67890";

/** Staff roles may see full beneficiary detail. */
export const isStaff = (r: Role) => r !== "member";
