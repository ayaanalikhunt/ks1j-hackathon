"use client";

import { doc, orderBy, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { Table } from "@/components/Table";
import { Banner, Button, PageHeader } from "@/components/ui";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

interface Report {
  targetType: string;
  targetId: string;
  reason?: string;
  status: "open" | "resolved";
}
interface Post {
  authorName?: string;
  body: string;
  removed?: boolean;
}

const COLLECTION: Record<string, string> = {
  post: "communityPosts",
  opportunity: "communityOpportunities",
  profile: "communityProfiles",
  group: "communityGroups",
};

const NEWEST = [orderBy("createdAt", "desc")];

export default function AdminCommunity() {
  const reports = useCollection<Report>("communityReports");
  const posts = useCollection<Post>("communityPosts", NEWEST);
  const [filter, setFilter] = useState<"open" | "resolved">("open");
  const [msg, setMsg] = useState<string | null>(null);
  const guard = (p: Promise<unknown>) => p.catch((e) => setMsg((e as Error).message));

  const setRemoved = (col: string, id: string, removed: boolean) => guard(updateDoc(doc(db, col, id), { removed }));

  return (
    <>
      <PageHeader eyebrow="Committee dashboard" title="Community moderation" />
      {msg && <Banner kind="error">{msg}</Banner>}
      <div className="mb-2 flex gap-2">
        {(["open", "resolved"] as const).map((f) => (
          <Button key={f} className={`!min-h-9 !px-3 ${filter === f ? "" : "!bg-card !text-fg border border-line"}`} onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>
      <Table<Report>
        rows={reports.rows.filter((r) => r.status === filter)}
        error={reports.error}
        empty="No reports."
        cols={[
          { head: "Type", cell: (r) => r.targetType },
          { head: "Reason", cell: (r) => r.reason ?? "" },
          {
            head: "Action",
            cell: (r) => {
              const col = COLLECTION[r.targetType];
              return (
                <div className="flex gap-2">
                  {col && (
                    <>
                      <button className="underline" onClick={() => setRemoved(col, r.targetId, true)}>Remove</button>
                      <button className="underline" onClick={() => setRemoved(col, r.targetId, false)}>Restore</button>
                    </>
                  )}
                  <button className="underline" onClick={() => guard(updateDoc(doc(db, "communityReports", r.id), { status: r.status === "open" ? "resolved" : "open" }))}>
                    {r.status === "open" ? "Resolve" : "Reopen"}
                  </button>
                </div>
              );
            },
          },
        ]}
      />
      <h2 className="mb-2 mt-6 font-display text-2xl font-bold">Latest posts</h2>
      <Table<Post>
        rows={posts.rows}
        error={posts.error}
        empty="No posts yet."
        cols={[
          { head: "Author", cell: (r) => r.authorName ?? "" },
          { head: "Post", cell: (r) => (r.removed ? <em className="text-muted">Removed</em> : r.body) },
          {
            head: "",
            cell: (r) => (
              <button className="underline" onClick={() => setRemoved("communityPosts", r.id, !r.removed)}>
                {r.removed ? "Restore" : "Remove"}
              </button>
            ),
          },
        ]}
      />
    </>
  );
}
