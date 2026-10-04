"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { MOSQUES, type MosqueVenue } from "@ks1j/shared";
import { db } from "./firebase";

const stamp = (v: unknown) => (v && typeof (v as { toDate?: () => Date }).toDate === "function" ? (v as { toDate: () => Date }).toDate().toISOString() : (v as string | null | undefined) ?? null);

/**
 * The mosque directory, live from Firestore (where volunteers verify venues). Until the collection has been loaded, or if it
 * cannot be read, the bundled source list is shown, so the finder always works. Bundled rows are all unverified.
 */
export function useMosques() {
  const [rows, setRows] = useState<MosqueVenue[]>(MOSQUES);
  const [live, setLive] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        collection(db, "mosques"),
        (s) => {
          if (s.empty) return;
          setRows(s.docs.map((d) => {
            const x = d.data();
            return { ...(x as MosqueVenue), id: d.id, verifiedAt: stamp(x.verifiedAt), lastCheckedAt: stamp(x.lastCheckedAt) };
          }));
          setLive(true);
        },
        () => {},
      ),
    [],
  );
  return { mosques: rows, live };
}
