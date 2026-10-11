import { beforeEach, describe, expect, it } from "vitest";
import { $, click, fakeRobot, loadApp, submit } from "./robot.js";

const rows = () =>
  [...document.querySelectorAll("#wifi-network-list .wifi-network")].map((row) => ({
    ssid: row.querySelector(".wifi-network-ssid").textContent,
    note: row.querySelector(".wifi-network-note").textContent,
    button: row.querySelector(".btn"),
  }));

const wifiPosts = (robot) =>
  robot.requests
    .filter((request) => request.method === "POST" && request.params.wifi_ssid !== undefined)
    .map((request) => `${request.path} ${request.params.wifi_ssid}`);

async function stage(ssid, password = "") {
  $("#wifi-network-ssid").value = ssid;
  $("#wifi-network-password").value = password;
  await click("#wifi-network-add");
}

describe("wifi networks", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps the last saved network", async () => {
    fakeRobot({ settings: { wifi_networks: ["home"] } });
    await loadApp("/config");

    expect(rows().map((row) => row.ssid)).toEqual(["home"]);
    expect(rows()[0].button.disabled).toBe(true);
  });

  it("sends staged changes only on save, adds before removals", async () => {
    const robot = fakeRobot({ settings: { wifi_networks: ["home"] } });

    await loadApp("/config");
    await stage(" office ", "secret");
    await click("#wifi-network-list .wifi-network:last-child .btn");

    expect(rows().map((row) => row.note)).toEqual(["Added on save", "Removed on save"]);
    expect(wifiPosts(robot)).toEqual([]);

    await submit("#config-form");

    expect(wifiPosts(robot)).toEqual(["/settings office", "/settings/wifi/remove home"]);
    expect(robot.lastPost("/settings").params.wifi_password).toBe("secret");
    expect(rows().map((row) => row.ssid)).toEqual(["office"]);
    expect($("#status").textContent).toBe("Settings saved. WiFi networks apply after reboot.");
  });

  it("keeps the controls locked until the wifi requests finish", async () => {
    fakeRobot({ settings: { wifi_networks: ["home", "office"] } });

    await loadApp("/config");
    await click("#wifi-network-list .wifi-network:first-child .btn");

    const robotFetch = globalThis.fetch;
    let saveDisabledDuringRemove = null;

    globalThis.fetch = (input, options) => {
      if (String(input).startsWith("/settings/wifi/remove")) {
        saveDisabledDuringRemove = $("#config-form [type=submit]").disabled;
      }

      return robotFetch(input, options);
    };
    await submit("#config-form");

    expect(saveDisabledDuringRemove).toBe(true);
    expect($("#config-form [type=submit]").disabled).toBe(false);
  });

  it("drops a staged change on undo", async () => {
    const robot = fakeRobot({ settings: { wifi_networks: ["home"] } });

    await loadApp("/config");
    await stage("office");
    await click("#wifi-network-list .wifi-network:first-child .btn");
    await submit("#config-form");

    expect(wifiPosts(robot)).toEqual([]);
    expect($("#status").textContent).toBe("Settings saved.");
  });

  it("refuses a sixth network", async () => {
    fakeRobot({ settings: { wifi_networks: ["a", "b", "c", "d", "e"] } });
    await loadApp("/config");
    await stage("f");

    expect(rows()).toHaveLength(5);
    expect($("#status").textContent).toBe("The robot keeps up to 5 networks. Remove one first.");
  });

  it("names the network a failed request was for", async () => {
    const robot = fakeRobot({ settings: { wifi_networks: ["home", "office"] } });

    await loadApp("/config");
    await click("#wifi-network-list .wifi-network:first-child .btn");
    robot.failing.add("/settings/wifi/remove");
    await submit("#config-form");

    expect($("#status").textContent).toBe(
      "Settings saved. WiFi changes failed: home: robot said no",
    );
  });
});
