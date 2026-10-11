import { useEffect, useState } from "preact/hooks";
import { api } from "../api/client";
import type { Health } from "../api/types";
import { formatBytes, formatDuration } from "../lib/format";
import { useRobot } from "../robot";

function describeHealth(health: Health) {
  const heapUsed = health.heap_size
    ? Math.round((1 - health.free_heap / health.heap_size) * 100)
    : 0;

  return [
    `IP: ${health.wifi?.connected ? health.wifi.ip : "offline"}`,
    `Uptime: ${formatDuration(health.uptime_ms)}`,
    `Heap: ${heapUsed}% used (${formatBytes(health.free_heap)} free)`,
    typeof health.cpu_temp_c === "number" && `Temp: ${health.cpu_temp_c.toFixed(1)} °C`,
    health.version,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function HealthStrip() {
  const { applyHealth } = useRobot();
  const [text, setText] = useState("Loading status…");

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    // Each poll waits for the previous reply, so a slow robot never gets overlapping requests.
    async function poll() {
      while (!signal.aborted) {
        try {
          const health = await api<Health>("/health", { signal });

          if (!health.ok) {
            throw new Error(health.data.error);
          }

          applyHealth(health.data);
          setText(describeHealth(health.data));
        } catch {
          if (!signal.aborted) {
            setText("Could not load status.");
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    poll();

    return () => controller.abort();
  }, [applyHealth]);

  return (
    <div id="health-info" className="info-strip">
      {text}
    </div>
  );
}
