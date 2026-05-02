import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { KIOSK_ENVIRONMENT_LABEL } from "../lib/constants";
import { formatRelativeTime } from "../lib/format";
import type { KioskDeviceBinding, KioskHealthSummary } from "../types/kiosk";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { KioskStatusBadge } from "./KioskStatusBadge";
import { SurfaceCard } from "./SurfaceCard";

type HiddenAdminPanelProps = {
  visible: boolean;
  binding: KioskDeviceBinding | null;
  health: KioskHealthSummary;
  appVersion: string;
  onClose: () => void;
  onPairWithQr: () => void;
  onPairWithLogin: () => void;
  onSwitchProperty: () => void;
  onUnpair: () => void;
  onCameraTest: () => void;
};

type ActionButtonProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
  tone?: "neutral" | "danger";
};

function AdminActionButton({
  icon,
  label,
  description,
  onPress,
  tone = "neutral",
}: ActionButtonProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionButton, tone === "danger" ? styles.actionDanger : null, pressed ? styles.actionPressed : null]}>
      <View style={[styles.actionIcon, tone === "danger" ? styles.actionIconDanger : null]}>
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={tone === "danger" ? colors.destructive : colors.primary}
        />
      </View>
      <View style={styles.actionContent}>
        <Text style={[styles.actionLabel, tone === "danger" ? styles.actionLabelDanger : null]}>{label}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

export function HiddenAdminPanel({
  visible,
  binding,
  health,
  appVersion,
  onClose,
  onPairWithQr,
  onPairWithLogin,
  onSwitchProperty,
  onUnpair,
  onCameraTest,
}: HiddenAdminPanelProps) {
  const { height, width } = useWindowDimensions();
  const isCompact = width < 560 || height < 680;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, isCompact ? styles.overlayCompact : null]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SurfaceCard style={[styles.panel, isCompact ? styles.panelCompact : null]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Admin panel</Text>
              <Text style={styles.subtitle}>Pair, test, or unpair this property kiosk.</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed ? styles.actionPressed : null]}>
              <MaterialCommunityIcons name="close" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.statusSection}>
              <View style={styles.statusRow}>
                <KioskStatusBadge
                  label={binding ? "Connected" : "Unpaired"}
                  tone={binding ? "success" : "warning"}
                />
                <KioskStatusBadge
                  label={health.state === "healthy" ? "Healthy" : "Needs attention"}
                  tone={health.state === "healthy" ? "success" : "warning"}
                />
              </View>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Organization</Text>
                  <Text style={styles.summaryValue}>{binding?.organization.name ?? "Not connected"}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Property</Text>
                  <Text style={styles.summaryValue}>{binding?.property.name ?? "Not connected"}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Device</Text>
                  <Text style={styles.summaryValue}>{binding?.device.deviceName ?? "Unassigned device"}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Health</Text>
                  <Text style={styles.summaryCaption}>
                    {health.message} • {formatRelativeTime(health.lastSyncAt)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Build</Text>
                  <Text style={styles.summaryCaption}>
                    {appVersion} • {KIOSK_ENVIRONMENT_LABEL}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <AdminActionButton
                icon="qrcode-scan"
                label="Pair via QR"
                description="Scan a short-lived pairing QR from property management."
                onPress={onPairWithQr}
              />
              <AdminActionButton
                icon="shield-account-outline"
                label="Pair via login"
                description="Use an authorized owner, admin, or manager account."
                onPress={onPairWithLogin}
              />
              <AdminActionButton
                icon="swap-horizontal"
                label="Switch property"
                description="Reassign this kiosk to a different property."
                onPress={onSwitchProperty}
              />
              <AdminActionButton
                icon="camera-outline"
                label="Camera test"
                description="Check live preview and verify camera permissions."
                onPress={onCameraTest}
              />
              <AdminActionButton
                icon="link-off"
                label="Unpair device"
                description="Remove the current device binding from this kiosk."
                onPress={onUnpair}
                tone="danger"
              />
              <AdminActionButton
                icon="logout"
                label="Exit admin panel"
                description="Return to locked kiosk mode."
                onPress={onClose}
              />
            </View>
          </ScrollView>
        </SurfaceCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    padding: spacing.lg,
    justifyContent: "center",
  },
  overlayCompact: {
    padding: spacing.sm,
  },
  panel: {
    width: "100%",
    maxWidth: 540,
    alignSelf: "center",
    maxHeight: "90%",
    padding: spacing.xl,
  },
  panelCompact: {
    maxHeight: "96%",
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.foreground,
  },
  subtitle: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  statusSection: {
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  summaryRow: {
    gap: spacing.xxs,
  },
  summaryLabel: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
  summaryValue: {
    ...typography.label,
    color: colors.foreground,
  },
  summaryCaption: {
    ...typography.body,
    fontSize: 15,
    color: colors.secondaryForeground,
  },
  actions: {
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  actionDanger: {
    backgroundColor: colors.destructiveSoft,
    borderColor: "hsla(0, 72%, 51%, 0.18)",
  },
  actionPressed: {
    opacity: 0.9,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  actionIconDanger: {
    backgroundColor: "hsla(0, 72%, 51%, 0.1)",
  },
  actionContent: {
    flex: 1,
    gap: spacing.xxs,
  },
  actionLabel: {
    ...typography.label,
    color: colors.foreground,
  },
  actionLabelDanger: {
    color: colors.destructive,
  },
  actionDescription: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
});
