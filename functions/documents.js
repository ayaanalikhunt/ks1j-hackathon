// Private documents. Nothing here is ever public: files live in a private bucket with public access blocked, and every
// view of someone's document goes through these functions, which check who is asking and write an audit entry.
const crypto = require("node:crypto");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { audit } = require("./lib/settle");

const db = getFirestore();
const REGION = { region: "asia-south1" };
const STAFF_ROLES = ["verifier", "trustee", "admin", "super_admin", "owner"];
const ADMIN_ROLES = ["admin", "super_admin", "owner"];
const bucket = () => getStorage().bucket(process.env.PROOF_BUCKET || "ks1j-8a2e3-private-proofs");

const MAX_PROOF_BYTES = 3_000_000;
const SIGNATURES = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "application/pdf": (b) => b.slice(0, 4).toString("latin1") === "%PDF",
};
const EXT = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };

async function roleOf(req) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.doc(`members/${req.auth.uid}`).get();
  return me.get("role");
}
async function requireAdmin(req) {
  if (!ADMIN_ROLES.includes(await roleOf(req))) throw new HttpsError("permission-denied", "Admins only.");
  return req.auth.uid;
}

// ---- stored identity and supporting documents (cases, loans, institutions) ----

const PARENTS = {
  // who may see the documents: the owner, or committee staff
  cases: { owner: (p) => p.applicantId, entity: "caseDocument", ownerMayView: true },
  loans: { owner: (p) => p.borrowerId, entity: "loanDocument", ownerMayView: true },
  institutions: { owner: () => null, entity: "institutionDocument", ownerMayView: false },
};

async function authorize(req, parent, id) {
  const cfg = PARENTS[parent];
  if (!cfg || typeof id !== "string" || !id) throw new HttpsError("invalid-argument", "Unknown document set.");
  const role = await roleOf(req);
  const snap = await db.doc(`${parent}/${id}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Not found.");
  const staff = STAFF_ROLES.includes(role);
  const owner = cfg.ownerMayView && cfg.owner(snap.data()) === req.auth.uid;
  if (!staff && !owner) throw new HttpsError("permission-denied", "You cannot view these documents.");
  return { cfg, owner: owner && !staff };
}

/** The list of documents (kind, name, who added it), without the images. */
exports.listDocuments = onCall(REGION, async (req) => {
  const { parent, id } = req.data ?? {};
  await authorize(req, parent, id);
  const snap = await db.collection(`${parent}/${id}/documents`).get();
  return {
    documents: snap.docs.map((d) => ({ id: d.id, kind: d.get("kind"), name: d.get("name") ?? null, addedBy: d.get("addedBy") ?? null, uploadedAt: d.get("uploadedAt")?.toDate?.().toISOString() ?? null })),
  };
});

/** One document's image. Anyone other than the owner viewing it is recorded in the audit log. */
exports.getDocument = onCall(REGION, async (req) => {
  const { parent, id, docId } = req.data ?? {};
  if (typeof docId !== "string" || !docId) throw new HttpsError("invalid-argument", "A document is required.");
  const { cfg, owner } = await authorize(req, parent, id);
  const d = await db.doc(`${parent}/${id}/documents/${docId}`).get();
  if (!d.exists) throw new HttpsError("not-found", "No such document.");
  if (!owner) await audit(db, null, { action: "DOCUMENT_ACCESSED", actor: req.auth.uid, entityType: cfg.entity, entityId: `${id}/${docId}`, newValue: { kind: d.get("kind") } });
  return { kind: d.get("kind"), name: d.get("name") ?? null, dataUrl: d.get("dataUrl") };
});

// ---- proof of payout: files in the private bucket ----

function parseUpload(dataUrl) {
  const m = /^data:(image\/jpeg|image\/png|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl ?? ""));
  if (!m) throw new HttpsError("invalid-argument", "Upload a JPEG or PNG photo, or a PDF.");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_PROOF_BYTES) throw new HttpsError("invalid-argument", "The file must be under 3 MB.");
  if (!SIGNATURES[m[1]](bytes)) throw new HttpsError("invalid-argument", "That file is not what it says it is.");
  return { type: m[1], bytes };
}

/**
 * Attach the proof (receipt, invoice, transfer confirmation) to a payout. The file goes to the private bucket. The same file
 * cannot be attached to two payouts: it is recognised by its content, not its name.
 */
exports.uploadProof = onCall({ ...REGION, memory: "512MiB" }, async (req) => {
  const uid = await requireAdmin(req);
  const { disbursementId, name, dataUrl } = req.data ?? {};
  if (typeof disbursementId !== "string") throw new HttpsError("invalid-argument", "A payout is required.");
  const { type, bytes } = parseUpload(dataUrl);
  const ref = db.doc(`disbursements/${disbursementId}`);
  const s = await ref.get();
  if (!s.exists || !["completed", "pending_approval"].includes(s.get("status"))) throw new HttpsError("failed-precondition", "That payout cannot take a proof.");
  if (s.get("proofStatus") === "verified") throw new HttpsError("failed-precondition", "The proof was already verified and cannot be replaced.");

  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const used = await db.collection("disbursements").where("proofKey", "==", hash).limit(2).get();
  if (used.docs.some((x) => x.id !== disbursementId)) throw new HttpsError("failed-precondition", "That exact file is already the proof for another payout.");

  const path = `proofs/${disbursementId}/${hash}.${EXT[type]}`;
  const old = (await ref.collection("private").doc("details").get()).get("proofPath");
  await bucket().file(path).save(bytes, { contentType: type, resumable: false, metadata: { metadata: { uploadedBy: uid } } });
  if (typeof old === "string" && old.startsWith("proofs/") && old !== path) await bucket().file(old).delete({ ignoreNotFound: true });
  await ref.update({ proofStatus: "pending", proofKey: hash, proofType: type, proofUploadedAt: FieldValue.serverTimestamp() });
  await ref.collection("private").doc("details").set({ proofPath: path, proofName: typeof name === "string" ? name.slice(0, 120) : null, proofSize: bytes.length, proofUploadedBy: uid }, { merge: true });
  await audit(db, null, { action: "DOCUMENT_UPLOADED", actor: uid, entityType: "disbursementProof", entityId: disbursementId, newValue: { type, size: bytes.length } });
  return { ok: true };
});

/** Open a proof. Admins only, and every view is recorded. */
exports.getProof = onCall({ ...REGION, memory: "512MiB" }, async (req) => {
  const uid = await requireAdmin(req);
  const { disbursementId } = req.data ?? {};
  if (typeof disbursementId !== "string") throw new HttpsError("invalid-argument", "A payout is required.");
  const details = await db.doc(`disbursements/${disbursementId}/private/details`).get();
  const path = details.get("proofPath");
  if (typeof path !== "string" || !path.startsWith("proofs/")) throw new HttpsError("not-found", "No file was uploaded for this payout.");
  const file = bucket().file(path);
  const [meta] = await file.getMetadata().catch(() => [null]);
  if (!meta) throw new HttpsError("not-found", "The file is missing.");
  const [bytes] = await file.download();
  await audit(db, null, { action: "DOCUMENT_ACCESSED", actor: uid, entityType: "disbursementProof", entityId: disbursementId, newValue: { type: meta.contentType } });
  return { type: meta.contentType, name: details.get("proofName") ?? null, dataUrl: `data:${meta.contentType};base64,${bytes.toString("base64")}` };
});
