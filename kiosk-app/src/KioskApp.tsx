import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { AppState, BackHandler, Platform, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppBackdrop } from "./components/AppBackdrop";
import { HiddenAdminPanel } from "./components/HiddenAdminPanel";
import { RESULT_AUTO_RETURN_MS } from "./lib/constants";
import { formatActionLabel, formatFullName } from "./lib/format";
import { ClockActionResultScreen } from "./screens/ClockActionResultScreen";
import { KioskCameraTestScreen } from "./screens/KioskCameraTestScreen";
import { KioskHomeScreen } from "./screens/KioskHomeScreen";
import { KioskPairViaLoginScreen } from "./screens/KioskPairViaLoginScreen";
import { KioskPairViaQRScreen } from "./screens/KioskPairViaQRScreen";
import { KioskScheduleScreen } from "./screens/KioskScheduleScreen";
import { createKioskService } from "./services/kiosk-service";
import { clearPersistedKioskSession, loadPersistedKioskSession, persistKioskSession } from "./storage/kiosk-storage";
import { colors, spacing } from "./theme/tokens";
import type { ClockFlowResult, KioskBrandingConfig, KioskDeviceBinding, KioskHealthSummary, PairingAuthorizedUser, PairingResult } from "./types/kiosk";

type KioskScreen =
  | { name: "home" }
  | { name: "pair-qr" }
  | { name: "pair-login" }
  | { name: "camera-test" }
  | { name: "schedule" }
  | { name: "result"; result: ClockFlowResult };

function KioskLoadingState() {
  return <View style={styles.loadingSkeleton} />;
}

function buildPairingResult(result: PairingResult): ClockFlowResult {
  return {
    kind: "pairing",
    success: true,
    title: "Kiosk paired",
    message: `${result.binding.property.name} is now the active property for this device.`,
  };
}

export function KioskApp() {
  const serviceRef = useRef(createKioskService());
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState<KioskScreen>({ name: "home" });
  const [adminVisible, setAdminVisible] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [binding, setBinding] = useState<KioskDeviceBinding | null>(null);
  const [branding, setBranding] = useState<KioskBrandingConfig | null>(null);
  const [health, setHealth] = useState<KioskHealthSummary>({
    state: "attention",
    message: "Kiosk is waiting for property pairing.",
    lastSyncAt: null,
  });
  const [homeCaptureHandle, setHomeCaptureHandle] = useState<(() => Promise<string | null>) | null>(null);

  const navigateHome = useCallback(() => {
    startTransition(() => {
      setScreen({ name: "home" });
    });
  }, []);

  const refreshHealth = useCallback(async (nextBinding: KioskDeviceBinding | null) => {
    const nextHealth = await serviceRef.current.fetchHealthStatus(nextBinding);
    setHealth(nextHealth);
  }, []);

  const applyPairing = useCallback(async (result: PairingResult) => {
    setBinding(result.binding);
    setBranding(result.branding);
    await persistKioskSession({
      binding: result.binding,
      branding: result.branding,
      deviceAuthToken: result.deviceAuthToken,
      environment: "api",
      storedAt: new Date().toISOString(),
    });
    await refreshHealth(result.binding);
    setAdminVisible(false);
    startTransition(() => {
      setScreen({ name: "result", result: buildPairingResult(result) });
    });
  }, [refreshHealth]);

  const hydrateApp = useCallback(async () => {
    const persisted = await loadPersistedKioskSession();

    if (persisted?.deviceAuthToken) {
      let hydratedBinding: KioskDeviceBinding | null = null;

      try {
        hydratedBinding = await serviceRef.current.fetchCurrentKioskDeviceBinding(persisted.deviceAuthToken);
      } catch {
        hydratedBinding = persisted.binding;
      }

      if (hydratedBinding) {
        const hydratedBranding = await serviceRef.current.fetchPropertyBranding(hydratedBinding);
        setBinding(hydratedBinding);
        setBranding(hydratedBranding);
        await persistKioskSession({
          ...persisted,
          binding: hydratedBinding,
          branding: hydratedBranding,
          environment: "api",
          storedAt: new Date().toISOString(),
        });
        await refreshHealth(hydratedBinding);
      } else {
        await clearPersistedKioskSession();
        await refreshHealth(null);
      }
    } else {
      if (persisted) {
        await clearPersistedKioskSession();
      }
      await refreshHealth(null);
    }

    setBooting(false);
  }, [refreshHealth]);

  useEffect(() => {
    hydrateApp();
  }, [hydrateApp]);

  useEffect(() => {
    if (!binding) {
      return;
    }

    const runReconnectRefresh = () => {
      void serviceRef.current.refreshConnectedData(binding).finally(() => {
        void refreshHealth(binding);
      });
    };

    const unsubscribeNetwork = serviceRef.current.subscribeToNetworkStatus((status) => {
      if (!status.isConnected || !status.isInternetReachable) {
        void refreshHealth(binding);
        return;
      }

      runReconnectRefresh();
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        runReconnectRefresh();
      }
    });

    return () => {
      unsubscribeNetwork();
      appStateSubscription.remove();
    };
  }, [binding, refreshHealth]);

  useEffect(() => {
    if (screen.name !== "result") {
      return;
    }

    const timeout = setTimeout(() => {
      navigateHome();
    }, RESULT_AUTO_RETURN_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [navigateHome, screen]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (adminVisible) {
        setAdminVisible(false);
        return true;
      }

      if (screen.name !== "home") {
        navigateHome();
        return true;
      }

      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [adminVisible, navigateHome, screen.name]);

  const handlePairWithQr = useCallback(async (rawValue: string, deviceName: string) => {
    const payload = serviceRef.current.parsePairingQrData(rawValue);
    const result = await serviceRef.current.pairKioskWithQr(payload, deviceName);
    await applyPairing(result);
  }, [applyPairing]);

  const handleAuthenticate = useCallback(async (credentials: {
    email: string;
    password: string;
    deviceName: string;
  }): Promise<PairingAuthorizedUser> => {
    return serviceRef.current.authenticatePairingUser(credentials);
  }, []);

  const handlePairWithLogin = useCallback(async (authorizedUserId: string, propertyId: string, deviceName: string) => {
    const result = await serviceRef.current.pairKioskWithAuthorizedLogin({
      authorizedUserId,
      propertyId,
      deviceName,
    });
    await applyPairing(result);
  }, [applyPairing]);

  const handleUnpair = useCallback(async () => {
    if (binding) {
      await serviceRef.current.unpairKiosk(binding);
    }

    await clearPersistedKioskSession();
    setBinding(null);
    setBranding(null);
    setAdminVisible(false);
    navigateHome();
    await refreshHealth(null);
  }, [binding, navigateHome, refreshHealth]);

  const handleSubmitPin = useCallback(async (pin: string) => {
    if (!binding) {
      startTransition(() => {
        setScreen({
          name: "result",
          result: {
            kind: "clock",
            success: false,
            title: "Kiosk not paired",
            message: "Open the hidden admin panel and connect this device to a property first.",
          },
        });
      });
      return;
    }

    try {
      setPinBusy(true);
      const validation = await serviceRef.current.validateEmployeePin(binding, pin);

      if (!validation.ok) {
        startTransition(() => {
          setScreen({
            name: "result",
            result: {
              kind: "clock",
              success: false,
              title: validation.title,
              message: validation.message,
            },
          });
        });
        return;
      }

      let capturedImageUri: string | null = null;

      if (validation.requiresPhotoCapture) {
        try {
          capturedImageUri = homeCaptureHandle ? await homeCaptureHandle() : null;
        } catch {
          capturedImageUri = null;
        }
      }

      const clockResult = await serviceRef.current.createClockEvent({
        binding,
        employee: validation.employee,
        action: validation.nextAction,
        capturedImageUri,
        occurredAt: new Date().toISOString(),
      });

      startTransition(() => {
        setScreen({
          name: "result",
          result: {
            kind: "clock",
            success: clockResult.ok,
            title: clockResult.title,
            message: clockResult.message,
            employeeName: clockResult.employee
              ? formatFullName(clockResult.employee.firstName, clockResult.employee.lastName)
              : undefined,
            actionLabel: formatActionLabel(clockResult.action),
          },
        });
      });
      await refreshHealth(binding);
    } finally {
      setPinBusy(false);
    }
  }, [binding, homeCaptureHandle, refreshHealth]);

  if (booting) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar hidden style="dark" />
        <AppBackdrop />
        <KioskLoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={Platform.OS !== "web"} style="dark" />
      <AppBackdrop />

      {screen.name === "home" ? (
        <>
          <KioskHomeScreen
            binding={binding}
            branding={branding}
            health={health}
            pinBusy={pinBusy}
            onOpenAdminPanel={() => setAdminVisible(true)}
            onSubmitPin={handleSubmitPin}
            onCaptureReady={setHomeCaptureHandle}
            onViewSchedule={binding ? () => startTransition(() => setScreen({ name: "schedule" })) : undefined}
          />
          <HiddenAdminPanel
            visible={adminVisible}
            binding={binding}
            health={health}
            appVersion={appVersion}
            onClose={() => setAdminVisible(false)}
            onPairWithQr={() => {
              setAdminVisible(false);
              startTransition(() => setScreen({ name: "pair-qr" }));
            }}
            onPairWithLogin={() => {
              setAdminVisible(false);
              startTransition(() => setScreen({ name: "pair-login" }));
            }}
            onSwitchProperty={() => {
              setAdminVisible(false);
              startTransition(() => setScreen({ name: "pair-login" }));
            }}
            onUnpair={handleUnpair}
            onCameraTest={() => {
              setAdminVisible(false);
              startTransition(() => setScreen({ name: "camera-test" }));
            }}
          />
        </>
      ) : null}

      {screen.name === "pair-qr" ? (
        <KioskPairViaQRScreen
          defaultDeviceName={binding?.device.deviceName ?? "Front Desk Kiosk"}
          onBack={navigateHome}
          onSwitchToLogin={() => startTransition(() => setScreen({ name: "pair-login" }))}
          onSubmitPairing={handlePairWithQr}
        />
      ) : null}

      {screen.name === "pair-login" ? (
        <KioskPairViaLoginScreen
          defaultDeviceName={binding?.device.deviceName ?? "Front Desk Kiosk"}
          onBack={navigateHome}
          onAuthenticate={handleAuthenticate}
          onCompletePairing={handlePairWithLogin}
        />
      ) : null}

      {screen.name === "camera-test" ? (
        <KioskCameraTestScreen binding={binding} onBack={navigateHome} />
      ) : null}

      {screen.name === "schedule" && binding ? (
        <KioskScheduleScreen
          binding={binding}
          loadScheduleWeek={serviceRef.current.loadScheduleWeek}
          onBack={navigateHome}
        />
      ) : null}

      {screen.name === "result" ? (
        <ClockActionResultScreen result={screen.result} onDone={navigateHome} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingSkeleton: {
    flex: 1,
    margin: spacing.xl,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
});
