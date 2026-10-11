import { useState } from "preact/hooks";
import { useResettableState } from "../useResettableState";
import { api } from "../api/client";
import type { Settings, WifiNetwork } from "../api/types";
import { Button, useStatus } from "../status/status";

export const MAX_NETWORKS = 5;

// Adds and removals wait here until the config form is saved.
export function useWifiNetworks(saved: string[], onSaved: (settings: Settings) => void) {
  const savedKey = saved.join("\n");
  const [removed, setRemoved] = useResettableState(savedKey, () => new Set<string>());
  const [added, setAdded] = useResettableState(savedKey, () => new Map<string, string>());

  // Order is boot priority for networks a scan misses: new ones first, then the kept saved ones.
  const desired: WifiNetwork[] = [
    ...[...added].map(([ssid, password]) => ({ ssid, password })),
    ...saved.filter((ssid) => !removed.has(ssid) && !added.has(ssid)).map((ssid) => ({ ssid })),
  ];
  const pending = removed.size > 0 || added.size > 0;

  const unremove = (ssid: string) => new Set([...removed].filter((name) => name !== ssid));

  return {
    saved,
    added,
    removed,
    desired,
    pending,
    stageAdd(ssid: string, password: string) {
      setRemoved(unremove(ssid));
      setAdded(new Map([...added, [ssid, password]]));
    },
    undoAdd: (ssid: string) => setAdded(new Map([...added].filter(([name]) => name !== ssid))),
    remove: (ssid: string) => setRemoved(new Set([...removed, ssid])),
    undoRemove: (ssid: string) => setRemoved(unremove(ssid)),
    // Resolves to the robot's error, or null when the list saved or nothing changed.
    async save(): Promise<string | null> {
      if (!pending) {
        return null;
      }

      const result = await api<Settings>("/settings/wifi", { method: "PUT", json: desired }).catch(
        () => null,
      );

      if (!result?.ok) {
        return result?.data.error || "network error";
      }

      setRemoved(new Set());
      setAdded(new Map());
      onSaved(result.data);

      return null;
    },
  };
}

type WifiNetworks = ReturnType<typeof useWifiNetworks>;

function NetworkRow({
  ssid,
  note = "",
  label,
  removed = false,
  enabled = true,
  onClick,
}: {
  ssid: string;
  note?: string;
  label: "Undo" | "Remove";
  removed?: boolean;
  enabled?: boolean;
  onClick: () => void;
}) {
  return (
    <li className={removed ? "wifi-network wifi-network-removed" : "wifi-network"}>
      <span className="wifi-network-ssid">{ssid}</span>
      <span className="wifi-network-note">{note}</span>
      <Button
        variant={label === "Remove" ? "danger" : undefined}
        disabled={!enabled}
        onClick={onClick}
      >
        {label}
      </Button>
    </li>
  );
}

export function WifiNetworksSection({ networks }: { networks: WifiNetworks }) {
  const { setStatus } = useStatus();
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");

  function stageAdd() {
    const name = ssid.trim();

    if (!name) {
      setStatus("Enter a WiFi network name.", "err");

      return;
    }

    const listed = networks.desired.some((network) => network.ssid === name);

    if (!listed && networks.desired.length >= MAX_NETWORKS) {
      setStatus(`The robot keeps up to ${MAX_NETWORKS} networks. Remove one first.`, "err");

      return;
    }

    networks.stageAdd(name, password);
    setSsid("");
    setPassword("");
  }

  const addOnEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      stageAdd();
    }
  };

  return (
    <div id="wifi-networks-section" className="config-section">
      <div className="config-section-head">
        <h3>WiFi networks</h3>
        <span className="apply-badge apply-reboot">After reboot</span>
      </div>
      <p className="config-section-desc">
        At boot the robot joins the strongest saved network in range. Up to 5 networks. Changes are
        sent on Save. The robot cannot test a network from here, so check the password.
      </p>
      <ul className="wifi-network-list" aria-label="Saved WiFi networks">
        {[...networks.added.keys()].map((name) => (
          <NetworkRow
            key={name}
            ssid={name}
            note={networks.saved.includes(name) ? "New password on save" : "Added on save"}
            label="Undo"
            onClick={() => networks.undoAdd(name)}
          />
        ))}
        {networks.saved
          .filter((name) => !networks.added.has(name))
          .map((name) =>
            networks.removed.has(name) ? (
              <NetworkRow
                key={name}
                ssid={name}
                note="Removed on save"
                label="Undo"
                removed
                onClick={() => networks.undoRemove(name)}
              />
            ) : (
              // The firmware keeps its last network; factory reset is the way to clear WiFi.
              <NetworkRow
                key={name}
                ssid={name}
                label="Remove"
                enabled={networks.desired.length > 1}
                onClick={() => networks.remove(name)}
              />
            ),
          )}
      </ul>
      <div className="form-group">
        <label htmlFor="wifi-network-ssid">Network name (SSID)</label>
        <input
          type="text"
          id="wifi-network-ssid"
          maxLength={32}
          autoComplete="off"
          value={ssid}
          onInput={(event) => setSsid(event.currentTarget.value)}
          onKeyDown={addOnEnter}
        />
      </div>
      <div className="form-group">
        <label htmlFor="wifi-network-password">Password</label>
        <input
          type="password"
          id="wifi-network-password"
          maxLength={63}
          autoComplete="new-password"
          value={password}
          onInput={(event) => setPassword(event.currentTarget.value)}
          onKeyDown={addOnEnter}
        />
        <p className="hint">Leave empty only for open networks.</p>
      </div>
      <Button id="wifi-network-add" onClick={stageAdd}>
        Add network
      </Button>
    </div>
  );
}
