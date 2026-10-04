import { useState } from "react";
import { Image, Text, View } from "react-native";
import { DOC_LABELS, type DocKind } from "@ks1j/shared";
import { Banner, Btn, Card } from "@/components/ui";
import { pickProof, type ProofPhoto } from "@/lib/photo";
import { F } from "@/constants/Type";
import { useTheme } from "@/lib/theme";

/** One proof document: take a photo or choose one, preview it, replace or remove it. */
export function ProofSlot({
  kind,
  required,
  value,
  onChange,
}: {
  kind: DocKind;
  required?: boolean;
  value: ProofPhoto | null;
  onChange: (p: ProofPhoto | null) => void;
}) {
  const t = useTheme();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(source: "camera" | "library") {
    setErr(null);
    setBusy(true);
    try {
      const p = await pickProof(source);
      if (p) onChange(p);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={{ fontSize: 17, fontFamily: F.semi, color: t.text }}>
        {DOC_LABELS[kind]}
        {required ? " (required)" : " (optional)"}
      </Text>
      {value ? (
        <>
          <Image source={{ uri: value.dataUrl }} style={{ width: "100%", height: 180, borderRadius: 10, backgroundColor: t.bg }} resizeMode="contain" />
          <Btn quiet label="Remove" onPress={() => onChange(null)} />
        </>
      ) : (
        <View style={{ gap: 8 }}>
          <Btn label="Take a photo" onPress={() => pick("camera")} disabled={busy} />
          <Btn quiet label="Choose from gallery" onPress={() => pick("library")} disabled={busy} />
        </View>
      )}
      {err && <Banner error>{err}</Banner>}
    </Card>
  );
}
