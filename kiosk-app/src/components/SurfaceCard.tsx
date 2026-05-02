import type { PropsWithChildren } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { surfaces } from "../theme/tokens";

type SurfaceCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function SurfaceCard({ children, style }: SurfaceCardProps) {
  return <View style={[surfaces.card, style]}>{children}</View>;
}
