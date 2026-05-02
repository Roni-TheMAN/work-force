import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../theme/tokens";

type PinPadProps = {
  disabled?: boolean;
  busy?: boolean;
  keyHeight?: number;
  gap?: number;
  digitSize?: number;
  onDigitPress: (digit: string) => void;
  onClear: () => void;
  onSubmit: () => void;
};

const keypadLayout = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["Clear", "0", "Go"],
] as const;

export function PinPad({
  disabled = false,
  busy = false,
  keyHeight = 84,
  gap = spacing.sm,
  digitSize = 34,
  onDigitPress,
  onClear,
  onSubmit,
}: PinPadProps) {
  return (
    <View style={[styles.grid, { gap }]}>
      {keypadLayout.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { gap }]}>
          {row.map((value) => {
            const isDigit = /^\d$/.test(value);
            const isAction = value === "Go";
            const isClear = value === "Clear";

            return (
              <Pressable
                key={value}
                disabled={disabled || busy}
                onPress={() => {
                  if (isDigit) {
                    onDigitPress(value);
                    return;
                  }

                  if (isClear) {
                    onClear();
                    return;
                  }

                  onSubmit();
                }}
                style={({ pressed }) => [
                  styles.key,
                  { minHeight: keyHeight },
                  isAction ? styles.keyPrimary : styles.keySecondary,
                  (disabled || busy) && styles.keyDisabled,
                  pressed && !(disabled || busy) ? styles.keyPressed : null,
                ]}
              >
                <Text
                  style={[
                    isDigit ? [styles.keyDigit, { fontSize: digitSize }] : styles.keyLabel,
                    isAction ? styles.keyLabelPrimary : null,
                    (disabled || busy) && styles.keyTextDisabled,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: "100%",
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  key: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
  },
  keySecondary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  keyPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  keyPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  keyDisabled: {
    opacity: 0.55,
  },
  keyDigit: {
    ...typography.keypadDigit,
    color: colors.foreground,
  },
  keyLabel: {
    ...typography.label,
    color: colors.secondaryForeground,
  },
  keyLabelPrimary: {
    color: colors.primaryForeground,
  },
  keyTextDisabled: {
    color: colors.mutedForeground,
  },
});
