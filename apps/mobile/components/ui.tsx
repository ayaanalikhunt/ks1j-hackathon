import type { IconName } from "@ks1j/shared";
import { Icon } from "./Icon";
import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { BODY, DISPLAY, DISPLAY_BOLD, cardShadow } from "@/constants/Type";
import { useTheme } from "@/lib/theme";

/** Every non-hero screen renders inside this: white header card with eyebrow, serif title, gold rule, intro. */
export function Screen({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  const t = useTheme();
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
  return <Text style={[s.body, { color: muted ? t.muted : t.text }, bold && { fontWeight: "700" }]}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontFamily: DISPLAY_BOLD, fontSize: 22, color: t.text }}>{children}</Text>;
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
      style={[s.feature, cardShadow, { backgroundColor: t.card, borderColor: t.border }]}
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
          <Text style={{ color: t.onTint, fontWeight: "700" }}>{badge}</Text>
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
      <Text style={{ fontSize: BODY, fontWeight: "700", color: quiet ? t.text : t.onTint }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...p }: { label: string } & TextInputProps) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[s.body, { color: t.text, fontWeight: "600" }]}>{label}</Text>
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
      <Text style={{ fontSize: BODY, color: t.text }}>{label}</Text>
    </Pressable>
  );
}

export function Banner({ children, error }: { children: ReactNode; error?: boolean }) {
  const t = useTheme();
  return (
    <View style={[s.banner, { borderColor: error ? t.danger : t.border, backgroundColor: t.card }]}>
      <Text style={{ fontSize: BODY, color: error ? t.danger : t.muted }}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 6 },
  eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  title: { fontFamily: DISPLAY_BOLD, fontSize: 28 },
  rule: { height: 3, width: 56, borderRadius: 2, marginVertical: 4 },
  body: { fontSize: BODY, lineHeight: 23 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  feature: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, minHeight: 76 },
  tile: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontFamily: DISPLAY, fontSize: 19, fontWeight: "700" },
  badge: { minWidth: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  btn: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: BODY },
  chip: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, justifyContent: "center" },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12 },
});
