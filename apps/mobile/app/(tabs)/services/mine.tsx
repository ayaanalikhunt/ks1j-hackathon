import { addDoc, collection, serverTimestamp, where } from "firebase/firestore";
import { useState } from "react";
import { Image, View } from "react-native";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  DECLINE_LABELS,
  DOC_LABELS,
  formatRupees,
  requiredDocs,
  type CaseType,
  type DeclineReason,
  type DocKind,
} from "@ks1j/shared";
import { RequireAuth } from "@/components/RequireAuth";
import { Tracker } from "@/components/Tracker";
import { Banner, Body, Btn, Card, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore";
import { pickProof } from "@/lib/photo";

const OPEN = ["draft", "submitted", "verified", "approved"];

/** Documents on one request: view them, and add a missing one while the request is still open. */
function CaseDocs({ id, c }: { id: string; c: any }) {
  const { user } = useAuth();
  const docs = useCollection<{ kind: DocKind; dataUrl: string }>(`cases/${id}/documents`);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const have = new Set(docs.rows.map((d) => d.kind));
  const missing = requiredDocs(c.type).filter((k) => !have.has(k));

  async function add(kind: DocKind) {
    setErr(null);
    try {
      const p = await pickProof("library");
      if (!p) return;
      await addDoc(collection(db, "cases", id, "documents"), { kind, name: p.name, dataUrl: p.dataUrl, uploadedAt: serverTimestamp() });
      await addDoc(collection(db, "caseEvents"), {
        caseId: id,
        applicantId: user!.uid,
        caseNumber: c.number ?? null,
        caseTitle: c.title ?? "",
        kind: "document_added",
        actorId: user!.uid,
        note: DOC_LABELS[kind],
        at: serverTimestamp(),
      });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Btn quiet label={`Documents (${docs.rows.length}): ${show ? "hide" : "view"}`} onPress={() => setShow(!show)} />
      {show && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {docs.rows.map((d) => (
            <View key={d.id} style={{ width: "47%" }}>
              <Image source={{ uri: d.dataUrl }} style={{ width: "100%", height: 110, borderRadius: 8 }} resizeMode="cover" />
              <Body muted>{DOC_LABELS[d.kind] ?? d.kind}</Body>
            </View>
          ))}
        </View>
      )}
      {OPEN.includes(c.status) && missing.length > 0 && (
        <>
          <Banner>Still needed: {missing.map((k) => DOC_LABELS[k].toLowerCase()).join(", ")}.</Banner>
          {missing.map((k) => (
            <Btn key={k} label={`Add ${DOC_LABELS[k].toLowerCase()}`} onPress={() => add(k)} />
          ))}
        </>
      )}
      {err && <Banner error>{err}</Banner>}
    </View>
  );
}

export default function Mine() {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const { rows, loading, error } = useCollection(user ? "cases" : null, [where("applicantId", "==", uid)], [uid]);
  const cases = [...rows].sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
  return (
    <RequireAuth eyebrow="Services" title="My applications">
      <Screen eyebrow="Services" title="My applications" intro="You will see each step as the committee works on your case.">
        {error && <Banner error>{error}</Banner>}
        {!loading && cases.length === 0 && <Banner>You have not applied for anything yet.</Banner>}
        {cases.map((c) => (
          <Card key={c.id}>
            <Body bold>
              {c.number ? `#${c.number} ` : ""}
              {c.title || c.requirement || c.description}
            </Body>
            <Body muted>
              {CASE_TYPE_LABELS[c.type as CaseType] ?? "Request"} · {formatRupees(c.amountRequested ?? 0)}
              {c.raised ? ` · ${formatRupees(c.raised)} raised` : ""}
            </Body>
            <Tracker status={c.status} />
            <Body>{CASE_STATUS_LABELS[c.status] ?? c.status}</Body>
            {c.status === "declined" && (
              <Banner error>
                Not approved: {DECLINE_LABELS[c.declineReason as DeclineReason] ?? "see note"}. {c.declineNote}
              </Banner>
            )}
            <CaseDocs id={c.id} c={c} />
          </Card>
        ))}
      </Screen>
    </RequireAuth>
  );
}
