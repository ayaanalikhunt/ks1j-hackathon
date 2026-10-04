"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "./firebase";

type Parent = "cases" | "loans" | "institutions";
export type DocRow<T> = T & { id: string; dataUrl: string; addedBy?: string | null; name?: string | null };

const fns = () => getFunctions(auth.app, "asia-south1");
const list = () => httpsCallable<unknown, { documents: { id: string; kind: string; name: string | null; addedBy: string | null }[] }>(fns(), "listDocuments");
const get = () => httpsCallable<unknown, { kind: string; name: string | null; dataUrl: string }>(fns(), "getDocument");

/**
 * Documents are private: they are fetched through a function that checks who is asking and records the view. Each image is
 * fetched once per page; adding a document with `reload()` fetches only the new one.
 */
export function useDocs<T extends { kind: string }>(parent: Parent, id: string) {
  const [rows, setRows] = useState<DocRow<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<string, string>());
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!id) return;
    let live = true;
    (async () => {
      try {
        const { documents } = (await list()({ parent, id })).data;
        const out: DocRow<T>[] = [];
        for (const d of documents) {
          if (!cache.current.has(d.id)) cache.current.set(d.id, (await get()({ parent, id, docId: d.id })).data.dataUrl);
          out.push({ id: d.id, kind: d.kind, name: d.name, addedBy: d.addedBy, dataUrl: cache.current.get(d.id)! } as DocRow<T>);
        }
        if (live) {
          setRows(out);
          setError(null);
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [parent, id, tick]);

  return { rows, loading, error, reload };
}
