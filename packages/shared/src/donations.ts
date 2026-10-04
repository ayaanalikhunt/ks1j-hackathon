import type { FundType } from "./domain";

export interface DonationTarget {
  kind: "case" | "institution";
  /** case: beneficiary is a verified Sadaat (Syed). */
  beneficiaryVerifiedSadaat?: boolean;
  /** institution: holds a verified ijazah from a Marja'. */
  ijazahVerified?: boolean;
}

/** Mirrors the Firestore rule / callable function. Keep in lockstep. */
export function isDonationAllowed(fund: FundType, target: DonationTarget): boolean {
  switch (fund) {
    case "sehme_sadaat":
      return target.kind === "case" && target.beneficiaryVerifiedSadaat === true;
    case "sehme_imam":
      return target.kind === "institution" && target.ijazahVerified === true;
    case "general":
      return target.kind === "case";
    // Lawajam dues and loan repayments are not gifts to a case or institution.
    case "lawajam":
    case "loan_repayment":
      return false;
  }
}

/** Rule 1: verifier and approver must be different people. */
export function canApprove(verifiedBy: string | null | undefined, approver: string): boolean {
  return !!verifiedBy && verifiedBy !== approver;
}

export const PURPOSE_LABELS: Record<string, string> = {
  general_support: "General support", ration: "Ration", education_fees: "Education fees", healthcare: "Healthcare",
  medical_emergency: "Medical emergency", housing: "Housing", utility_bills: "Utility bills", food: "Food", clothing: "Clothing",
  travel: "Travel", funeral_support: "Funeral support", children_support: "Children support", elderly_support: "Elderly support",
  disability_support: "Disability support", special_need: "Special need", zakat: "Zakat", khums: "Khums", sadaqah: "Sadaqah",
  lillah: "Lillah", other: "Other",
};
/** Zakat and Khums are tracked separately and only go to cases the committee has marked eligible. */
export const RESTRICTED_PURPOSES = ["zakat", "khums"];

export const VISIBILITY_LABELS: Record<string, string> = {
  public: "Public: show my chosen name",
  private: "Private: only the committee sees who I am",
  anonymous: "Anonymous: hidden from every public page",
};

/** What a donor sees, in plain words, derived only from the verified record. */
export function donationStage(d: { status?: string; allocatedAmount?: number; disbursedAmount?: number; amount: number }): string {
  if (d.status === "refunded") return "Refunded";
  if (d.status !== "paid") return "Payment pending";
  const a = d.allocatedAmount ?? 0;
  const p = d.disbursedAmount ?? 0;
  if (p >= d.amount) return "Disbursed";
  if (p > 0) return "Partly disbursed";
  if (a >= d.amount) return "Allocated, disbursement pending";
  if (a > 0) return "Partly allocated";
  return "Payment verified, allocation pending";
}

// ---- Donor profile and notification choices ----
export const DONOR_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "CAD", "AUD", "SGD", "QAR", "KWD"] as const;
export type DonorCurrency = (typeof DONOR_CURRENCIES)[number];

/** In-app notifications a donor can switch on or off. Email and SMS are not offered. */
export const DONOR_NOTIFICATION_LABELS = {
  received: "My donation is received",
  allocated: "My donation is allocated to a case",
  disbursed: "My allocated funds are paid out",
  refunded: "A refund is issued",
} as const;
export type DonorNotificationKey = keyof typeof DONOR_NOTIFICATION_LABELS;
export const DONOR_NOTIFICATION_KEYS = Object.keys(DONOR_NOTIFICATION_LABELS) as DonorNotificationKey[];
/** Everything is on until the donor turns it off. */
export const donorWants = (prefs: Partial<Record<DonorNotificationKey, boolean>> | undefined, key: DonorNotificationKey) => prefs?.[key] !== false;
