"use client";

import { onSnapshot, type Query } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { Row } from "./useCollection";

/** Live results for a query that depends on the signed-in user. Pass null until it can run. */
export function useQueryRows<T>(q: Query | null, key: string) {
  const [rows, setRows] = useState<Row<T>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!q) return;
    return onSnapshot(
      q,
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
  }, [key]);
  return { rows, error, loading };
}
