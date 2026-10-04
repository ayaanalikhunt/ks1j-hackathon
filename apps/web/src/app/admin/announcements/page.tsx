"use client";

import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { Table } from "@/components/Table";
import { Banner, Button, Card, Field, PageHeader } from "@/components/ui";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface Announcement {
  title: string;
  body: string;
}

export default function AdminAnnouncements() {
  const { rows, error } = useCollection<Announcement>("announcements");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Announcements" />
      {msg && <Banner kind="error">{msg}</Banner>}
      <Card className="mb-4 space-y-3">
        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Field label="Message" value={body} onChange={(e) => setBody(e.target.value)} />
        <Button
          disabled={!title}
          onClick={() =>
            addDoc(collection(db, "announcements"), { title, body, createdAt: serverTimestamp() })
              .then(() => {
                setTitle("");
                setBody("");
              })
              .catch((e) => setMsg((e as Error).message))
          }
        >
          Publish
        </Button>
      </Card>
      <Table<Announcement>
        rows={rows}
        error={error}
        cols={[
          { head: "Title", cell: (r) => r.title },
          { head: "Message", cell: (r) => r.body },
          { head: "", cell: (r) => <button className="underline" onClick={() => deleteDoc(doc(db, "announcements", r.id))}>Remove</button> },
        ]}
      />
    </>
  );
}
