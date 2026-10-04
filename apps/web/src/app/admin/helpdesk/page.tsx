"use client";

import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { isAdminLike } from "@ks1j/shared";
import { Table } from "@/components/Table";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface Kb {
  title: string;
  source: string;
  body: string;
}

export default function AdminHelpdesk() {
  const { member } = useAuth();
  const { rows, error } = useCollection<Kb>("kbDocuments");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const isAdmin = isAdminLike(member?.role);
  return (
    <>
      <PageHeader
        eyebrow="Committee dashboard"
        title="Helpdesk knowledge base"
        intro="The helpdesk may only answer from these Jamaat-approved sources, and must cite one."
      />
      {msg && <Banner kind="error">{msg}</Banner>}
      {isAdmin && (
        <Card className="mb-4 space-y-3">
          <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Field label="Approved source (who or what)" value={source} onChange={(e) => setSource(e.target.value)} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Answer text</span>
            <textarea className="min-h-24 w-full rounded-xl border border-line bg-bg p-3" value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <Button
            disabled={!title || !source || !body}
            onClick={() =>
              addDoc(collection(db, "kbDocuments"), { title, source, body, createdAt: serverTimestamp() })
                .then(() => {
                  setTitle("");
                  setSource("");
                  setBody("");
                })
                .catch((e) => setMsg((e as Error).message))
            }
          >
            Add document
          </Button>
        </Card>
      )}
      <Table<Kb>
        rows={rows}
        error={error}
        cols={[
          { head: "Title", cell: (r) => r.title },
          { head: "Source", cell: (r) => r.source },
          {
            head: "",
            cell: (r) =>
              isAdmin && (
                <button className="underline" onClick={() => deleteDoc(doc(db, "kbDocuments", r.id))}>
                  Remove
                </button>
              ),
          },
        ]}
      />
    </>
  );
}
