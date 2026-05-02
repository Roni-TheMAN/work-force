import { useRef, type PropsWithChildren } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";

import { ADMIN_TRIGGER_TAP_COUNT, ADMIN_TRIGGER_WINDOW_MS } from "../lib/constants";

type HiddenAdminTriggerProps = PropsWithChildren<{
  onTriggered: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function HiddenAdminTrigger({ children, onTriggered, disabled = false, style }: HiddenAdminTriggerProps) {
  const tapsRef = useRef<number[]>([]);

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        const now = Date.now();
        const nextTaps = [...tapsRef.current, now].filter((value) => now - value <= ADMIN_TRIGGER_WINDOW_MS);
        tapsRef.current = nextTaps;

        if (nextTaps.length >= ADMIN_TRIGGER_TAP_COUNT) {
          tapsRef.current = [];
          onTriggered();
        }
      }}
      style={style}
    >
      {children}
    </Pressable>
  );
}
