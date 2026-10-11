import { useEffect, useState } from "preact/hooks";
import { Link } from "wouter-preact";
import { api } from "../api/client";
import type { Health } from "../api/types";
import { useRobot } from "../robot";

function formatUptime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const days = Math.floor(totalSeconds / 86400);

  if (totalSeconds < 60) {
    return `${seconds} s`;
  }

  if (totalSeconds < 3600) {
    return `${minutes} min ${seconds} s`;
  }

  if (totalSeconds < 86400) {
    return `${hours} h ${minutes} min`;
  }

  return `${days} d ${hours} h`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1048576) {
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function describeHealth(health: Health) {
  const heapUsed = health.heap_size
    ? Math.round((1 - health.free_heap / health.heap_size) * 100)
    : 0;

  return [
    `IP: ${health.wifi?.connected ? health.wifi.ip : "offline"}`,
    `Uptime: ${formatUptime(health.uptime_ms)}`,
    `Heap: ${heapUsed}% used (${formatBytes(health.free_heap)} free)`,
    typeof health.cpu_temp_c === "number" && `Temp: ${health.cpu_temp_c.toFixed(1)} °C`,
    health.version,
  ]
    .filter(Boolean)
    .join(" · ");
}

function HealthStrip() {
  const { applyHealth } = useRobot();
  const [text, setText] = useState("Loading status…");

  useEffect(() => {
    async function poll() {
      try {
        const health = await api<Health>("/health");

        if (!health.ok) {
          throw new Error(health.data.error);
        }

        applyHealth(health.data);
        setText(describeHealth(health.data));
      } catch {
        setText("Could not load status.");
      }
    }

    poll();
    const timer = setInterval(poll, 1000);

    return () => clearInterval(timer);
  }, [applyHealth]);

  return (
    <div id="health-info" className="info-strip">
      {text}
    </div>
  );
}

const CARDS = [
  ["/animations", "Animations", "Pick a gesture — typing, reading, thinking, talking, and more."],
  ["/servo", "Servo control", "Move individual servos to any angle."],
  ["/tests", "Hardware tests", "Try the speaker, screen, LEDs, and servo sweep."],
  [
    "/config",
    "Config",
    "Device name, timeouts, volume, eyes style, boot behavior, serial logging, API token, and saved WiFi networks. Servo ranges, screen orientation, and RGB mapping are retuned in setup mode after factory reset.",
  ],
  ["/api", "API reference", "Full endpoint list, parameters, and curl-friendly docs."],
] as const;

export function Home() {
  return (
    <section>
      <div className="hero">
        <h1>Tiny Engineer</h1>
        <p>A desk robot that acts out your AI coding assistant while it works.</p>
      </div>
      <HealthStrip />
      <div className="cards">
        {CARDS.map(([href, title, text]) => (
          <Link key={href} className="card" href={href}>
            <h3>{title}</h3>
            <p>{text}</p>
          </Link>
        ))}
        <a
          className="card card-github"
          href="https://github.com/jamro/tiny-engineer"
          target="_blank"
          rel="noopener"
        >
          <h3>GitHub docs →</h3>
          <p>Build guide, wiring, and full project docs.</p>
        </a>
      </div>
    </section>
  );
}
