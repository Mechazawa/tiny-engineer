import { screen, within } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { fakeRobot, renderApp } from "./robot";

const rows = () =>
  within(screen.getByRole("list", { name: "Saved WiFi networks" }))
    .queryAllByRole("listitem")
    .map((row) => ({
      ssid: row.querySelector(".wifi-network-ssid")?.textContent,
      note: row.querySelector(".wifi-network-note")?.textContent,
      button: within(row).getByRole<HTMLButtonElement>("button"),
    }));

async function openConfig(settings: { wifi_networks: string[] }) {
  const robot = fakeRobot({ settings });
  const app = await renderApp("/config");

  return {
    robot,
    ...app,
    async stage(ssid: string, password = "") {
      await app.user.type(screen.getByLabelText("Network name (SSID)"), ssid);

      if (password) {
        await app.user.type(screen.getByLabelText("Password"), password);
      }

      await app.click("Add network");
    },
    async rowButton(ssid: string) {
      const row = screen.getByText(ssid, { selector: ".wifi-network-ssid" }).closest("li");

      await app.user.click(within(row as HTMLElement).getByRole("button"));
    },
  };
}

describe("wifi networks", () => {
  it("keeps the last saved network", async () => {
    await openConfig({ wifi_networks: ["home"] });

    expect(rows().map((row) => row.ssid)).toEqual(["home"]);
    expect(rows()[0].button.disabled).toBe(true);
  });

  it("sends the whole list once on save", async () => {
    const { robot, stage, rowButton, click } = await openConfig({ wifi_networks: ["home"] });

    await stage(" office ", "secret");
    await rowButton("home");

    expect(rows().map((row) => row.note)).toEqual(["Added on save", "Removed on save"]);
    expect(robot.puts("/settings/wifi")).toEqual([]);

    await click("Save settings");

    expect(robot.puts("/settings/wifi").map((request) => request.json)).toEqual([
      [{ ssid: "office", password: "secret" }],
    ]);
    expect(rows().map((row) => row.ssid)).toEqual(["office"]);
    expect(screen.getByRole("status").textContent).toBe(
      "Settings saved. WiFi networks apply after reboot.",
    );
  });

  it("swaps four of five networks in one request", async () => {
    const { robot, stage, rowButton, click } = await openConfig({
      wifi_networks: ["a", "b", "c", "d", "e"],
    });

    for (const ssid of ["a", "b", "c", "d"]) {
      await rowButton(ssid);
    }

    for (const ssid of ["f", "g", "h", "i"]) {
      await stage(ssid, "pw");
    }

    await click("Save settings");

    expect(robot.puts("/settings/wifi")).toHaveLength(1);
    expect(robot.settings.wifi_networks).toEqual(["f", "g", "h", "i", "e"]);
  });

  it("keeps saved passwords by leaving them out", async () => {
    const { robot, rowButton, click } = await openConfig({ wifi_networks: ["home", "office"] });

    await rowButton("office");
    await click("Save settings");

    expect(robot.puts("/settings/wifi")[0].json).toEqual([{ ssid: "home" }]);
  });

  it("clears a new password for a saved network once it is saved", async () => {
    const { robot, stage, click } = await openConfig({ wifi_networks: ["home"] });

    await stage("home", "new-secret");
    await click("Save settings");

    expect(robot.puts("/settings/wifi")[0].json).toEqual([
      { ssid: "home", password: "new-secret" },
    ]);
    expect(rows().map((row) => row.note)).toEqual([""]);
  });

  it("sends nothing when the list did not change", async () => {
    const { robot, stage, rowButton, click } = await openConfig({ wifi_networks: ["home"] });

    await stage("office");
    await rowButton("office");
    await click("Save settings");

    expect(robot.puts("/settings/wifi")).toEqual([]);
    expect(screen.getByRole("status").textContent).toBe("Settings saved.");
  });

  it("refuses a sixth network", async () => {
    const { stage } = await openConfig({ wifi_networks: ["a", "b", "c", "d", "e"] });

    await stage("f");

    expect(rows()).toHaveLength(5);
    expect(screen.getByRole("status").textContent).toBe(
      "The robot keeps up to 5 networks. Remove one first.",
    );
  });

  it("keeps the controls locked until the list is saved", async () => {
    const { robot, rowButton, click } = await openConfig({ wifi_networks: ["home", "office"] });
    const save = screen.getByRole<HTMLButtonElement>("button", { name: "Save settings" });
    let lockedDuringPut: boolean | null = null;

    robot.onRequest = (request) => {
      if (request.method === "PUT") {
        lockedDuringPut = save.disabled;
      }
    };

    await rowButton("office");
    await click("Save settings");

    expect(lockedDuringPut).toBe(true);
    expect(save.disabled).toBe(false);
  });

  it("reports the robot's error and keeps the staged change", async () => {
    const { robot, rowButton, click } = await openConfig({ wifi_networks: ["home", "office"] });

    await rowButton("office");
    robot.failing.add("/settings/wifi");
    await click("Save settings");

    expect(screen.getByRole("status").textContent).toBe(
      "Settings saved. WiFi networks not saved: robot said no",
    );
    expect(rows().map((row) => row.note)).toEqual(["", "Removed on save"]);
  });
});
