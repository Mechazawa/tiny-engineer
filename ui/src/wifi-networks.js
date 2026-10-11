import { apiPost } from "./api.js";
import { $, element } from "./dom.js";
import { setStatus } from "./status.js";

const MAX_NETWORKS = 5;
const ssidField = $("#wifi-network-ssid");
const passwordField = $("#wifi-network-password");

function networkRow(ssid, { note = "", action, label, enabled = true, removed = false }) {
  const row = element("li", removed ? "wifi-network wifi-network-removed" : "wifi-network");
  const button = element("button", label === "Remove" ? "btn btn-danger" : "btn", label);

  button.type = "button";
  button.disabled = !enabled;
  button.addEventListener("click", () => {
    action();
    wifiNetworks.render();
  });
  row.append(
    element("span", "wifi-network-ssid", ssid),
    element("span", "wifi-network-note", note),
    button,
  );

  return row;
}

// Adds and removals wait here until the config form is saved.
export const wifiNetworks = {
  list: $("#wifi-network-list"),
  saved: [],
  removed: new Set(),
  added: new Map(),

  load(settings) {
    this.saved = settings.wifi_networks ?? [];
    this.removed.clear();
    this.added.clear();
    this.render();
  },

  get pending() {
    return this.removed.size > 0 || this.added.size > 0;
  },

  isKept(ssid) {
    return this.saved.includes(ssid) && !this.removed.has(ssid);
  },

  get remaining() {
    return (
      this.saved.filter((ssid) => this.isKept(ssid) && !this.added.has(ssid)).length +
      this.added.size
    );
  },

  stageAdd() {
    const ssid = ssidField.value.trim();

    if (!ssid) {
      setStatus("Enter a WiFi network name.", "err");

      return;
    }

    if (!this.added.has(ssid) && !this.isKept(ssid) && this.remaining >= MAX_NETWORKS) {
      setStatus(`The robot keeps up to ${MAX_NETWORKS} networks. Remove one first.`, "err");

      return;
    }

    this.removed.delete(ssid);
    this.added.set(ssid, passwordField.value);
    ssidField.value = "";
    passwordField.value = "";
    this.render();
  },

  // The firmware keeps its last network; factory reset is the way to clear WiFi.
  render() {
    const addedRows = [...this.added.keys()].map((ssid) =>
      networkRow(ssid, {
        note: this.saved.includes(ssid) ? "New password on save" : "Added on save",
        action: () => this.added.delete(ssid),
        label: "Undo",
      }),
    );
    const savedRows = this.saved
      .filter((ssid) => !this.added.has(ssid))
      .map((ssid) =>
        this.removed.has(ssid)
          ? networkRow(ssid, {
              note: "Removed on save",
              action: () => this.removed.delete(ssid),
              label: "Undo",
              removed: true,
            })
          : networkRow(ssid, {
              action: () => this.removed.add(ssid),
              label: "Remove",
              enabled: this.remaining > 1,
            }),
      );

    this.list.replaceChildren(...addedRows, ...savedRows);
  },

  // Adds go first so swapping out the only saved network does not trip the firmware's keep-one
  // rule. Resolves to the error per failed network; the list reloads from the last robot reply.
  async save() {
    const requests = [
      ...[...this.added].map(([ssid, password]) => ({
        path: "/settings",
        params: { wifi_ssid: ssid, wifi_password: password },
      })),
      ...[...this.removed].map((ssid) => ({
        path: "/settings/wifi/remove",
        params: { wifi_ssid: ssid },
      })),
    ];
    const errors = [];
    let latest = null;

    for (const { path, params } of requests) {
      const result = await apiPost(path, params).catch(() => ({ ok: false, data: {} }));

      if (result.ok) {
        latest = result.data;
      } else {
        errors.push(`${params.wifi_ssid}: ${result.data.error || "network error"}`);
      }
    }

    if (latest) {
      this.load(latest);
    }

    return errors;
  },
};

$("#wifi-network-add").addEventListener("click", () => wifiNetworks.stageAdd());

for (const field of [ssidField, passwordField]) {
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      wifiNetworks.stageAdd();
    }
  });
}
