import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, where } from "firebase/firestore";
import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { View } from "react-native";
import { initials, timeAgo } from "@ks1j/shared";
import { Banner, Body, Btn, Card, Field } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/firestore";

function PostItem({ post }: { post: any }) {
  const { t: tr } = useLang();
  const { user } = useAuth();
  const uid = user!.uid;
  const likes = useCollection(`communityPosts/${post.id}/appreciations`);
  const mine = likes.rows.some((l) => l.id === uid);
  const [reported, setReported] = useState(false);
  const when = post.createdAt?.toDate ? timeAgo(post.createdAt.toDate()) : "just now";

  const toggle = () => {
    const ref = doc(db, "communityPosts", post.id, "appreciations", uid);
    return mine ? deleteDoc(ref) : setDoc(ref, { at: serverTimestamp() });
  };
  const report = () =>
    addDoc(collection(db, "communityReports"), {
      reporterId: uid,
      status: "open",
      targetType: "post",
      targetId: post.id,
      reason: "Reported by a member",
      createdAt: serverTimestamp(),
    }).then(() => setReported(true));

  return (
    <Card>
      <Body bold>
        {initials(post.authorName ?? "?")} · {post.authorName} · {when}
      </Body>
      <Body>{post.body}</Body>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn quiet label={`${mine ? tr("postUi.4") : tr("postUi.5")} (${likes.rows.length})`} onPress={toggle} />
        {post.authorId !== uid && <Btn quiet label={reported ? tr("postUi.6") : tr("postUi.7")} onPress={report} disabled={reported} />}
      </View>
    </Card>
  );
}

/** Main feed (groupId = null) or one group's discussion. */
export function PostList({ groupId = null, authorName }: { groupId?: string | null; authorName: string }) {
  const { t: tr } = useLang();
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { rows } = useCollection("communityPosts", [where("groupId", "==", groupId)], [groupId]);
  const posts = rows
    .filter((p) => !p.removed)
    .sort((a, b) => (b.createdAt?.seconds ?? 9e9) - (a.createdAt?.seconds ?? 9e9));

  const post = () =>
    addDoc(collection(db, "communityPosts"), {
      authorId: user!.uid,
      authorName,
      body: body.trim(),
      groupId,
      removed: false,
      createdAt: serverTimestamp(),
    })
      .then(() => setBody(""))
      .catch((e) => setErr((e as Error).message));

  return (
    <>
      <Card>
        <Field label={tr("postUi.1")} value={body} onChangeText={setBody} multiline />
        <Btn label={tr("postUi.2")} onPress={post} disabled={!body.trim()} />
        {err && <Banner error>{err}</Banner>}
      </Card>
      {posts.length === 0 && <Banner>{tr("postUi.3")}</Banner>}
      {posts.map((p) => (
        <PostItem key={p.id} post={p} />
      ))}
    </>
  );
}
