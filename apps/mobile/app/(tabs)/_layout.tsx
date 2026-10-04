import { Tabs } from "expo-router";
import type { IconName } from "@ks1j/shared";
import { Icon } from "@/components/Icon";
import { F } from "@/constants/Type";
import { useTheme } from "@/lib/theme";

// Exactly four tabs. Never add a fifth: nest everything under one of these.
const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "home", title: "Home", icon: "home" },
  { name: "services", title: "Services", icon: "heart" },
  { name: "give", title: "Give", icon: "gift" },
  { name: "learn", title: "Learn", icon: "book" },
];

export default function TabsLayout() {
  const t = useTheme();
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
          options={{ title: x.title, tabBarIcon: ({ color }) => <Icon name={x.icon} color={String(color)} size={24} /> }}
        />
      ))}
    </Tabs>
  );
}
