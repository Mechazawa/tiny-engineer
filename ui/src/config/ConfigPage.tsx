import { token } from "../api/client";
import type { LoadingMode, Settings } from "../api/types";
import { useRobot } from "../robot";
import { Wizard } from "../setup/Wizard";
import { useResettableState } from "../useResettableState";
import { Button, useStatus } from "../status/status";
import { AccessTokenField, useAccessToken } from "./accessToken";
import { HostnameField } from "./HostnameField";
import { useWifiNetworks, WifiNetworksSection } from "./wifiNetworks";

const EYES_STYLES = ["classic", "kaomoji", "cover", "dots"];

const loadingMode = (settings: Settings): LoadingMode =>
  settings.loading === "sleep_inertia" ? "sleep_inertia" : "progress";

const clampVolume = (value: string) => {
  const parsed = parseInt(value, 10);

  return Number.isNaN(parsed) ? 70 : Math.min(100, Math.max(0, parsed));
};

function draftFrom(settings: Settings | null) {
  return {
    hostname: settings?.hostname ?? "",
    sleepTimeout: String(settings?.sleep_timeout ?? ""),
    continuousTimeout: String(settings?.continuous_timeout ?? 5),
    volume: settings?.volume ?? 70,
    welcome: settings?.welcome !== false,
    serialLog: Boolean(settings?.serial_log),
    loading: settings ? loadingMode(settings) : "progress",
    eyesStyle:
      settings && EYES_STYLES.includes(settings.eyes_style) ? settings.eyes_style : "classic",
  };
}

function saveMessage(previousHost: string, previousLoading: LoadingMode, saved: Settings) {
  const hostChanged = saved.hostname !== previousHost || Boolean(saved.reboot_required);
  const loadingChanged = loadingMode(saved) !== previousLoading;

  if (hostChanged && loadingChanged) {
    return "Saved. Hostname and loading screen apply after reboot.";
  }

  if (hostChanged) {
    return "Saved. Hostname applies after reboot.";
  }

  if (loadingChanged) {
    return "Saved. Loading screen applies after reboot.";
  }

  return "Settings saved.";
}

function ConfigForm() {
  const { settings, applySettings } = useRobot();
  const { perform, setStatus } = useStatus();
  const [draft, setDraft] = useResettableState(settings, draftFrom);
  const accessToken = useAccessToken(settings);
  const networks = useWifiNetworks(settings?.wifi_networks ?? [], applySettings);
  const set = (fields: Partial<typeof draft>) => setDraft({ ...draft, ...fields });

  async function save(event: Event) {
    event.preventDefault();

    const host = draft.hostname.trim();
    const previousLoading = draft.loading;
    const newToken = accessToken.pendingValue;

    await perform<Settings>({
      path: "/settings",
      request: {
        method: "POST",
        params: {
          sleep_timeout: draft.sleepTimeout,
          hostname: host,
          volume: draft.volume,
          welcome: draft.welcome ? 1 : 0,
          serial_log: draft.serialLog ? 1 : 0,
          continuous_timeout: draft.continuousTimeout,
          loading: draft.loading,
          eyes_style: draft.eyesStyle,
          ...(newToken === undefined ? {} : { access_token: newToken }),
        },
      },
      pending: "Saving…",
      failure: "Save failed",
      onSuccess: async (saved) => {
        applySettings(saved);

        if (newToken !== undefined) {
          token.set(newToken);
        }

        const wifiChanged = networks.pending;
        const wifiError = await networks.save();

        if (wifiError) {
          setStatus(`Settings saved. WiFi networks not saved: ${wifiError}`, "err");

          return;
        }

        const wifiNote = wifiChanged ? " WiFi networks apply after reboot." : "";

        setStatus(saveMessage(host, previousLoading, saved) + wifiNote, "ok");
      },
    });
  }

  return (
    <form id="config-form" onSubmit={save}>
      <div className="config-section">
        <div className="config-section-head">
          <h3>Network</h3>
          <span className="apply-badge apply-reboot">After reboot</span>
        </div>
        <HostnameField
          id="config-hostname"
          value={draft.hostname}
          onInput={(hostname) => set({ hostname })}
        />
      </div>
      <WifiNetworksSection networks={networks} />
      <div className="config-section">
        <div className="config-section-head">
          <h3>Timeouts</h3>
          <span className="apply-badge apply-now">Immediate</span>
        </div>
        <div className="form-group">
          <label htmlFor="config-sleep">Sleep timeout (minutes)</label>
          <input
            type="number"
            id="config-sleep"
            min="1"
            max="1440"
            step="1"
            required
            value={draft.sleepTimeout}
            onInput={(event) => set({ sleepTimeout: event.currentTarget.value })}
          />
          <p className="hint">
            Minutes in animation <code>none</code> before OLED blanks
          </p>
        </div>
        <div className="form-group">
          <label htmlFor="config-continuous">Continuous anim timeout (minutes)</label>
          <input
            type="number"
            id="config-continuous"
            min="1"
            max="1440"
            step="1"
            required
            value={draft.continuousTimeout}
            onInput={(event) => set({ continuousTimeout: event.currentTarget.value })}
          />
          <p className="hint">Max time for typing / reading / thinking / talking</p>
        </div>
      </div>
      <div className="config-section">
        <div className="config-section-head">
          <h3>Audio</h3>
          <span className="apply-badge apply-now">Immediate</span>
        </div>
        <div className="form-group">
          <label htmlFor="config-volume">
            Volume <span>{`${draft.volume}%`}</span>
          </label>
          <div className="range-row">
            <input
              type="range"
              aria-label="Volume slider"
              min="0"
              max="100"
              value={draft.volume}
              onInput={(event) => set({ volume: clampVolume(event.currentTarget.value) })}
            />
            <input
              type="number"
              id="config-volume"
              min="0"
              max="100"
              step="1"
              required
              value={draft.volume}
              onInput={(event) => set({ volume: clampVolume(event.currentTarget.value) })}
            />
          </div>
        </div>
      </div>
      <div className="config-section">
        <div className="config-section-head">
          <h3>Display</h3>
        </div>
        <div className="form-group">
          <div className="field-head">
            <label htmlFor="config-eyes-style">Eyes style</label>
            <span className="apply-badge apply-now">Immediate</span>
          </div>
          <select
            id="config-eyes-style"
            value={draft.eyesStyle}
            onChange={(event) => set({ eyesStyle: event.currentTarget.value })}
          >
            <option value="classic">Classic</option>
            <option value="kaomoji">Kaomoji</option>
            <option value="cover">Cover</option>
            <option value="dots">Dots</option>
          </select>
          <p className="hint">
            Classic is the default procedural eyes. Kaomoji maps each animation to a face from the
            expression library. Cover fills each half of the screen for a mask with eye holes;
            animations change height with black margins. Dots draws a 12x12 circle per eye; size and
            position follow the same poses as classic. Add new styles in firmware under{" "}
            <code>display/eyes/styles/</code>.
          </p>
        </div>
      </div>
      <div className="config-section">
        <h3>Boot behavior</h3>
        <p className="config-section-desc">Loading screen changes take effect on next boot.</p>
        <div className="form-group">
          <div className="field-head">
            <label htmlFor="config-loading">Boot loading screen</label>
            <span className="apply-badge apply-reboot">After reboot</span>
          </div>
          <select
            id="config-loading"
            value={draft.loading}
            onChange={(event) => set({ loading: event.currentTarget.value as LoadingMode })}
          >
            <option value="progress">Progress bar</option>
            <option value="sleep_inertia">Sleep inertia (no IP display)</option>
          </select>
          <p className="hint" hidden={draft.loading !== "sleep_inertia" || draft.welcome}>
            Head motion during boot needs Welcome enabled.
          </p>
        </div>
        <div className="form-group">
          <div className="field-head">
            <span>Welcome on boot</span>
            <span className="apply-badge apply-now">Immediate</span>
          </div>
          <div className="toggle-row">
            <input
              type="checkbox"
              id="config-welcome"
              checked={draft.welcome}
              onChange={(event) => set({ welcome: event.currentTarget.checked })}
            />
            <label htmlFor="config-welcome">Play welcome when Wi-Fi connects</label>
          </div>
        </div>
        <div className="form-group">
          <div className="field-head">
            <span>Serial logging</span>
            <span className="apply-badge apply-now">Immediate</span>
          </div>
          <div className="toggle-row">
            <input
              type="checkbox"
              id="config-serial-log"
              checked={draft.serialLog}
              onChange={(event) => set({ serialLog: event.currentTarget.checked })}
            />
            <label htmlFor="config-serial-log">Log to USB serial</label>
          </div>
        </div>
      </div>
      <div className="config-section">
        <h3>Security</h3>
        <AccessTokenField {...accessToken.field} />
      </div>
      <Button type="submit" variant="primary">
        Save settings
      </Button>
    </form>
  );
}

function FactoryReset() {
  const { showRebootGate } = useRobot();
  const { perform, clearStatus } = useStatus();

  async function reset() {
    const confirmed = confirm(
      "Reset settings to factory defaults? WiFi credentials will be cleared. Servo ranges, RGB LED mapping, and screen rotation stay. Power-cycle the device to reopen setup AP mode and configure WiFi again.",
    );

    if (!confirmed) {
      return;
    }

    const result = await perform({
      path: "/settings/reset",
      pending: "Resetting…",
      failure: "Factory reset failed",
    });

    if (result?.ok) {
      token.set("");
      clearStatus();
      showRebootGate();
    }
  }

  return (
    <div className="config-section config-danger">
      <h3>Factory reset</h3>
      <p className="hint">
        Erases saved settings and restores defaults. WiFi credentials are cleared. Servo ranges, RGB
        LED mapping, and screen rotation stay. Power-cycle the device to reopen setup AP mode and
        configure WiFi again.
      </p>
      <Button variant="danger" onClick={reset}>
        Factory reset
      </Button>
    </div>
  );
}

export function ConfigPage() {
  const { inSetup } = useRobot();

  if (inSetup) {
    return (
      <section>
        <Wizard />
      </section>
    );
  }

  return (
    <section>
      <h2 className="page-title">Config</h2>
      <p className="page-desc">Saved to flash. Most changes apply right away.</p>
      <ConfigForm />
      <FactoryReset />
    </section>
  );
}
