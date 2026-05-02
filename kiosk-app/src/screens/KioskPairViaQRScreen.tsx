import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { CameraPreviewCard } from "../components/CameraPreviewCard";
import { ScreenFrame } from "../components/ScreenFrame";
import { SurfaceCard } from "../components/SurfaceCard";
import { TextField } from "../components/TextField";
import { colors, radius, spacing, typography } from "../theme/tokens";

type KioskPairViaQRScreenProps = {
  defaultDeviceName: string;
  onBack: () => void;
  onSwitchToLogin: () => void;
  onSubmitPairing: (rawValue: string, deviceName: string) => Promise<void>;
};

export function KioskPairViaQRScreen({
  defaultDeviceName,
  onBack,
  onSwitchToLogin,
  onSubmitPairing,
}: KioskPairViaQRScreenProps) {
  const { height, width } = useWindowDimensions();
  const isCompact = width < 620 || height < 720;
  const isWide = width >= 980 && height >= 680;
  const cameraHeight = Math.min(isCompact ? 320 : 420, Math.max(240, height * 0.42));
  const [deviceName, setDeviceName] = useState(defaultDeviceName);
  const [busy, setBusy] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [message, setMessage] = useState("Hold the QR code inside the frame.");
  const [error, setError] = useState<string | null>(null);
  const scanInFlightRef = useRef(false);

  return (
    <ScreenFrame style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.container, isWide ? styles.containerWide : null, isCompact ? styles.containerCompact : null]}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed ? styles.buttonPressed : null]}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.title}>Pair with property QR</Text>
              <Text style={styles.subtitle}>
                Scan a short-lived admin pairing code. Permanent property secrets never live in the QR payload.
              </Text>
            </View>
          </View>

          <View style={[styles.main, isWide ? styles.mainWide : null]}>
            <View style={styles.column}>
              <CameraPreviewCard
                title="Scanner"
                subtitle="Short-lived single-use pairing token"
                mode="scan"
                height={cameraHeight}
                scanLocked={scanLocked}
                onScan={async (rawValue) => {
                  if (scanInFlightRef.current || busy || scanLocked) {
                    return;
                  }

                  try {
                    scanInFlightRef.current = true;
                    setBusy(true);
                    setScanLocked(true);
                    setError(null);
                    setMessage("Validating pairing token...");
                    await onSubmitPairing(rawValue, deviceName);
                  } catch (nextError) {
                    scanInFlightRef.current = false;
                    setError(nextError instanceof Error ? nextError.message : "Unable to pair this kiosk.");
                    setMessage("Scan another QR code or switch to secure login.");
                    setScanLocked(false);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <View style={styles.scannerOverlay}>
                  <View style={styles.frame} />
                </View>
              </CameraPreviewCard>
              <SurfaceCard style={styles.messageCard}>
                <Text style={styles.messageTitle}>{busy ? "Pairing kiosk..." : "Scanner status"}</Text>
                <Text style={styles.messageText}>{error ?? message}</Text>
              </SurfaceCard>
            </View>

            <SurfaceCard style={styles.sidePanel}>
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Device details</Text>
                <TextField
                  label="Device name"
                  value={deviceName}
                  onChangeText={setDeviceName}
                  placeholder="Front Desk Kiosk"
                  helperText="This becomes the property device name after pairing completes."
                />
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>How this pairs</Text>
                <Text style={styles.infoText}>Authorized admins generate a short-lived token from property management.</Text>
                <Text style={styles.infoText}>The kiosk scanner exchanges only the token and receives organization + property binding.</Text>
                <Text style={styles.infoText}>The token is single-use and expires quickly after it is generated.</Text>
              </View>

              <View style={styles.actions}>
                <Pressable onPress={onSwitchToLogin} style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}>
                  <Text style={styles.primaryButtonLabel}>Use secure login instead</Text>
                </Pressable>
                <Pressable onPress={onBack} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}>
                  <Text style={styles.secondaryButtonLabel}>Back to kiosk</Text>
                </Pressable>
              </View>
            </SurfaceCard>
          </View>
        </View>
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
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
  column: {
    flex: 1.1,
    gap: spacing.lg,
  },
  sidePanel: {
    flex: 0.9,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  formSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    fontSize: 21,
    color: colors.foreground,
  },
  infoSection: {
    gap: spacing.sm,
  },
  infoText: {
    ...typography.body,
    color: colors.secondaryForeground,
  },
  actions: {
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primaryButtonLabel: {
    ...typography.label,
    color: colors.primaryForeground,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonLabel: {
    ...typography.label,
    color: colors.foreground,
  },
  scannerOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing["2xl"],
  },
  frame: {
    width: "72%",
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "hsla(0, 0%, 100%, 0.86)",
    backgroundColor: "transparent",
  },
  messageCard: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  messageTitle: {
    ...typography.label,
    color: colors.foreground,
  },
  messageText: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
});
