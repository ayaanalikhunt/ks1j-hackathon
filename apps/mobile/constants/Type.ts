import type { ViewStyle } from "react-native";

// Headings: Playfair Display, lighter as they get larger. Body and UI: Atkinson Hyperlegible Next.
// React Native picks a weight by font family name, so each weight is its own entry.
export const D = {
  regular: "PlayfairDisplay_400Regular",
  medium: "PlayfairDisplay_500Medium",
  semi: "PlayfairDisplay_600SemiBold",
  bold: "PlayfairDisplay_700Bold",
} as const;
export const F = {
  regular: "AtkinsonHyperlegibleNext_400Regular",
  medium: "AtkinsonHyperlegibleNext_500Medium",
  semi: "AtkinsonHyperlegibleNext_600SemiBold",
  bold: "AtkinsonHyperlegibleNext_700Bold",
  extra: "AtkinsonHyperlegibleNext_800ExtraBold",
} as const;

/** Elder-friendly: nothing below 16. */
export const BODY = 16;

export const cardShadow: ViewStyle = {
  shadowColor: "#1f4d39",
  shadowOpacity: 0.1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};
