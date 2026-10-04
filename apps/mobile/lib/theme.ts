import { useColorScheme } from "react-native";
import { Colors, type Palette } from "@/constants/Colors";

export function useTheme(): Palette {
  return useColorScheme() === "dark" ? Colors.dark : Colors.light;
}
