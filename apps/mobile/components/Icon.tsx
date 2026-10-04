import Svg, { Path } from "react-native-svg";
import { ICONS, type IconName } from "@ks1j/shared";

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
