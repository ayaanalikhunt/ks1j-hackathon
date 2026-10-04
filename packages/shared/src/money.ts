// All money is integer rupees. No floats, no paise, no interest, no late fees.

/** 132800 -> "₹1,32,800" (Indian digit grouping). */
export function formatRupees(amount: number): string {
  const n = Math.trunc(amount);
  const sign = n < 0 ? "-" : "";
  const s = String(Math.abs(n));
  if (s.length <= 3) return `${sign}₹${s}`;
  const head = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}₹${head},${s.slice(-3)}`;
}

/** Khums is one fifth (20%) of net annual surplus. Result in whole rupees (rounded up). */
export function khumsDue(surplus: number): number {
  if (!Number.isInteger(surplus) || surplus < 0) throw new Error("surplus must be a non-negative integer");
  return Math.ceil(surplus / 5);
}

/** Zero-interest EMI: principal split evenly, any remainder lands in the first instalments. */
export function emiSchedule(principal: number, months: number): number[] {
  if (!Number.isInteger(principal) || principal <= 0) throw new Error("principal must be a positive integer");
  if (!Number.isInteger(months) || months <= 0) throw new Error("months must be a positive integer");
  const base = Math.floor(principal / months);
  const extra = principal - base * months;
  return Array.from({ length: months }, (_, i) => base + (i < extra ? 1 : 0));
}
