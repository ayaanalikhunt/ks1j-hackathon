import { MAX_DOC_CHARS } from "@ks1j/shared";

/** Shrink a photo in the browser so it fits in one Firestore document. Steps down until it is under the cap. */
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  for (const [width, quality] of [[1400, 0.6], [1100, 0.5], [900, 0.4], [700, 0.35]] as const) {
    const scale = Math.min(1, width / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length < MAX_DOC_CHARS) return url;
  }
  throw new Error("That photo is too large to attach. Try a clearer, closer photo.");
}
