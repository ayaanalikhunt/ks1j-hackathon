import { STAGES, STAGE_LABELS, stageIndex } from "@ks1j/shared";

/** The step line every case moves along. A denied case shows a single "Not approved" marker instead. */
export function Tracker({ status }: { status: string }) {
  if (status === "declined")
    return <p className="rounded-xl border border-red-400 px-3 py-2 text-sm font-semibold text-red-600">Not approved</p>;
  const at = stageIndex(status);
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2 text-xs sm:text-sm" aria-label="Case progress">
      {STAGES.map((s, i) => (
        <li
          key={s}
          aria-current={i === at ? "step" : undefined}
          className={`rounded-full border px-3 py-1 ${
            i < at ? "border-brand bg-brand/15" : i === at ? "border-brand bg-brand font-semibold text-[var(--bg)]" : "border-line text-muted"
          }`}
        >
          {i < at ? "✓ " : ""}
          {STAGE_LABELS[s]}
        </li>
      ))}
    </ol>
  );
}
