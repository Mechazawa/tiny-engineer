import { type ComponentChildren, createContext } from "preact";
import { useCallback, useContext, useEffect, useMemo, useState } from "preact/hooks";
import { api, apiFetch, token } from "./api/client";
import type { AuthInfo, Health, Settings } from "./api/types";
import { useStatus } from "./status/status";

type Gate = "booting" | "auth" | "reboot" | null;

interface RobotApi {
  gate: Gate;
  // Setup AP mode, or no WiFi saved yet: the config page becomes the setup wizard.
  inSetup: boolean;
  version: string | null;
  settings: Settings | null;
  applyHealth: (health: Health) => void;
  applySettings: (settings: Settings) => void;
  unlock: (candidate: string) => Promise<boolean>;
  showRebootGate: () => void;
  leaveSetup: () => void;
}

const RobotContext = createContext<RobotApi | null>(null);

export function useRobot(): RobotApi {
  const value = useContext(RobotContext);

  if (!value) {
    throw new Error("useRobot outside RobotProvider");
  }

  return value;
}

async function tokenAccepted() {
  return (await apiFetch("/settings")).status !== 401;
}

export function RobotProvider({ children }: { children: ComponentChildren }) {
  const { setStatus } = useStatus();
  const [gate, setGate] = useState<Gate>("booting");
  const [provisioning, setProvisioning] = useState(false);
  const [wifiConfigured, setWifiConfigured] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const applyHealth = useCallback((health: Health) => {
    setVersion(health.version || null);
    setProvisioning(Boolean(health.provisioning));
    setWifiConfigured(Boolean(health.wifi_configured));
  }, []);

  const applySettings = useCallback((next: Settings) => {
    setSettings(next);
    setWifiConfigured(Boolean(next.wifi_configured));
  }, []);

  const enterApp = useCallback(async () => {
    try {
      const health = await api<Health>("/health");

      if (health.ok) {
        applyHealth(health.data);
      }
    } catch {
      // Keep the normal UI; a reload retries.
    }

    setGate(null);

    try {
      const loaded = await api<Settings>("/settings");

      if (loaded.ok) {
        applySettings(loaded.data);
      }
    } catch {
      setStatus("Could not load settings", "err");
    }
  }, [applyHealth, applySettings, setStatus]);

  const unlock = useCallback(
    async (candidate: string) => {
      token.set(candidate);

      try {
        if (await tokenAccepted()) {
          await enterApp();

          return true;
        }
      } catch {
        // Treated as a rejected token below.
      }

      token.set("");

      return false;
    },
    [enterApp],
  );

  useEffect(() => {
    async function boot() {
      let auth;

      try {
        auth = await api<AuthInfo>("/auth");
      } catch {
        return enterApp();
      }

      if (!auth.ok || !auth.data.required) {
        return enterApp();
      }

      if (token.get()) {
        try {
          if (await tokenAccepted()) {
            return enterApp();
          }

          token.set("");
        } catch {
          // Network trouble: ask for the token again without discarding it.
        }
      }

      setGate("auth");
    }

    boot();
  }, [enterApp]);

  const value = useMemo<RobotApi>(
    () => ({
      gate,
      inSetup: provisioning || !wifiConfigured,
      version,
      settings,
      applyHealth,
      applySettings,
      unlock,
      showRebootGate: () => setGate("reboot"),
      leaveSetup: () => {
        setProvisioning(false);
        setWifiConfigured(true);
      },
    }),
    [gate, provisioning, wifiConfigured, version, settings, applyHealth, applySettings, unlock],
  );

  return <RobotContext.Provider value={value}>{children}</RobotContext.Provider>;
}
