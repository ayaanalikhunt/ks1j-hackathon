"use client";

import { useInView } from "./motion";

const STAGES = ["Donation", "Fund", "Verification", "Approval", "Payment", "Receipt"];

// One lane per account. The words under each stage say what that stage means for that fund. Lanes never join:
// the app keeps each fund in its own account, and a payment can only leave a fund for what that fund allows.
const LANES: { name: string; note: string; steps: string[] }[] = [
  { name: "Sehme Imam", note: "Half of Khums", steps: ["Khums share", "Sehme Imam account", "Payment confirmed", "Institution with a verified ijazah", "Paid to the institution", "Receipt"] },
  { name: "Sehme Sadaat", note: "Half of Khums", steps: ["Khums share", "Sehme Sadaat account", "Payment confirmed", "Verified Sadaat case only", "Paid to the case", "Receipt"] },
  { name: "General donations", note: "Welfare and education", steps: ["Your donation", "General fund", "Payment confirmed", "Case approved by a second member", "Paid to the hospital, school or family", "Receipt"] },
  { name: "Loan repayments", note: "Interest-free loans", steps: ["Monthly repayment", "Loan account", "Office confirms", "Recorded against the loan", "Back into the loan fund", "Receipt"] },
  { name: "Lawajam", note: "Household dues", steps: ["Yearly dues", "Lawajam account", "Office confirms", "Recorded for the household", "Spent only from Lawajam", "Receipt"] },
];

export function MoneyFlow() {
  const { ref, seen } = useInView<HTMLDivElement>(0.3);
  return (
    <section aria-labelledby="flow-title">
      <p className="section-no text-brand">04 · Every rupee accounted for</p>
      <h2 id="flow-title" className="split-title mt-2 max-w-2xl">Five funds. Five paths. They never cross.</h2>
      <p className="split-body">Each kind of money has its own account and its own rules, checked by the system every time. A Sadaat share cannot pay a general case, and a loan repayment is never counted as a donation.</p>

      <div ref={ref} className={`mt-10 rounded-3xl border border-line bg-card p-5 sm:p-8 ${seen ? "flow-on" : ""}`}>
        <div className="hidden grid-cols-[11rem_1fr] gap-4 lg:grid" aria-hidden>
          <span />
          <div className="grid grid-cols-6 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {STAGES.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
        <ul className="mt-2 space-y-6 lg:space-y-4">
          {LANES.map((l, li) => (
            <li key={l.name} className="grid gap-3 lg:grid-cols-[11rem_1fr] lg:items-center lg:gap-4">
              <div>
                <p className="font-display text-lg leading-tight">{l.name}</p>
                <p className="text-xs text-muted">{l.note}</p>
              </div>
              {/* wide: a track with six stops and a dot that travels it once */}
              <div className="relative hidden lg:block" style={{ ["--lane" as string]: String(li) }}>
                <div className="absolute left-[8.33%] right-[8.33%] top-[11px] h-px bg-line" />
                <div className="flow-fill absolute left-[8.33%] top-[11px] h-px bg-gold" />
                <span className="flow-dot absolute top-[5px] h-[13px] w-[13px] rounded-full bg-gold shadow-[0_0_0_4px_rgba(216,180,90,0.18)]" aria-hidden />
                <ol className="relative grid grid-cols-6">
                  {l.steps.map((s, k) => (
                    <li key={k} className="flex flex-col items-center px-1 text-center">
                      <span className="flow-node mb-2 h-[23px] w-[23px] rounded-full border-2 bg-card" style={{ ["--k" as string]: String(k) }} />
                      <span className="text-[12px] leading-snug text-muted">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {/* phones: the same path as a short chain */}
              <ol className="flex flex-wrap items-center gap-1.5 lg:hidden">
                {l.steps.map((s, k) => (
                  <li key={k} className="flex items-center gap-1.5 text-xs">
                    <span className="rounded-full border border-line px-2.5 py-1">{s}</span>
                    {k < l.steps.length - 1 && <span className="text-gold" aria-hidden>→</span>}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">Every figure on the Transparency page is added up from these same records: verified payments, committee allocations and recorded payouts.</p>
      </div>
    </section>
  );
}
