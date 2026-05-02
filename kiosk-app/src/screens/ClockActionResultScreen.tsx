import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { ScreenFrame } from "../components/ScreenFrame";
import { SurfaceCard } from "../components/SurfaceCard";
import { colors, radius, spacing, typography } from "../theme/tokens";
import type { ClockFlowResult } from "../types/kiosk";

type ClockActionResultScreenProps = {
  result: ClockFlowResult;
  onDone: () => void;
};

export function ClockActionResultScreen({ result, onDone }: ClockActionResultScreenProps) {
  const { height, width } = useWindowDimensions();
  const isCompact = width < 520 || height < 640;
  const success = result.success;
  const iconName = result.kind === "pairing" ? "link-variant" : success ? "check-circle" : "alert-circle";

  return (
    <ScreenFrame style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.container, isCompact ? styles.containerCompact : null]}>
        <SurfaceCard style={[styles.card, isCompact ? styles.cardCompact : null]}>
          <View style={[styles.iconWrap, isCompact ? styles.iconWrapCompact : null, success ? styles.iconWrapSuccess : styles.iconWrapDanger]}>
            <MaterialCommunityIcons name={iconName} size={isCompact ? 30 : 38} color={success ? colors.success : colors.destructive} />
          </View>
          <Text style={[styles.title, isCompact ? styles.titleCompact : null]}>{result.title}</Text>
          <Text style={styles.message}>{result.message}</Text>
          {"employeeName" in result && result.employeeName ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Employee</Text>
              <Text style={styles.detailValue}>{result.employeeName}</Text>
            </View>
          ) : null}
          {"actionLabel" in result && result.actionLabel ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Action</Text>
              <Text style={styles.detailValue}>{result.actionLabel}</Text>
            </View>
          ) : null}
          <Pressable onPress={onDone} style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}>
            <Text style={styles.buttonLabel}>Return to kiosk</Text>
          </Pressable>
        </SurfaceCard>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["2xl"],
  },
  containerCompact: {
    padding: spacing.md,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    padding: spacing["2xl"],
    alignItems: "center",
    gap: spacing.lg,
  },
  cardCompact: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  iconWrapCompact: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  iconWrapSuccess: {
    backgroundColor: colors.successSoft,
    borderColor: "hsla(148, 34%, 34%, 0.2)",
  },
  iconWrapDanger: {
    backgroundColor: colors.destructiveSoft,
    borderColor: "hsla(0, 72%, 51%, 0.18)",
  },
  title: {
    ...typography.title,
    fontSize: 30,
    textAlign: "center",
    color: colors.foreground,
  },
  titleCompact: {
    fontSize: 24,
    lineHeight: 30,
  },
  message: {
    ...typography.body,
    textAlign: "center",
    color: colors.secondaryForeground,
  },
  detailBlock: {
    alignItems: "center",
    gap: spacing.xxs,
  },
  detailLabel: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
  detailValue: {
    ...typography.label,
    color: colors.foreground,
  },
  button: {
    minHeight: 52,
    minWidth: 200,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonLabel: {
    ...typography.label,
    color: colors.primaryForeground,
  },
});
