import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import type { Settings, WifiNetwork } from "../src/api/types";
import { App } from "../src/App";

const DEFAULT_SETTINGS: Settings = {
  ok: true,
  hostname: "tiny-engineer",
  sleep_timeout: 10,
  continuous_timeout: 5,
  volume: 70,
  welcome: true,
  serial_log: false,
  loading: "progress",
  eyes_style: "classic",
  access_token_set: false,
  wifi_configured: true,
  wifi_networks: ["home"],
  servo_mins: [60, 40, 45, 35, 40],
  servo_maxs: [130, 130, 135, 125, 130],
  rgb_order: "GRB",
  oled_rotate_180: false,
};

export interface RecordedRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  authorization?: string;
  json?: unknown;
}

function applySettingsPatch(
  settings: Settings,
  { access_token: accessToken, ...patch }: Partial<Settings> & { access_token?: string },
): Settings {
  return {
    ...settings,
    ...patch,
    access_token_set: accessToken === undefined ? settings.access_token_set : accessToken !== "",
    reboot_required: (patch.hostname ?? settings.hostname) !== settings.hostname,
  };
}

// Stands in for the firmware HTTP API and records every request the UI makes.
export function fakeRobot({
  authRequired = false,
  token = "",
  provisioning = false,
  settings = {} as Partial<Settings>,
} = {}) {
  const robot = {
    requests: [] as RecordedRequest[],
    failing: new Set<string>(),
    provisioning,
    settings: { ...DEFAULT_SETTINGS, wifi_configured: !provisioning, ...settings },
    // Runs before each reply, so a test can look at the page mid-request.
    onRequest: (request: RecordedRequest): void => void request,
    posts(path: string) {
      return this.requests.filter((request) => request.method === "POST" && request.path === path);
    },
    lastPost(path: string) {
      return this.posts(path).at(-1);
    },
    puts(path: string) {
      return this.requests.filter((request) => request.method === "PUT" && request.path === path);
    },
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, options: RequestInit = {}) => {
      const url = new URL(input, "http://robot.test");
      const headers = (options.headers ?? {}) as Record<string, string>;
      const request: RecordedRequest = {
        method: options.method ?? "GET",
        path: url.pathname,
        params: Object.fromEntries(url.searchParams),
        authorization: headers.Authorization,
        json: typeof options.body === "string" ? JSON.parse(options.body) : undefined,
      };
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

      robot.requests.push(request);
      robot.onRequest(request);

      if (request.path === "/auth") {
        return json({ ok: true, required: authRequired });
      }

      if (authRequired && request.authorization !== `Bearer ${token}`) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }

      if (robot.failing.has(request.path)) {
        return json({ ok: false, error: "robot said no" }, 400);
      }

      if (request.path === "/health") {
        return json({
          ok: true,
          version: "test",
          provisioning: robot.provisioning,
          wifi_configured: robot.settings.wifi_configured,
        });
      }

      if (request.path === "/settings" && request.method === "POST") {
        robot.settings = applySettingsPatch(robot.settings, request.json as Partial<Settings>);
      }

      if (request.path === "/settings/wifi" && request.method === "PUT") {
        robot.settings.wifi_networks = (request.json as WifiNetwork[]).map(({ ssid }) => ssid);
        robot.settings.wifi_configured = true;

        // A tested network ends setup AP mode.
        if (robot.provisioning) {
          robot.provisioning = false;

          return json({ ...robot.settings, wifi_connect_success: true, wifi_ip: "192.168.1.10" });
        }
      }

      if (request.path.startsWith("/settings")) {
        return json(robot.settings);
      }

      if (request.path === "/anim") {
        return json({ ok: true, animation: request.params.name ?? "none" });
      }

      return json({ ok: true });
    }),
  );

  return robot;
}

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

// Lets the chain of awaited fetches and renders behind one user action finish.
export async function settle() {
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// Renders the panel at `path` once boot has loaded the settings or stopped at a gate.
export async function renderApp(path = "/") {
  window.history.replaceState({}, "", path);
  render(<App />);
  await settle();

  const user = userEvent.setup();

  return {
    user,
    async click(name: string | RegExp) {
      await user.click(screen.getByRole("button", { name }));
      await settle();
    },
  };
}
