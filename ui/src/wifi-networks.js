import { $, element } from "./dom.js";
import { perform, setStatus } from "./status.js";

const list = $("#wifi-network-list");
const ssidField = $("#wifi-network-ssid");
const passwordField = $("#wifi-network-password");

async function removeNetwork(ssid) {
  const result = await perform({
    path: "/settings/wifi/remove",
    params: { wifi_ssid: ssid },
    pending: "Removing…",
    failure: "Remove failed",
  });

  if (!result?.ok) {
    return;
  }

  applyWifiNetworks(result.data);
  setStatus(`Removed ${ssid}.`, "ok");
}

// The firmware keeps the last network; factory reset is the way to clear WiFi.
function networkRow(ssid, removable) {
  const row = element("li", "wifi-network");
  const remove = element("button", "btn btn-danger", "Remove");

  remove.type = "button";
  remove.disabled = !removable;
  remove.addEventListener("click", () => removeNetwork(ssid));
  row.append(element("span", "wifi-network-ssid", ssid), remove);

  return row;
}

export function applyWifiNetworks(settings) {
  const networks = settings.wifi_networks ?? [];

  list.replaceChildren(...networks.map((ssid) => networkRow(ssid, networks.length > 1)));
}

$("#wifi-network-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const result = await perform({
    path: "/settings",
    params: { wifi_ssid: ssidField.value.trim(), wifi_password: passwordField.value },
    pending: "Saving…",
    failure: "Save failed",
  });

  if (!result?.ok) {
    return;
  }

  ssidField.value = "";
  passwordField.value = "";
  applyWifiNetworks(result.data);
  setStatus("Network saved. The robot tries it at next boot.", "ok");
});
