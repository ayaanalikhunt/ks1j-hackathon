import { PlayfairDisplay_400Regular, PlayfairDisplay_700Bold, useFonts } from "@expo-google-fonts/playfair-display";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export default function RootLayout() {
  const [loaded] = useFonts({ PlayfairDisplay_400Regular, PlayfairDisplay_700Bold });
  const t = useTheme();
  if (!loaded) return null;
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="sign-in" options={{ presentation: "modal" }} />
      </Stack>
    </AuthProvider>
  );
}
