import { View } from "react-native";
import { LANGS, LANG_NAMES } from "@ks1j/shared";
import { Chip } from "@/components/ui";
import { useLang } from "@/lib/i18n";

/** Each language names itself in its own script, so a reader can always find theirs. */
export function LanguagePicker() {
  const { lang, setLang } = useLang();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityRole="radiogroup">
      {LANGS.map((l) => (
        <Chip key={l} label={LANG_NAMES[l].native} on={lang === l} onPress={() => setLang(l)} />
      ))}
    </View>
  );
}
