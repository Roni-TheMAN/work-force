import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, typography } from "../theme/tokens";

type KioskStatusBadgeProps = {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

export function KioskStatusBadge({ label, tone = "neutral" }: KioskStatusBadgeProps) {
  const palette = toneStyles[tone];

  return (
    <View style={[styles.badge, palette.badge]}>
      <View style={[styles.dot, palette.dot]} />
      <Text style={[styles.label, palette.label]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...typography.helper,
    fontSize: 13,
    fontWeight: "700",
  },
});

const toneStyles = {
  neutral: StyleSheet.create({
    badge: {
      backgroundColor: colors.secondary,
      borderColor: colors.border,
    },
    dot: {
      backgroundColor: colors.mutedForeground,
    },
    label: {
      color: colors.secondaryForeground,
    },
  }),
  success: StyleSheet.create({
    badge: {
      backgroundColor: colors.successSoft,
      borderColor: "hsla(148, 34%, 34%, 0.18)",
    },
    dot: {
      backgroundColor: colors.success,
    },
    label: {
      color: colors.success,
    },
  }),
  warning: StyleSheet.create({
    badge: {
      backgroundColor: colors.warningSoft,
      borderColor: "hsla(38, 84%, 42%, 0.2)",
    },
    dot: {
      backgroundColor: colors.warning,
    },
    label: {
      color: colors.warning,
    },
  }),
  danger: StyleSheet.create({
    badge: {
      backgroundColor: colors.destructiveSoft,
      borderColor: "hsla(0, 72%, 51%, 0.18)",
    },
    dot: {
      backgroundColor: colors.destructive,
    },
    label: {
      color: colors.destructive,
    },
  }),
};
