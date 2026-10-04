// Lawajam: yearly membership dues, one per household, in their own ledger.

/** "2026-27" for dates from April 2026 to March 2027 (the Indian financial year, IST). */
export function lawajamYear(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export const LAWAJAM_YEAR_PATTERN = /^\d{4}-\d{2}$/;
