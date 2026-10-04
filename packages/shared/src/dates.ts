// One date style everywhere: DD/MM/YYYY and a 12-hour clock, in India time (IST). Timestamps are stored in UTC.

const IST_OFFSET_MS = 5.5 * 3600_000;
const pad = (n: number) => String(n).padStart(2, "0");

export type DateInput = Date | number | { seconds: number } | { toDate(): Date } | null | undefined;

function toDate(d: DateInput): Date | null {
  if (d == null) return null;
  if (d instanceof Date) return d;
  if (typeof d === "number") return new Date(d);
  if ("toDate" in d) return d.toDate();
  return new Date(d.seconds * 1000);
}

/** The IST wall-clock parts of an instant. */
function ist(d: Date) {
  const t = new Date(d.getTime() + IST_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, day: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes() };
}

/** 04/10/2026 */
export function formatDate(d: DateInput): string {
  const x = toDate(d);
  if (!x) return "";
  const p = ist(x);
  return `${pad(p.day)}/${pad(p.m)}/${p.y}`;
}

/** 5:42 pm */
export function formatTime(d: DateInput): string {
  const x = toDate(d);
  if (!x) return "";
  const p = ist(x);
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${h12}:${pad(p.min)} ${p.h < 12 ? "am" : "pm"}`;
}

/** 04/10/2026, 5:42 pm */
export function formatDateTime(d: DateInput): string {
  const x = toDate(d);
  return x ? `${formatDate(x)}, ${formatTime(x)}` : "";
}

/** "2026-10-04" (a calendar date, no time zone) to "04/10/2026". Anything else comes back unchanged. */
export function isoToDmy(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? "");
}

/** "04/10/2026" (also accepts 4/10/2026 and dashes) to "2026-10-04", or null if it is not a real date. */
export function parseDmy(s: string): string | null {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(s);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const real = new Date(Date.UTC(year, month - 1, day));
  if (real.getUTCFullYear() !== year || real.getUTCMonth() !== month - 1 || real.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Today in India as YYYY-MM-DD. */
export const todayIso = (now: Date = new Date()) => {
  const p = ist(now);
  return `${p.y}-${pad(p.m)}-${pad(p.day)}`;
};
