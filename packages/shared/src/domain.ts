// Domain enums/types. Keep in sync with firestore.rules and functions/.
export const ROLES = ["member", "volunteer", "verifier", "trustee", "admin", "super_admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

export const CASE_CATEGORIES = ["welfare", "scholarship", "education_loan"] as const;
export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export const CASE_STATUSES = [
  "draft",
  "submitted",
  "verified",
  "approved",
  "published",
  "funded",
  "disbursed",
  "closed",
  "declined",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const FUND_TYPES = ["sehme_sadaat", "sehme_imam", "general", "lawajam", "loan_repayment"] as const;
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

/** Staff may see full beneficiary detail. Volunteers are not staff. */
export const isStaff = (r: Role) => r !== "member" && r !== "volunteer";
/** Admin-level: admin, super_admin, owner. */
export const isAdminLike = (r: Role | undefined) => r === "admin" || r === "super_admin" || r === "owner";
/** May open the dashboard: staff plus volunteers (who only see community and announcements). */
export const canOpenDashboard = (r: Role) => r !== "member";
/** Owner assigns any role; a super_admin assigns roles below super_admin only. */
export const canAssignRole = (actor: Role, from: Role, to: Role) =>
  actor === "owner" ||
  (actor === "super_admin" && !["owner", "super_admin"].includes(from) && !["owner", "super_admin"].includes(to));
