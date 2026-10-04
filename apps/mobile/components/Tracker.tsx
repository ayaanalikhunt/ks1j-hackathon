import { Text, View } from "react-native";
import { STAGES, stageIndex } from "@ks1j/shared";
import { useLang } from "@/lib/i18n";
import { F } from "@/constants/Type";
import { useTheme } from "@/lib/theme";

/** The step line every request moves along. A denied request shows one "Not approved" marker instead. */
export function Tracker({ status }: { status: string }) {
  const t = useTheme();
  const { t: tr } = useLang();
  if (status === "declined")
    return (
      <View style={{ borderWidth: 1, borderColor: t.danger, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 }}>
        <Text style={{ color: t.danger, fontFamily: F.semi, fontSize: 16 }}>{tr("stage.declined")}</Text>
      </View>
    );
  const at = stageIndex(status);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} accessibilityLabel="Progress of your request">
      {STAGES.map((s, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <View
            key={s}
            style={{
              borderWidth: 1,
              borderRadius: 16,
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderColor: done || now ? t.tint : t.border,
              backgroundColor: now ? t.tint : done ? t.tintSoft : "transparent",
            }}
          >
            <Text style={{ fontSize: 14, fontFamily: now ? F.semi : F.regular, color: now ? t.onTint : done ? t.text : t.muted }}>
              {done ? "✓ " : ""}
              {tr(`stage.${s}` as never)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
