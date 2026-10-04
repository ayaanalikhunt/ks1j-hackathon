import { collection, doc, onSnapshot, query, type QueryConstraint } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";

export type Row<T = Record<string, any>> = T & { id: string };

/** Live collection. `deps` re-subscribes; pass constraints built from stable values. */
export function useCollection<T = Record<string, any>>(
  path: string | null,
  constraints: QueryConstraint[] = [],
  deps: unknown[] = [],
) {
  const [rows, setRows] = useState<Row<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    setLoading(true);
    return onSnapshot(
      query(collection(db, path), ...constraints),
      (s) => {
        setRows(s.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
        setError(null);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  return { rows, loading, error };
}

/** Live single document (`undefined` = loading, `null` = missing). */
export function useDocument<T = Record<string, any>>(path: string | null) {
  const [data, setData] = useState<Row<T> | null | undefined>(undefined);
  useEffect(() => {
    if (!path) {
      setData(null);
      return;
    }
    return onSnapshot(
      doc(db, path),
      (s) => setData(s.exists() ? ({ id: s.id, ...(s.data() as T) } as Row<T>) : null),
      () => setData(null),
    );
  }, [path]);
  return data;
}
