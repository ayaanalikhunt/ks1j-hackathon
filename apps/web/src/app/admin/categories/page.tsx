"use client";

import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import { useState } from "react";
import { NEED_CATEGORIES, isAdminLike } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

export default function Categories() {
  const { user, member } = useAuth();
  const { rows, error } = useCollection<{ label: string; active: boolean }>("caseCategories");
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const admin = isAdminLike(member?.role);

  async function add() {
    setMsg(null);
    try {
      await addDoc(collection(db, "caseCategories"), { label: label.trim(), active: true, createdBy: user!.uid });
      setLabel("");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Case categories" intro="The built-in list is below. Add a category when a need does not fit it." />
      <Card className="mb-6">
        <h2 className="font-display text-xl">Built in</h2>
        <p className="mt-2 text-sm text-muted">{Object.values(NEED_CATEGORIES).join(" · ")}</p>
      </Card>
      {admin && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-60 flex-1"><Field label="New category" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} /></div>
            <Button disabled={label.trim().length < 2} onClick={add}>Add category</Button>
          </div>
          {msg && <div className="mt-3"><Banner kind="error">{msg}</Banner></div>}
        </Card>
      )}
      <h2 className="mb-2 font-display text-2xl">Added by the committee</h2>
      <Table<{ label: string; active: boolean }>
        rows={rows}
        error={error}
        empty="None added yet."
        cols={[
          { head: "Category", cell: (r) => r.label },
          { head: "", cell: (r) => admin && <Button className="!min-h-9 !px-3" onClick={() => deleteDoc(doc(db, "caseCategories", r.id))}>Remove</Button> },
        ]}
      />
    </>
  );
}
