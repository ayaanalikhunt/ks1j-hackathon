"use client";

import { collection, onSnapshot, query, type QueryConstraint } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";

export type Row<T = Record<string, unknown>> = T & { id: string };

/** Live collection query. `constraints` should be stable (memoise or define at module scope). */
export function useCollection<T = Record<string, unknown>>(path: string, constraints: QueryConstraint[] = []) {
  const [rows, setRows] = useState<Row<T>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    return onSnapshot(
      query(collection(db, path), ...constraints),
      (s) => {
        setRows(s.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return { rows, error, loading };
}
