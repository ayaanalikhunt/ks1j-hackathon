import { Tabs } from "expo-router";
import type { IconName } from "@ks1j/shared";
import { Icon } from "@/components/Icon";
import { F } from "@/constants/Type";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

// Exactly four tabs. Never add a fifth: nest everything under one of these.
const TABS: { name: string; key: "tab.home" | "tab.services" | "tab.give" | "tab.learn"; icon: IconName }[] = [
  { name: "home", key: "tab.home", icon: "home" },
  { name: "services", key: "tab.services", icon: "heart" },
  { name: "give", key: "tab.give", icon: "gift" },
  { name: "learn", key: "tab.learn", icon: "book" },
];

export default function TabsLayout() {
  const t = useTheme();
  const { t: tr } = useLang();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.tint,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border, minHeight: 62 },
        tabBarLabelStyle: { fontSize: 13, fontFamily: F.medium },
      }}
    >
      {TABS.map((x) => (
        <Tabs.Screen
          key={x.name}
          name={x.name}
          options={{ title: tr(x.key), tabBarIcon: ({ color }) => <Icon name={x.icon} color={String(color)} size={24} /> }}
        />
      ))}
    </Tabs>
  );
}
