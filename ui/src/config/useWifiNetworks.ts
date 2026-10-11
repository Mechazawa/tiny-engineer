import { api } from "../api/client";
import type { Settings, WifiNetwork } from "../api/types";
import { useResettableState } from "../useResettableState";

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

  const unremove = (ssid: string) =>
    setRemoved((names) => new Set([...names].filter((name) => name !== ssid)));

  return {
    saved,
    added,
    removed,
    desired,
    pending,
    stageAdd(ssid: string, password: string) {
      unremove(ssid);
      setAdded((networks) => new Map([...networks, [ssid, password]]));
    },
    undoAdd: (ssid: string) =>
      setAdded((networks) => new Map([...networks].filter(([name]) => name !== ssid))),
    remove: (ssid: string) => setRemoved((names) => new Set([...names, ssid])),
    undoRemove: unremove,
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
