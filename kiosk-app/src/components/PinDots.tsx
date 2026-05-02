import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../theme/tokens";

type PinDotsProps = {
  length: number;
  maxLength: number;
  error?: boolean;
  size?: number;
  gap?: number;
};

export function PinDots({ length, maxLength, error = false, size = 18, gap = spacing.sm }: PinDotsProps) {
  return (
    <View style={[styles.row, { gap }]}>
      {Array.from({ length: maxLength }, (_, index) => {
        const active = index < length;

        return (
          <View
            key={index}
            style={[
              styles.dot,
              { width: size, height: size },
              active ? styles.dotActive : styles.dotInactive,
              error ? styles.dotError : null,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  dot: {
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dotInactive: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.foreground,
    borderColor: colors.foreground,
  },
  dotError: {
    borderColor: colors.destructive,
  },
});
