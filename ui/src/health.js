import { apiGetJson } from "./api.js";
import { $ } from "./dom.js";

const healthInfo = $("#health-info");
let pollTimer = null;

export function setFirmwareVersion(health) {
  if (health.ok && health.version) $("#fw-version").textContent = `Firmware ${health.version}`;
}

function formatUptime(ms) {
  let seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  let minutes = Math.floor(seconds / 60);
  seconds %= 60;
  if (minutes < 60) return `${minutes} min ${seconds} s`;
  let hours = Math.floor(minutes / 60);
  minutes %= 60;
  if (hours < 24) return `${hours} h ${minutes} min`;
  const days = Math.floor(hours / 24);
  hours %= 24;
  return `${days} d ${hours} h`;
}

function formatBytes(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function describeHealth(health) {
  const ip = health.wifi?.connected ? health.wifi.ip : "offline";
  const heapUsed = health.heap_size
    ? Math.round((1 - health.free_heap / health.heap_size) * 100)
    : 0;
  const parts = [
    `IP: ${ip}`,
    `Uptime: ${formatUptime(health.uptime_ms)}`,
    `Heap: ${heapUsed}% used (${formatBytes(health.free_heap)} free)`,
  ];
  if (typeof health.cpu_temp_c === "number") parts.push(`Temp: ${health.cpu_temp_c.toFixed(1)} °C`);
  if (health.version) parts.push(health.version);
  return parts.join(" · ");
}

async function loadHealth() {
  try {
    const health = await apiGetJson("/health");
    if (!health.ok) throw new Error("health not ok");
    setFirmwareVersion(health);
    healthInfo.textContent = describeHealth(health);
  } catch {
    healthInfo.textContent = "Could not load status.";
  }
}

export function startHealthPolling() {
  stopHealthPolling();
  loadHealth();
  pollTimer = setInterval(loadHealth, 1000);
}

export function stopHealthPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}
