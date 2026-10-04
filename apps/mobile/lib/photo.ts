import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { MAX_DOC_CHARS } from "@ks1j/shared";

export interface ProofPhoto {
  name: string;
  dataUrl: string;
}

/**
 * Take or choose a photo and shrink it so it fits in one Firestore document.
 * Starts at 1400px / 60% quality and steps down until it is under the size cap.
 */
export async function pickProof(source: "camera" | "library"): Promise<ProofPhoto | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Camera permission is needed to take a photo. You can choose a photo from your gallery instead.");
  }
  const res =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];

  for (const [width, compress] of [[1400, 0.6], [1100, 0.5], [900, 0.4], [700, 0.35]] as const) {
    const ref = await ImageManipulator.manipulate(asset.uri).resize({ width }).renderAsync();
    const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    if (!out.base64) continue;
    const dataUrl = `data:image/jpeg;base64,${out.base64}`;
    if (dataUrl.length < MAX_DOC_CHARS) return { name: asset.fileName ?? "photo.jpg", dataUrl };
  }
  throw new Error("That photo is too large to attach. Please try a clearer, closer photo.");
}
