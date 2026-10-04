import type { ViewStyle } from "react-native";

export const DISPLAY = "PlayfairDisplay_400Regular";
export const DISPLAY_BOLD = "PlayfairDisplay_700Bold";

/** Elder-friendly: nothing below 16. */
export const BODY = 16;

export const cardShadow: ViewStyle = {
  shadowColor: "#1f4d39",
  shadowOpacity: 0.1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};
