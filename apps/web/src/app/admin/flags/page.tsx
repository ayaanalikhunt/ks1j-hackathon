"use client";

import Link from "next/link";
import { useState } from "react";
import { FLAG_LABELS } from "@ks1j/shared";
import { Banner, Button, Card, PageHeader } from "@/components/ui";
import { FurtherChecks } from "@/components/FurtherChecks";
import { useAuth } from "@/lib/auth";
import { decideFlag, useFlags } from "@/lib/flags";

export default function FraudFlags() {
  const { user } = useAuth();
  const { flags, decided, cases, error } = useFlags();
  const [showReviewed, setShowReviewed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const label = (id: string) => {
    const c = cases.find((x) => x.id === id);
    return c ? `${c.number ? `#${c.number} ` : ""}${c.title ?? "Case"}` : "Unknown case";
  };
  const who = (id: string) => cases.find((x) => x.id === id)?.applicantName || "Applicant";
  const open = flags.filter((f) => !decided.has(f.id));
  const shown = showReviewed ? flags : open;

  return (
    <>
      <PageHeader
        eyebrow="Committee dashboard"
        title="Fraud flags"
        intro="The first list is raised automatically when the same person or household already has an open case. A flag is a question, not a verdict: a verifier compares the cases and decides."
      />
      {(msg || error) && <div className="mb-3"><Banner kind={error ? "error" : "info"}>{error ?? msg}</Banner></div>}
      <label className="mb-4 flex min-h-11 items-center gap-2">
        <input type="checkbox" checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} />
        Show reviewed flags too
      </label>
      {shown.length === 0 && <Banner>{showReviewed ? "No flags at all." : "No open flags. Nothing needs checking."}</Banner>}
      <div className="space-y-3">
        {shown.map((f) => {
          const d = decided.get(f.id);
          return (
            <Card key={f.id} className="space-y-2">
              <p className="font-semibold">{FLAG_LABELS[f.kind]}</p>
              <p className="text-sm">
                New case: <Link className="underline" href={`/admin/cases/detail?id=${f.caseId}`}>{label(f.caseId)}</Link> ({who(f.caseId)})
              </p>
              <p className="text-sm">
                Matches: <Link className="underline" href={`/admin/cases/detail?id=${f.otherId}`}>{label(f.otherId)}</Link> ({who(f.otherId)})
              </p>
              {d ? (
                <p className="text-sm text-muted">{d.status === "clear" ? "Reviewed: not a problem." : "Reviewed: confirmed duplicate."}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button className="!min-h-10 !bg-card !px-4 !text-fg border border-line" onClick={() => decideFlag(f, "clear", user!.uid).catch((e) => setMsg(e.message))}>Not a problem: clear</Button>
                  <Button className="!min-h-10 !px-4" onClick={() => decideFlag(f, "confirmed", user!.uid).catch((e) => setMsg(e.message))}>Confirm duplicate</Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <FurtherChecks />
    </>
  );
}
