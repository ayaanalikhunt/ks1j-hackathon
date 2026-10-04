"use client";

import type { ReactNode } from "react";
import type { Row } from "@/lib/useCollection";
import { Banner } from "./ui";
import { useReveal } from "./useReveal";

export interface Col<T> {
  head: string;
  cell: (r: Row<T>) => ReactNode;
}

/** Minimal responsive table used across the admin dashboard. */
export function Table<T>({
  rows,
  cols,
  empty = "Nothing here yet.",
  error,
}: {
  rows: Row<T>[];
  cols: Col<T>[];
  empty?: string;
  error?: string | null;
}) {
  const ref = useReveal<HTMLDivElement>();
  if (error) return <Banner kind="error">{error}</Banner>;
  if (rows.length === 0) return <Banner>{empty}</Banner>;
  return (
    <div ref={ref} className="reveal overflow-x-auto rounded-2xl border border-line bg-card shadow-soft">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-muted">
            {cols.map((c) => (
              <th key={c.head} className="px-3 py-3 font-medium">
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0">
              {cols.map((c) => (
                <td key={c.head} className="px-3 py-3 align-top">
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
