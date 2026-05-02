import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { CameraPreviewCard } from "../components/CameraPreviewCard";
import { ScreenFrame } from "../components/ScreenFrame";
import { SurfaceCard } from "../components/SurfaceCard";
import { colors, radius, spacing, typography } from "../theme/tokens";
import type { KioskDeviceBinding } from "../types/kiosk";

type KioskCameraTestScreenProps = {
  binding: KioskDeviceBinding | null;
  onBack: () => void;
};

export function KioskCameraTestScreen({ binding, onBack }: KioskCameraTestScreenProps) {
  const { height, width } = useWindowDimensions();
  const isCompact = width < 620 || height < 720;
  const isWide = width >= 980 && height >= 680;
  const previewHeight = Math.min(isCompact ? 320 : 460, Math.max(240, height * 0.5));

  return (
    <ScreenFrame style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.container, isWide ? styles.containerWide : null, isCompact ? styles.containerCompact : null]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed ? styles.buttonPressed : null]}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Camera test</Text>
            <Text style={styles.subtitle}>Use this before pairing or while troubleshooting photo capture.</Text>
          </View>
        </View>

        <View style={[styles.main, isWide ? styles.mainWide : null]}>
          <View style={styles.previewColumn}>
            <CameraPreviewCard title={binding?.property.name ?? "Camera test"} subtitle="Front-facing live preview" mode="test" height={previewHeight} />
          </View>
          <SurfaceCard style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Camera expectations</Text>
            <Text style={styles.infoText}>Live preview stays embedded on the kiosk home screen for identity verification and photo capture.</Text>
            <Text style={styles.infoText}>If permission is denied, clock events that require a photo should fail cleanly without exposing admin tools to employees.</Text>
            <Text style={styles.infoText}>
              {binding
                ? `Current property: ${binding.property.name}`
                : "This device can be tested before it is paired to a property."}
            </Text>
          </SurfaceCard>
        </View>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing["2xl"],
    gap: spacing.lg,
  },
  containerWide: {
    paddingHorizontal: spacing["3xl"],
  },
  containerCompact: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    fontSize: 28,
    color: colors.foreground,
  },
  subtitle: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  main: {
    flex: 1,
    gap: spacing.xl,
  },
  mainWide: {
    flexDirection: "row",
  },
  previewColumn: {
    flex: 1.1,
  },
  infoCard: {
    flex: 0.9,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    fontSize: 21,
    color: colors.foreground,
  },
  infoText: {
    ...typography.body,
    color: colors.secondaryForeground,
  },
});
