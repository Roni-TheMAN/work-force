import { useEffect, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { CameraPreviewCard } from "../components/CameraPreviewCard";
import { HiddenAdminTrigger } from "../components/HiddenAdminTrigger";
import { KioskStatusBadge } from "../components/KioskStatusBadge";
import { PinDots } from "../components/PinDots";
import { PinPad } from "../components/PinPad";
import { ScreenFrame } from "../components/ScreenFrame";
import { formatDateLabel, formatTime } from "../lib/format";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { KIOSK_PIN_LENGTH, type KioskBrandingConfig, type KioskDeviceBinding, type KioskHealthSummary } from "../types/kiosk";

type KioskHomeScreenProps = {
  binding: KioskDeviceBinding | null;
  branding: KioskBrandingConfig | null;
  health: KioskHealthSummary;
  pinBusy: boolean;
  onOpenAdminPanel: () => void;
  onSubmitPin: (pin: string) => Promise<void>;
  onCaptureReady: (capture: (() => Promise<string | null>) | null) => void;
};

export function KioskHomeScreen({
  binding,
  branding,
  health,
  pinBusy,
  onOpenAdminPanel,
  onSubmitPin,
  onCaptureReady,
}: KioskHomeScreenProps) {
  const { height, width } = useWindowDimensions();
  const isTightWidth = width < 420;
  const isShort = height < 720;
  const isVeryShort = height < 600;
  const isCompact = width < 620 || isShort;
  const showContextRail = false;
  const showHeaderBadges = width >= 640 && height >= 620;
  const showSecondaryText = width >= 520 && height >= 640;
  const showFooter = width >= 760 && height >= 720;
  const usePinnedCamera = width >= 720;
  const horizontalGap = isVeryShort ? spacing.sm : isCompact ? spacing.md : spacing.xl;
  const cameraSize = width < 360 ? 64 : isVeryShort ? 84 : isCompact ? 104 : 142;
  const minStationWidth = width < 320 ? 168 : width < 360 ? 188 : 220;
  const horizontalPadding = (isCompact ? spacing.sm : spacing.lg) * 2;
  const availablePinWidth = usePinnedCamera
    ? width - horizontalPadding - (showContextRail ? 300 : 0)
    : width - horizontalPadding - cameraSize - horizontalGap - (showContextRail ? 300 : 0);
  const keypadWidth = Math.max(
    minStationWidth,
    Math.min(420, availablePinWidth)
  );
  const stageWidth = usePinnedCamera
    ? Math.min(width - horizontalPadding, keypadWidth + 2 * (cameraSize + horizontalGap))
    : Math.min(width - horizontalPadding, keypadWidth + cameraSize + horizontalGap);
  const keyHeight = isVeryShort ? 46 : isCompact ? 60 : 74;
  const keypadGap = isVeryShort ? spacing.xs : spacing.sm;
  const pinDotSize = isVeryShort ? 12 : isCompact ? 14 : 18;
  const clockFontSize = isVeryShort ? 32 : isCompact ? 42 : 52;
  const clockLineHeight = isVeryShort ? 36 : isCompact ? 46 : 56;
  const [pin, setPin] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const disabled = !binding || pinBusy;
  const instructionText = branding?.instructionText ?? "Authorized setup required";
  const propertyName = binding?.property.name ?? "Kiosk not paired";
  const propertyTimeZone = binding?.property.timezone;
  const onlineLabel = !binding ? "Setup needed" : health.isOnline === false ? "Offline" : "Online";
  const pendingSyncCount = health.pendingSyncCount ?? 0;
  const conflictCount = health.conflictCount ?? 0;

  return (
    <ScreenFrame style={styles.screen}>
      <View style={[styles.container, isCompact ? styles.containerCompact : null]}>
        <View style={styles.header}>
          <HiddenAdminTrigger onTriggered={onOpenAdminPanel}>
            <View style={styles.brandBlock}>
              <View style={styles.brandIcon}>
                <MaterialCommunityIcons name="office-building-outline" size={22} color={colors.primaryForeground} />
              </View>
              <View style={styles.brandText}>
                <Text style={styles.brandTitle}>Workforce kiosk</Text>
                <Text style={styles.brandSubtitle}>{branding?.supportLabel ?? "Property clock station"}</Text>
              </View>
            </View>
          </HiddenAdminTrigger>
          {showHeaderBadges ? <View style={styles.headerBadges}>
            <KioskStatusBadge label={binding ? "Property paired" : "Unpaired"} tone={binding ? "success" : "warning"} />
            <KioskStatusBadge
              label={onlineLabel}
              tone={!binding || health.isOnline === false ? "warning" : "success"}
            />
            {pendingSyncCount > 0 ? (
              <KioskStatusBadge label={`${pendingSyncCount} pending`} tone="warning" />
            ) : null}
            {conflictCount > 0 ? (
              <KioskStatusBadge label={`${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`} tone="danger" />
            ) : null}
          </View> : null}
        </View>

        <View style={[styles.main, isCompact ? styles.mainCompact : null]}>
          <View style={[styles.stationHeader, isVeryShort ? styles.stationHeaderTight : null, { maxWidth: keypadWidth }]}>
            <Text style={[styles.time, { fontSize: clockFontSize, lineHeight: clockLineHeight }]}>
              {formatTime(now, propertyTimeZone)}
            </Text>
            {showSecondaryText ? <Text style={styles.date}>{formatDateLabel(now, propertyTimeZone)}</Text> : null}
            <Text style={[styles.instruction, isTightWidth ? styles.instructionTight : null]}>{instructionText}</Text>
            {showSecondaryText ? <Text style={styles.helper}>
              {binding
                ? "Only employees assigned to this property can use this kiosk."
                : "Ask an authorized admin to pair this kiosk from the hidden panel."}
            </Text> : null}
          </View>

          <View
            style={[
              styles.workRow,
              usePinnedCamera ? styles.workRowPinned : null,
              { gap: usePinnedCamera ? 0 : horizontalGap, width: stageWidth },
            ]}
          >
            <View
              style={[
                styles.cameraRail,
                usePinnedCamera ? styles.cameraRailPinned : null,
                { width: cameraSize },
              ]}
            >
              <CameraPreviewCard
                title={propertyName}
                subtitle={binding ? "Live verification preview" : "Camera preview available before pairing"}
                mode="preview"
                variant="orb"
                size={cameraSize}
                onCaptureReady={onCaptureReady}
              />
              {showSecondaryText ? <View style={styles.cameraCaption}>
                <MaterialCommunityIcons name="camera-front-variant" size={16} color={colors.mutedForeground} />
                <Text style={styles.cameraCaptionText}>Front camera</Text>
              </View> : null}
            </View>

            <View style={[styles.pinColumn, { width: keypadWidth }]}>
            <View style={[styles.pinSection, isCompact ? styles.pinSectionCompact : null]}>
              <PinDots length={pin.length} maxLength={KIOSK_PIN_LENGTH} size={pinDotSize} gap={keypadGap} />
              <PinPad
                disabled={disabled}
                busy={pinBusy}
                keyHeight={keyHeight}
                gap={keypadGap}
                digitSize={isCompact ? 30 : 34}
                onDigitPress={(digit) => {
                  setPin((currentValue) =>
                    currentValue.length >= KIOSK_PIN_LENGTH ? currentValue : `${currentValue}${digit}`
                  );
                }}
                onClear={() => {
                  setPin("");
                }}
                onSubmit={async () => {
                  if (pin.length !== KIOSK_PIN_LENGTH || disabled) {
                    return;
                  }

                  const pinToSubmit = pin;
                  setPin("");
                  await onSubmitPin(pinToSubmit);
                }}
              />
            </View>

            {showFooter ? <View style={styles.footerNote}>
              <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.mutedForeground} />
              <Text style={styles.footerText}>Kiosk access stays locked to one property at a time.</Text>
            </View> : null}
          </View>

          </View>
        </View>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  containerCompact: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  brandIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    gap: spacing.xxs,
  },
  brandTitle: {
    ...typography.label,
    color: colors.foreground,
  },
  brandSubtitle: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
  headerBadges: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  main: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  mainCompact: {
    justifyContent: "center",
    gap: spacing.sm,
  },
  workRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  workRowPinned: {
    position: "relative",
  },
  pinColumn: {
    alignItems: "center",
  },
  cameraRail: {
    alignItems: "center",
    gap: spacing.sm,
    flexShrink: 0,
  },
  cameraRailPinned: {
    position: "absolute",
    left: -spacing.lg,
    top: 0,
  },
  cameraCaption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  cameraCaptionText: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
  stationHeader: {
    alignItems: "center",
    gap: spacing.xs,
  },
  stationHeaderTight: {
    gap: spacing.xxs,
  },
  time: {
    ...typography.clock,
    fontSize: 62,
    lineHeight: 66,
    textAlign: "center",
    color: colors.foreground,
  },
  date: {
    ...typography.body,
    textAlign: "center",
    color: colors.secondaryForeground,
  },
  instruction: {
    ...typography.sectionTitle,
    textAlign: "center",
    color: colors.foreground,
  },
  instructionTight: {
    fontSize: 20,
    lineHeight: 25,
  },
  helper: {
    ...typography.helper,
    maxWidth: 390,
    textAlign: "center",
    color: colors.mutedForeground,
  },
  pinSection: {
    width: "100%",
    gap: spacing.lg,
  },
  pinSectionCompact: {
    gap: spacing.sm,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    width: "100%",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    ...typography.helper,
    color: colors.mutedForeground,
    textAlign: "center",
    flexShrink: 1,
  },
  railLabel: {
    ...typography.overline,
    color: colors.mutedForeground,
  },
  railValue: {
    ...typography.sectionTitle,
    fontSize: 22,
    color: colors.foreground,
  },
  railText: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
});
