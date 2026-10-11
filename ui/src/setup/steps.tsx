import { useEffect, useRef, useState } from "preact/hooks";
import type { Settings } from "../api/types";
import { HostnameField } from "../config/HostnameField";
import { withFirst } from "../config/wifiNetworks";
import { useRobot } from "../robot";
import { Button, useStatus } from "../status/status";
import { useResettableState } from "../useResettableState";

export function ScreenStep({ onRotate }: { onRotate: () => void }) {
  return (
    <div className="config-section">
      <h3>Screen</h3>
      <p className="setup-copy">
        Look at the OLED. Text should read right-side up. Tap Rotate 180° if it is upside down.
      </p>
      <Button variant="primary" onClick={onRotate}>
        Rotate 180°
      </Button>
    </div>
  );
}

export function SpeakerStep() {
  const { perform, setStatus } = useStatus();

  async function play() {
    const result = await perform({
      path: "/setup/audio",
      pending: "Playing…",
      failure: "Playback failed",
    });

    if (result?.ok) {
      setStatus("Done.", "ok");
    }
  }

  return (
    <div className="config-section">
      <h3>Speaker</h3>
      <p className="setup-copy">
        Play the welcome clip. You should hear speech from the speaker. Skip if you want — you can
        test again later from Tests.
      </p>
      <Button id="setup-audio-play" variant="primary" onClick={play}>
        Play
      </Button>
    </div>
  );
}

export function NetworkStep() {
  const { settings, applySettings, leaveSetup } = useRobot();
  const { perform, setStatus } = useStatus();
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [hostname, setHostname] = useResettableState(settings?.hostname ?? "", String);
  const ssidRef = useRef<HTMLInputElement>(null);
  const hostnameRef = useRef<HTMLInputElement>(null);

  useEffect(() => ssidRef.current?.focus(), []);

  async function connect() {
    const network = ssid.trim();
    const host = hostname.trim();

    setHostname(host);

    if (!network) {
      setStatus("Enter a WiFi network name.", "err");

      return;
    }

    if (hostnameRef.current) {
      hostnameRef.current.value = host;

      if (!hostnameRef.current.reportValidity()) {
        return;
      }
    }

    // The connection test registers mDNS under the saved hostname, so it is saved first.
    const hostnameSaved = await perform({
      path: "/settings",
      request: { method: "POST", json: { hostname: host } },
      pending: "Saving hostname…",
      failure: "Hostname not saved",
    });

    if (!hostnameSaved?.ok) {
      return;
    }

    const result = await perform<Settings>({
      path: "/settings/wifi",
      request: { method: "PUT", json: withFirst(settings?.wifi_networks ?? [], network, password) },
      pending: "Testing WiFi credentials…",
      failure: "WiFi connection failed",
    });

    if (!result?.ok) {
      return;
    }

    applySettings(result.data);

    const { wifi_connect_success: connected, wifi_ip: ip, wifi_hostname: mdns } = result.data;

    if (!connected) {
      setStatus("WiFi connection failed", "err");

      return;
    }

    setPassword("");
    leaveSetup();

    const links = [ip, mdns].filter(Boolean).map((host) => `http://${host}`);

    setStatus(
      links.length
        ? `WiFi connected. Rejoin your home network and open ${links.join(" or ")}.`
        : "WiFi connected. Rejoin your home network.",
      "ok",
    );
  }

  return (
    <div className="config-section">
      <div className="config-section-head">
        <h3>WiFi</h3>
        <span className="apply-badge apply-now">Immediate</span>
      </div>
      <p className="hint">
        Enter the network name and password for the WiFi you want the robot to join.
      </p>
      <div>
        <div className="form-group">
          <label htmlFor="config-wifi-ssid">Network name (SSID)</label>
          <input
            ref={ssidRef}
            type="text"
            id="config-wifi-ssid"
            maxLength={32}
            autoComplete="off"
            value={ssid}
            onInput={(event) => setSsid(event.currentTarget.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="config-wifi-password">Password</label>
          <div className="token-row">
            <input
              type={revealed ? "text" : "password"}
              id="config-wifi-password"
              maxLength={63}
              autoComplete="new-password"
              value={password}
              onInput={(event) => setPassword(event.currentTarget.value)}
            />
            <Button className="btn-token-toggle" onClick={() => setRevealed(!revealed)}>
              {revealed ? "Hide" : "Show"}
            </Button>
          </div>
          <p className="hint">Leave empty only for open networks.</p>
        </div>
        <HostnameField
          id="config-wifi-hostname"
          value={hostname}
          onInput={setHostname}
          inputRef={hostnameRef}
        />
        <Button id="config-wifi-connect" variant="primary" onClick={connect}>
          Connect to WiFi
        </Button>
      </div>
    </div>
  );
}
