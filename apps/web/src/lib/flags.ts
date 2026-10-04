"use client";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { computeFlags, type Flag } from "@ks1j/shared";
import { db } from "./firebase";
import { useCollection } from "./useCollection";

interface CaseRow {
  applicantId: string;
  applicantName?: string;
  status: string;
  number?: number;
  title?: string;
}
export interface Decision {
  status: "clear" | "confirmed";
  by: string;
}

/** Computed duplicate hints with the human decision attached. Shared by the Fraud flags page and the case page. */
export function useFlags() {
  const cases = useCollection<CaseRow>("cases");
  const members = useCollection<{ householdId?: string }>("members");
  const decisions = useCollection<Decision>("fraudFlags");
  const flags = computeFlags(
    cases.rows.map((c) => ({ id: c.id, applicantId: c.applicantId, status: c.status, number: c.number })),
    members.rows.map((m) => ({ id: m.id, householdId: m.householdId })),
  );
  const decided = new Map(decisions.rows.map((d) => [d.id, d]));
  return { flags, decided, cases: cases.rows, error: cases.error ?? decisions.error };
}

export async function decideFlag(f: Flag, status: "clear" | "confirmed", by: string) {
  await setDoc(doc(db, "fraudFlags", f.id), { caseId: f.caseId, otherId: f.otherId, kind: f.kind, status, by, at: serverTimestamp() });
}
