import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useLang } from "@/lib/i18n";
import { Banner, Btn, Card } from "@/components/ui";
import { pickProof, type ProofPhoto } from "@/lib/photo";
import { F } from "@/constants/Type";
import { useTheme } from "@/lib/theme";

/** One proof document: take a photo or choose one, preview it, replace or remove it. */
export function ProofSlot({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: ProofPhoto | null;
  onChange: (p: ProofPhoto | null) => void;
}) {
  const t = useTheme();
  const { t: tr } = useLang();
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
        {label}
        {required ? tr("proofUi.4") : tr("proofUi.5")}
      </Text>
      {value ? (
        <>
          <Image source={{ uri: value.dataUrl }} style={{ width: "100%", height: 180, borderRadius: 10, backgroundColor: t.bg }} resizeMode="contain" />
          <Btn quiet label={tr("proofUi.1")} onPress={() => onChange(null)} />
        </>
      ) : (
        <View style={{ gap: 8 }}>
          <Btn label={tr("proofUi.2")} onPress={() => pick("camera")} disabled={busy} />
          <Btn quiet label={tr("proofUi.3")} onPress={() => pick("library")} disabled={busy} />
        </View>
      )}
      {err && <Banner error>{err}</Banner>}
    </Card>
  );
}
