"use client";

import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { Table } from "@/components/Table";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface Institution {
  name: string;
  marja?: string;
  ijazahVerified: boolean;
}

export default function AdminInstitutions() {
  const { member } = useAuth();
  const { rows, error } = useCollection<Institution>("institutions");
  const [name, setName] = useState("");
  const [marja, setMarja] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const isAdmin = member?.role === "admin";
  const guard = (p: Promise<unknown>) => p.catch((e) => setMsg((e as Error).message));
  return (
    <>
      <PageHeader
        eyebrow="Committee dashboard"
        title="Institutions"
        intro="Only institutions with a verified ijazah from a Marja' can receive Sehme Imam."
      />
      {msg && <Banner kind="error">{msg}</Banner>}
      {isAdmin && (
        <Card className="mb-4 grid gap-3 sm:grid-cols-3">
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Marja'" value={marja} onChange={(e) => setMarja(e.target.value)} />
          <Button
            className="self-end"
            disabled={!name}
            onClick={() => guard(addDoc(collection(db, "institutions"), { name, marja, ijazahVerified: false }).then(() => setName("")))}
          >
            Add
          </Button>
        </Card>
      )}
      <Table<Institution>
        rows={rows}
        error={error}
        cols={[
          { head: "Name", cell: (r) => r.name },
          { head: "Marja'", cell: (r) => r.marja ?? "" },
          { head: "Ijazah verified", cell: (r) => (r.ijazahVerified ? "Yes" : "No") },
          {
            head: "Action",
            cell: (r) =>
              isAdmin && (
                <Button className="!min-h-9 !px-3" onClick={() => guard(updateDoc(doc(db, "institutions", r.id), { ijazahVerified: !r.ijazahVerified }))}>
                  {r.ijazahVerified ? "Unverify" : "Verify ijazah"}
                </Button>
              ),
          },
        ]}
      />
    </>
  );
}
