export const OPPORTUNITY_KINDS = ["job", "internship", "referral"] as const;
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];
export const OPPORTUNITY_LABELS: Record<OpportunityKind, string> = {
  job: "Job",
  internship: "Internship",
  referral: "Referral",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function timeAgo(then: Date | number, now: Date | number = Date.now()): string {
  const s = Math.max(0, Math.floor((+now - +then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

/** "a, b ,, c" -> ["a","b","c"] */
export function splitList(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
