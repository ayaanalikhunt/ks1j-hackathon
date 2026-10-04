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
  }
}

/** Rule 1: verifier and approver must be different people. */
export function canApprove(verifiedBy: string | null | undefined, approver: string): boolean {
  return !!verifiedBy && verifiedBy !== approver;
}
