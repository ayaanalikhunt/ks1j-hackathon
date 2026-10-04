import { Stack } from "expo-router";
import { useTheme } from "@/lib/theme";

/** Shared stack for each tab and the community section. */
export function StackLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.card },
        headerTintColor: t.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.bg },
        headerBackTitle: "Back",
        headerTitle: "",
      }}
    >
      {/* Tab roots draw their own header card. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
