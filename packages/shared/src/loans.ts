// Education loans (Qard-e-Hasana). No interest and no late fees, ever: there is no field anywhere that could hold either.

/** The longest repayment plan: the minimum monthly amount is the loan spread over this many months. */
export const MAX_REPAYMENT_MONTHS = 48;
/** Repayment starts this many months after the course ends. */
export const GRACE_MONTHS = 6;
/** Reminders start at once, but a person only acts from this many days late. */
export const ACT_AFTER_DAYS = 15;

export const minEmi = (principal: number) => Math.ceil(principal / MAX_REPAYMENT_MONTHS);

/** "2027-10-01" plus the grace period. Months are added in whole calendar months, clamped to the month length. */
export function firstEmiDate(courseEnd: string, graceMonths = GRACE_MONTHS): string {
  const [y, m, d] = courseEnd.split("-").map(Number);
  const total = y * 12 + (m - 1) + graceMonths;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** The same day next month, clamped. Used to move "next due" forward after an instalment is paid. */
export const nextMonth = (date: string) => firstEmiDate(date, 1);

const utc = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole days from one YYYY-MM-DD date to another (negative if `to` is earlier). */
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000);

export type FollowUp = "on_track" | "due_soon" | "late" | "act" | "hardship";

export const FOLLOWUP_LABELS: Record<FollowUp, string> = {
  on_track: "On track",
  due_soon: "Due soon",
  late: "Late: reminders going out",
  act: "Late: a person should reach out",
  hardship: "Hardship under review",
};

/** Where a repaying loan stands today. A hardship request pauses the reminders until a trustee decides. */
export function followUp(loan: { nextDue?: string; hardshipPending?: boolean }, today: string): FollowUp {
  if (loan.hardshipPending) return "hardship";
  if (!loan.nextDue) return "on_track";
  const late = daysBetween(loan.nextDue, today);
  if (late >= ACT_AFTER_DAYS) return "act";
  if (late > 0) return "late";
  return late >= -7 ? "due_soon" : "on_track";
}

// ---- Background check ----
/** Every loan needs these confirmed by the committee before a plan can be proposed. */
export const BASE_CHECKS = ["identity", "address", "income", "institution_fee"] as const;
/** Orphan loans also need these, including a home visit by someone who is not the approver. */
export const ORPHAN_CHECKS = ["orphan_status", "guardian", "references", "no_other_loans", "home_visit"] as const;
export type CheckKey = (typeof BASE_CHECKS)[number] | (typeof ORPHAN_CHECKS)[number];

export const CHECK_LABELS: Record<CheckKey, string> = {
  identity: "Identity confirmed against the Aadhaar card",
  address: "Address confirmed against the address proof",
  income: "Household income confirmed against the income proof",
  institution_fee: "School or college confirmed the course and the fee",
  orphan_status: "Orphan status confirmed against the death certificate",
  guardian: "Guardian's identity, address and income confirmed",
  references: "Both references called and they vouch for the family",
  no_other_loans: "No other loan or help already taken for the same fees",
  home_visit: "Home visit done, with a written report",
};

export const requiredChecks = (orphan: boolean): CheckKey[] => [...BASE_CHECKS, ...(orphan ? ORPHAN_CHECKS : [])];

// ---- Documents ----
export const LOAN_DOC_KINDS = [
  "aadhaar",
  "address_proof",
  "income_proof",
  "admission_letter",
  "fee_structure",
  "mark_sheet",
  "death_certificate",
  "guardian_id",
  "other",
] as const;
export type LoanDocKind = (typeof LOAN_DOC_KINDS)[number];

export const LOAN_DOC_LABELS: Record<LoanDocKind, string> = {
  aadhaar: "Aadhaar card (masked)",
  address_proof: "Address proof",
  income_proof: "Household income proof",
  admission_letter: "Admission letter",
  fee_structure: "Fee structure from the institution",
  mark_sheet: "Last mark sheet",
  death_certificate: "Death certificate",
  guardian_id: "Guardian's ID",
  other: "Other document",
};

export const requiredLoanDocs = (orphan: boolean): LoanDocKind[] => [
  "aadhaar",
  "address_proof",
  "income_proof",
  "admission_letter",
  "fee_structure",
  "mark_sheet",
  ...(orphan ? (["death_certificate", "guardian_id"] as LoanDocKind[]) : []),
];

export const PARENT_STATUS = ["both_deceased", "father_deceased", "mother_deceased"] as const;
export type ParentStatus = (typeof PARENT_STATUS)[number];
export const PARENT_STATUS_LABELS: Record<ParentStatus, string> = {
  both_deceased: "Both parents have passed away",
  father_deceased: "Father has passed away",
  mother_deceased: "Mother has passed away",
};

// ---- Hardship ----
export const HARDSHIP_TYPES = ["pause", "lower"] as const;
export type HardshipType = (typeof HARDSHIP_TYPES)[number];

export const LOAN_STATUS_LABELS: Record<string, string> = {
  applied: "Being checked by the committee",
  emi_pending_agreement: "Agree a monthly amount",
  agreed: "Agreed, waiting for the payout",
  disbursed: "Paid out, repayment starts after the course",
  repaying: "Repaying",
  closed: "Fully repaid",
  declined: "Not approved",
};
