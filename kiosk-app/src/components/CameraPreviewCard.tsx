import { useCallback, useEffect, useRef, type PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { CameraMode } from "../types/kiosk";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { SurfaceCard } from "./SurfaceCard";

type CameraCaptureHandle = (() => Promise<string | null>) | null;
type CameraPreviewVariant = "panel" | "orb";

type CameraPreviewCardProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  mode: CameraMode;
  active?: boolean;
  scanLocked?: boolean;
  height?: number;
  size?: number;
  variant?: CameraPreviewVariant;
  onScan?: (value: string) => void;
  onCaptureReady?: (capture: CameraCaptureHandle) => void;
}>;

export function CameraPreviewCard({
  title,
  subtitle,
  mode,
  active = true,
  scanLocked = false,
  height = 320,
  size = 148,
  variant = "panel",
  onScan,
  onCaptureReady,
  children,
}: CameraPreviewCardProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || !permission?.granted || !active) {
      return null;
    }

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.4,
      skipProcessing: true,
      base64: false,
      shutterSound: false,
    });

    return photo?.uri ?? null;
  }, [active, permission?.granted]);

  useEffect(() => {
    onCaptureReady?.(permission?.granted && active ? capturePhoto : null);

    return () => {
      onCaptureReady?.(null);
    };
  }, [active, capturePhoto, onCaptureReady, permission?.granted]);

  let statusTone: "loading" | "blocked" | "idle" | "ready" = "ready";
  const facing = mode === "scan" ? "back" : "front";

  if (!permission) {
    statusTone = "loading";
  } else if (!permission.granted) {
    statusTone = "blocked";
  } else if (!active) {
    statusTone = "idle";
  }

  const handleBarcodeScan = (result: BarcodeScanningResult) => {
    if (!onScan || scanLocked || !active) {
      return;
    }

    onScan(result.data);
  };

  if (variant === "orb") {
    const innerSize = Math.max(size - 10, 1);

    return (
      <View style={[styles.orbShell, { width: size, height: size }]}>
        <View style={[styles.orbRing, { width: size, height: size, borderRadius: size / 2 }]}>
          <View
            style={[
              styles.orbPreview,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerSize / 2,
              },
            ]}
          >
            {permission?.granted && active ? (
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
            ) : (
              <View style={styles.orbPlaceholder}>
                <MaterialCommunityIcons
                  name={statusTone === "loading" ? "camera-wireless-outline" : "camera-off-outline"}
                  size={28}
                  color={colors.mutedForeground}
                />
              </View>
            )}
            <View style={styles.orbOverlay} />
            {!permission ? (
              <View style={styles.orbCenterState}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
            {permission && !permission.granted ? (
              <Pressable
                onPress={requestPermission}
                style={({ pressed }) => [styles.orbPermissionLayer, pressed ? styles.buttonPressed : null]}
              >
                <Text style={styles.orbPermissionText}>Allow</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={[styles.orbStatusDot, statusTone === "ready" ? styles.orbStatusReady : styles.orbStatusMuted]} />
      </View>
    );
  }

  return (
    <SurfaceCard style={[styles.card, { minHeight: height }]}>
      <View style={styles.preview}>
        {permission?.granted && active ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            barcodeScannerSettings={mode === "scan" ? { barcodeTypes: ["qr"] } : undefined}
            onBarcodeScanned={mode === "scan" ? handleBarcodeScan : undefined}
          />
        ) : (
          <View style={styles.placeholder}>
            <MaterialCommunityIcons
              name={statusTone === "loading" ? "camera-wireless-outline" : "camera-off-outline"}
              size={34}
              color={colors.mutedForeground}
            />
          </View>
        )}
        <View style={styles.gradientOverlay} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={[styles.statusPill, statusTone === "ready" ? styles.statusReady : styles.statusMuted]}>
            <Text style={[styles.statusText, statusTone === "ready" ? styles.statusTextReady : null]}>
              {statusTone === "ready"
                ? mode === "scan"
                  ? "Scanner live"
                  : "Camera live"
                : statusTone === "blocked"
                  ? "Permission needed"
                  : statusTone === "loading"
                    ? "Loading"
                    : "Paused"}
            </Text>
          </View>
        </View>
        {!permission ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
        {permission && !permission.granted ? (
          <View style={styles.centerState}>
            <Text style={styles.centerTitle}>Camera access is required</Text>
            <Text style={styles.centerBody}>
              Allow camera access for QR pairing, live preview, and photo capture.
            </Text>
            <Pressable onPress={requestPermission} style={({ pressed }) => [styles.permissionButton, pressed ? styles.buttonPressed : null]}>
              <Text style={styles.permissionButtonLabel}>Allow camera</Text>
            </Pressable>
          </View>
        ) : null}
        {children ? <View style={styles.overlayContent}>{children}</View> : null}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  orbShell: {
    alignItems: "center",
    justifyContent: "center",
  },
  orbRing: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  orbPreview: {
    overflow: "hidden",
    backgroundColor: colors.secondary,
  },
  orbPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.secondary,
  },
  orbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "hsla(218, 22%, 12%, 0.08)",
  },
  orbCenterState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  orbPermissionLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "hsla(218, 22%, 12%, 0.5)",
  },
  orbPermissionText: {
    ...typography.label,
    color: colors.card,
  },
  orbStatusDot: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: colors.card,
  },
  orbStatusReady: {
    backgroundColor: colors.success,
  },
  orbStatusMuted: {
    backgroundColor: colors.warning,
  },
  card: {
    overflow: "hidden",
  },
  preview: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.secondary,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "hsla(218, 22%, 12%, 0.2)",
  },
  header: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    ...typography.label,
    color: colors.card,
  },
  subtitle: {
    ...typography.helper,
    color: "hsla(0, 0%, 100%, 0.84)",
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusMuted: {
    backgroundColor: "hsla(0, 0%, 100%, 0.16)",
    borderColor: "hsla(0, 0%, 100%, 0.22)",
  },
  statusReady: {
    backgroundColor: "hsla(150, 46%, 32%, 0.18)",
    borderColor: "hsla(150, 46%, 32%, 0.22)",
  },
  statusText: {
    ...typography.helper,
    fontSize: 12,
    fontWeight: "700",
    color: colors.card,
  },
  statusTextReady: {
    color: "hsl(150, 58%, 84%)",
  },
  centerState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
    gap: spacing.sm,
  },
  centerTitle: {
    ...typography.sectionTitle,
    fontSize: 20,
    textAlign: "center",
    color: colors.card,
  },
  centerBody: {
    ...typography.helper,
    textAlign: "center",
    color: "hsla(0, 0%, 100%, 0.84)",
  },
  permissionButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  permissionButtonLabel: {
    ...typography.label,
    color: colors.primaryForeground,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  overlayContent: {
    ...StyleSheet.absoluteFillObject,
  },
});
