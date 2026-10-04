import { useCallback, useEffect, useRef, useState } from "react";
import { callFn } from "./functions";

export type DocRow<T> = T & { id: string; dataUrl: string; name?: string | null };

/**
 * The applicant's own documents. They are private: fetched through a function that checks who is asking.
 * Each image is fetched once; `reload()` after adding one fetches only the new one.
 */
export function useDocs<T extends { kind: string }>(parent: "cases" | "loans", id: string) {
  const [rows, setRows] = useState<DocRow<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const cache = useRef(new Map<string, string>());
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!id) return;
    let live = true;
    (async () => {
      try {
        const { documents } = await callFn<{ documents: { id: string; kind: string; name: string | null }[] }>("listDocuments", { parent, id });
        const out: DocRow<T>[] = [];
        for (const d of documents) {
          if (!cache.current.has(d.id)) cache.current.set(d.id, (await callFn<{ dataUrl: string }>("getDocument", { parent, id, docId: d.id })).dataUrl);
          out.push({ id: d.id, kind: d.kind, name: d.name, dataUrl: cache.current.get(d.id)! } as DocRow<T>);
        }
        if (live) setRows(out);
      } catch {
        /* the list simply stays empty */
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [parent, id, tick]);

  return { rows, loading, reload };
}
