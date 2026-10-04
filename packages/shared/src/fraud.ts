// Fraud flags are hints, never verdicts. A person always decides. They are computed from the cases and members
// the committee can already see, so there is nothing to keep in step; only the decision is stored.

export const FLAG_KINDS = ["same_applicant", "same_household"] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

export const FLAG_LABELS: Record<FlagKind, string> = {
  same_applicant: "Same applicant already has an open case",
  same_household: "Same household already has an open case",
};

/** A case is "open" until it is paid out, closed or denied. */
export const OPEN_STATUSES = ["submitted", "verified", "approved", "published", "funded"] as const;
export const isOpenCase = (status: string) => (OPEN_STATUSES as readonly string[]).includes(status);

export interface FlagCase {
  id: string;
  applicantId: string;
  status: string;
  number?: number;
}
export interface FlagMember {
  id: string;
  householdId?: string;
}
export interface Flag {
  /** Stable id, so a decision stays attached to the same pair. */
  id: string;
  kind: FlagKind;
  /** The newer case (the one being looked at). */
  caseId: string;
  /** The older case it matches. */
  otherId: string;
}

/** Newest case first within a pair: a flag always reads "new case matches older case". */
const older = (a: FlagCase, b: FlagCase) => ((a.number ?? 0) <= (b.number ?? 0) ? [b, a] : [a, b]);

export function computeFlags(cases: FlagCase[], members: FlagMember[]): Flag[] {
  const open = cases.filter((c) => isOpenCase(c.status));
  const household = new Map(members.map((m) => [m.id, m.householdId || ""]));
  const flags: Flag[] = [];
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      const [newer, prior] = older(open[i], open[j]);
      let kind: FlagKind | null = null;
      if (newer.applicantId === prior.applicantId) kind = "same_applicant";
      else if (household.get(newer.applicantId) && household.get(newer.applicantId) === household.get(prior.applicantId)) kind = "same_household";
      if (kind) flags.push({ id: `${newer.id}__${prior.id}__${kind}`, kind, caseId: newer.id, otherId: prior.id });
    }
  }
  return flags;
}
