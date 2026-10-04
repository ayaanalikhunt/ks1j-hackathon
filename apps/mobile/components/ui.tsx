import type { IconName } from "@ks1j/shared";
import { Icon } from "./Icon";
import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import Svg, { Path } from "react-native-svg";
import { BODY, D, F, cardShadow } from "@/constants/Type";
import { useTheme } from "@/lib/theme";

const HERO_GREEN = "#0b4d3a";
const HERO_GOLD = "#c9a24a";

/** Deep-green banner with a gold mihrab arch, used by the tab roots (see the brand pack). */
function HeroHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <View style={[s.hero, cardShadow]}>
      <Svg width={120} height={170} viewBox="0 0 200 300" style={s.heroArch} fill="none" stroke={HERO_GOLD} strokeWidth={3}>
        <Path d="M20 300V130C20 70 70 25 100 8c30 17 80 62 80 122v170" />
        <Path d="M40 300V135C40 82 78 44 100 30c22 14 60 52 60 105v165" strokeOpacity={0.5} />
        <Path d="M100 56v26M100 112l12-12-12-12-12 12Z" />
      </Svg>
      <View style={s.brandRow}>
        <Image source={require("../assets/ks1j-logo.png")} style={s.brandLogo} />
        <Text style={s.brandWord}>
          KS<Text style={{ color: HERO_GOLD }}>1</Text>J
        </Text>
      </View>
      <Text style={[s.eyebrow, { color: HERO_GOLD }]}>{eyebrow.toUpperCase()}</Text>
      <Text style={[s.title, { color: "#ffffff" }]}>{title}</Text>
      <View style={[s.rule, { backgroundColor: HERO_GOLD }]} />
      {intro ? <Text style={[s.body, { color: "rgba(255,255,255,0.82)", maxWidth: "78%" }]}>{intro}</Text> : null}
    </View>
  );
}

/** Every screen renders inside this: a header card with eyebrow, serif title, gold rule, intro. `hero` is the green banner. */
export function Screen({
  eyebrow,
  title,
  intro,
  hero,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  hero?: boolean;
  children?: ReactNode;
}) {
  const t = useTheme();
  if (hero)
    return (
      <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <HeroHeader eyebrow={eyebrow} title={title} intro={intro} />
        {children}
      </ScrollView>
    );
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={[s.header, cardShadow, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[s.eyebrow, { color: t.tint }]}>{eyebrow.toUpperCase()}</Text>
        <Text style={[s.title, { color: t.text }]}>{title}</Text>
        <View style={[s.rule, { backgroundColor: t.gold }]} />
        {intro ? <Text style={[s.body, { color: t.muted }]}>{intro}</Text> : null}
      </View>
      {children}
    </ScrollView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={[s.card, cardShadow, { backgroundColor: t.card, borderColor: t.border }]}>{children}</View>;
}

export function Body({ children, muted, bold }: { children: ReactNode; muted?: boolean; bold?: boolean }) {
  const t = useTheme();
  return <Text style={[s.body, { color: muted ? t.muted : t.text }, bold && { fontFamily: F.bold }]}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontFamily: D.semi, fontSize: 22, lineHeight: 28, color: t.text }}>{children}</Text>;
}

/** Large tappable menu card: soft icon tile, title, one-liner, chevron. */
export function FeatureCard({
  icon,
  title,
  desc,
  href,
  badge,
  onPress,
}: {
  icon: IconName;
  title: string;
  desc: string;
  href?: Href;
  badge?: number;
  onPress?: () => void;
}) {
  const t = useTheme();
  const inner = (
    <Pressable
      onPress={onPress}
      // Flattened: expo-router's Link asChild merges styles by spreading, which breaks on arrays.
      style={StyleSheet.flatten([s.feature, cardShadow, { backgroundColor: t.card, borderColor: t.border }])}
      accessibilityRole="button"
    >
      <View style={[s.tile, { backgroundColor: t.tintSoft }]}>
        <Icon name={icon} size={26} color={t.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.featureTitle, { color: t.text }]}>{title}</Text>
        <Text style={[s.body, { color: t.muted }]}>{desc}</Text>
      </View>
      {badge ? (
        <View style={[s.badge, { backgroundColor: t.tint }]}>
          <Text style={{ color: t.onTint, fontFamily: F.bold }}>{badge}</Text>
        </View>
      ) : null}
      <Icon name="chevron-right" size={22} color={t.muted} />
    </Pressable>
  );
  return href ? (
    <Link href={href} asChild>
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function Btn({
  label,
  onPress,
  disabled,
  quiet,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  quiet?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[
        s.btn,
        quiet ? { backgroundColor: t.card, borderColor: t.border, borderWidth: 1 } : { backgroundColor: t.tint },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={{ fontSize: BODY, fontFamily: F.semi, color: quiet ? t.text : t.onTint }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...p }: { label: string } & TextInputProps) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[s.body, { color: t.text, fontFamily: F.semi }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        {...p}
        style={[s.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }, p.multiline && { minHeight: 96, textAlignVertical: "top" }]}
      />
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, { borderColor: on ? t.tint : t.border, backgroundColor: on ? t.tintSoft : t.card }]}
    >
      <Text style={{ fontSize: BODY, fontFamily: F.regular, color: t.text }}>{label}</Text>
    </Pressable>
  );
}

export function Banner({ children, error }: { children: ReactNode; error?: boolean }) {
  const t = useTheme();
  return (
    <View style={[s.banner, { borderColor: error ? t.danger : t.border, backgroundColor: t.card }]}>
      <Text style={{ fontSize: BODY, fontFamily: F.regular, color: error ? t.danger : t.muted }}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: HERO_GREEN, borderRadius: 24, padding: 20, gap: 6, overflow: "hidden" },
  heroArch: { position: "absolute", right: 14, bottom: 0, opacity: 0.85 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  brandLogo: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#ffffff" },
  brandWord: { color: "#ffffff", fontSize: 26, fontFamily: F.extra, letterSpacing: -0.5 },
  header: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 6 },
  eyebrow: { fontSize: 12, letterSpacing: 2, fontFamily: F.semi },
  title: { fontFamily: D.medium, fontSize: 28, lineHeight: 34 },
  rule: { height: 3, width: 56, borderRadius: 2, marginVertical: 4 },
  body: { fontFamily: F.regular, fontSize: BODY, lineHeight: 24 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  feature: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, minHeight: 76 },
  tile: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontFamily: D.semi, fontSize: 19, lineHeight: 24 },
  badge: { minWidth: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  btn: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: BODY, fontFamily: F.regular },
  chip: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, justifyContent: "center" },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12 },
});
