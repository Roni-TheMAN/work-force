import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { PropertySelectSheet } from "../components/PropertySelectSheet";
import { ScreenFrame } from "../components/ScreenFrame";
import { SurfaceCard } from "../components/SurfaceCard";
import { TextField } from "../components/TextField";
import { colors, radius, spacing, typography } from "../theme/tokens";
import type { PairingAuthorizedUser, PairingLoginCredentials } from "../types/kiosk";

type KioskPairViaLoginScreenProps = {
  defaultDeviceName: string;
  onBack: () => void;
  onAuthenticate: (credentials: PairingLoginCredentials) => Promise<PairingAuthorizedUser>;
  onCompletePairing: (authorizedUserId: string, propertyId: string, deviceName: string) => Promise<void>;
};

export function KioskPairViaLoginScreen({
  defaultDeviceName,
  onBack,
  onAuthenticate,
  onCompletePairing,
}: KioskPairViaLoginScreenProps) {
  const { height, width } = useWindowDimensions();
  const isCompact = width < 620 || height < 720;
  const isWide = width >= 980 && height >= 680;
  const [deviceName, setDeviceName] = useState(defaultDeviceName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorizedUser, setAuthorizedUser] = useState<PairingAuthorizedUser | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  return (
    <ScreenFrame style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.container, isWide ? styles.containerWide : null, isCompact ? styles.containerCompact : null]}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed ? styles.buttonPressed : null]}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.title}>Pair with secure login</Text>
              <Text style={styles.subtitle}>
                Only authorized owners, org admins, property admins, and permitted managers can assign this kiosk.
              </Text>
            </View>
          </View>

          <View style={[styles.main, isWide ? styles.mainWide : null]}>
            <SurfaceCard style={styles.formCard}>
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Authorized sign-in</Text>
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="owner@sunrise.test"
                  keyboardType="email-address"
                />
                <TextField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  secureTextEntry
                />
                <TextField
                  label="Device name"
                  value={deviceName}
                  onChangeText={setDeviceName}
                  placeholder="Front Desk Kiosk"
                  helperText="This becomes the property-bound kiosk name for the real device registration."
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <Pressable
                  disabled={busy}
                  onPress={async () => {
                    try {
                      setBusy(true);
                      setError(null);
                      const nextUser = await onAuthenticate({
                        email,
                        password,
                        deviceName,
                      });
                      setAuthorizedUser(nextUser);
                      setSheetVisible(true);
                    } catch (nextError) {
                      setError(nextError instanceof Error ? nextError.message : "Unable to sign in.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null, busy ? styles.buttonDisabled : null]}
                >
                  <Text style={styles.primaryButtonLabel}>{busy ? "Signing in..." : "Continue"}</Text>
                </Pressable>
              </View>
            </SurfaceCard>

            <SurfaceCard style={styles.sideCard}>
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Assignment rules</Text>
                <Text style={styles.infoText}>Property selection is limited to the authenticated admin's allowed property scope.</Text>
                <Text style={styles.infoText}>The device binding resolves organization + property together and stays property-bound after restart.</Text>
                <Text style={styles.infoText}>This screen now signs in against Supabase and registers the kiosk against the selected property.</Text>
              </View>

              {authorizedUser ? (
                <View style={styles.identityCard}>
                  <Text style={styles.identityLabel}>Signed in as</Text>
                  <Text style={styles.identityName}>{authorizedUser.fullName}</Text>
                  <Text style={styles.identityMeta}>
                    {authorizedUser.role.replaceAll("_", " ")} • {authorizedUser.organization.name}
                  </Text>
                  <Pressable onPress={() => setSheetVisible(true)} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}>
                    <Text style={styles.secondaryButtonLabel}>Select property</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setAuthorizedUser(null);
                      setPassword("");
                    }}
                    style={({ pressed }) => [styles.ghostButton, pressed ? styles.buttonPressed : null]}
                  >
                    <Text style={styles.ghostButtonLabel}>Log out</Text>
                  </Pressable>
                </View>
              ) : null}
            </SurfaceCard>
          </View>
        </View>
      </ScrollView>

      <PropertySelectSheet
        visible={sheetVisible && Boolean(authorizedUser)}
        properties={authorizedUser?.allowedProperties ?? []}
        onClose={() => setSheetVisible(false)}
        onSelect={async (propertyId) => {
          if (!authorizedUser) {
            return;
          }

          try {
            setBusy(true);
            setError(null);
            await onCompletePairing(authorizedUser.id, propertyId, deviceName);
            setSheetVisible(false);
          } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : "Unable to pair this property.");
            setSheetVisible(false);
          } finally {
            setBusy(false);
          }
        }}
      />
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
  buttonDisabled: {
    opacity: 0.6,
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
  formCard: {
    flex: 1,
    padding: spacing.xl,
  },
  formSection: {
    gap: spacing.md,
  },
  sideCard: {
    flex: 0.9,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  sectionBlock: {
    gap: spacing.sm,
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
  errorText: {
    ...typography.helper,
    color: colors.destructive,
  },
  primaryButton: {
    minHeight: 54,
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
  identityCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
  },
  identityLabel: {
    ...typography.helper,
    color: colors.mutedForeground,
  },
  identityName: {
    ...typography.sectionTitle,
    fontSize: 21,
    color: colors.foreground,
  },
  identityMeta: {
    ...typography.body,
    color: colors.secondaryForeground,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "hsla(176, 58%, 36%, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonLabel: {
    ...typography.label,
    color: colors.primaryForeground,
  },
  ghostButton: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  ghostButtonLabel: {
    ...typography.label,
    color: colors.foreground,
  },
});
